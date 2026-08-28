import { getSupabaseAdmin } from '@/lib/supabase';
import { StrategyEngine } from '@/core/engine/strategies/StrategyEngine';
import { StateMachineEngine } from '@/core/engine/runtime/StateMachineEngine';
import { RiskEngine } from '@/core/engine/risk/RiskEngine';
import { PaperExecutionEngine } from '@/core/engine/execution/PaperExecutionEngine';
import { PaperPositionTracker } from '@/core/engine/execution/PaperPositionTracker';
import { TradingViewSignalAdapter } from '@/core/adapters/tradingview/TradingViewSignalAdapter';
import { coreEventBus } from '@/core/infrastructure/EventBus';
import { EngineOrchestrator } from '@/core/engine/runtime/EngineOrchestrator';
import { RealtimePriceFeed } from '@/core/engine/runtime/RealtimePriceFeed';

export class RobotRuntime {
    public priceFeed: RealtimePriceFeed | null = null;
    
    constructor(
        public readonly robotId: string,
        private strategyEngine: StrategyEngine,
        private stateMachine: StateMachineEngine,
        private riskEngine: RiskEngine,
        private positionTracker: PaperPositionTracker
    ) {}

    public async initialize() {
        const supabase = getSupabaseAdmin();
        const { data: configData, error: configErr } = await supabase
            .from('robot_configs')
            .select(`
                *,
                robots (*),
                risk_profile:risk_profiles (*)
            `)
            .eq('robot_id', this.robotId)
            .eq('status', 'ACTIVE')
            .single();

        if (configErr || !configData) {
            console.error('[RuntimeManager] Error loading config:', configErr);
            return;
        }

        // Hydration: Source of Truth is now active_setups (Phase 3.7)
        const { data: activeSetup, error: setupErr } = await supabase
            .from('active_setups')
            .select('*')
            .eq('robot_id', this.robotId)
            .single(); // Assuming one active setup per robot

        let trueState = 'IDLE';
        let trueActiveSignal = null;

        if (activeSetup) {
            trueState = activeSetup.state; // PENDING, ARM, ACTIVE
            trueActiveSignal = {
                setup_id: activeSetup.setup_id,
                direction: activeSetup.direction,
                trigger: activeSetup.trigger_price,
                stop: activeSetup.stop_price,
                snapshot: activeSetup.snapshot
            };
        } else {
            trueState = configData.robots.current_state || 'IDLE';
        }
        
        // Register strategy
        this.strategyEngine.registerRobot(this.robotId, 'BB_Strategy', {});
        
        // Register state
        (this.stateMachine as any).states.set(this.robotId, trueState);
        (this.stateMachine as any).registerRobot(this.robotId, configData.robots.timeframe);

        // FIX: STRICTLY USE risk_profile.position_allocation_percent, DO NOT READ LEGACY COLUMNS
        const positionAllocationPercent = configData.risk_profile?.position_allocation_percent || 10;
        
        this.riskEngine.registerRobotConfig(this.robotId, {
            tradingViewSymbol: configData.robots.trading_view_symbol,
            executionSymbol: configData.robots.execution_symbol,
            timeframe: configData.robots.timeframe,
            accountBalance: configData.robots.paper_balance,
            positionAllocationPercent: positionAllocationPercent,
            leverage: configData.robots.leverage || 1
        });

        const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', this.robotId).single();
        if (pos && pos.context_snapshot) {
            (this.positionTracker as any).positionContexts.set(this.robotId, pos.context_snapshot);
        }

        if ((trueState === 'WAIT_RETRACEMENT' || trueState === 'READY_TO_ENTER') && trueActiveSignal) {
            (this.stateMachine as any).activeSignals.set(this.robotId, trueActiveSignal);
            (this.riskEngine as any).activeSignals.set(this.robotId, trueActiveSignal);
        }
        
        // Start Realtime Price Feed
        if (configData.robots.execution_symbol) {
            this.priceFeed = new RealtimePriceFeed(this.robotId, configData.robots.execution_symbol);
            this.priceFeed.start();
        }
    }
    
    public destroy() {
        if (this.priceFeed) this.priceFeed.stop();
        (this.strategyEngine as any).robotConfig.delete(this.robotId);
        (this.stateMachine as any).states.delete(this.robotId);
        (this.riskEngine as any).robotConfigs.delete(this.robotId);
        (this.positionTracker as any).positionContexts.delete(this.robotId);
    }
}

export class RuntimeManager {
    private runtimes: Map<string, RobotRuntime> = new Map();
    private orchestrator: EngineOrchestrator;
    public adapter: TradingViewSignalAdapter;
    
    public strategyEngine: StrategyEngine;
    public stateMachine: StateMachineEngine;
    public riskEngine: RiskEngine;
    public executionEngine: PaperExecutionEngine;
    public positionTracker: PaperPositionTracker;

    constructor() {
        this.orchestrator = new EngineOrchestrator();
        this.adapter = new TradingViewSignalAdapter();
        
        this.strategyEngine = new StrategyEngine();
        this.stateMachine = new StateMachineEngine();
        this.riskEngine = new RiskEngine();
        this.executionEngine = new PaperExecutionEngine();
        this.positionTracker = new PaperPositionTracker();
    }

    public async initializeEngines() {
        await this.strategyEngine.initialize();
        await this.stateMachine.initialize();
        await this.riskEngine.initialize();
        await this.executionEngine.initialize();
        await this.positionTracker.initialize();
    }

    public async getOrCreateRuntime(robotId: string): Promise<RobotRuntime> {
        if (this.runtimes.has(robotId)) {
            return this.runtimes.get(robotId)!;
        }
        
        const runtime = new RobotRuntime(
            robotId,
            this.strategyEngine,
            this.stateMachine,
            this.riskEngine,
            this.positionTracker
        );
        
        await runtime.initialize();
        this.runtimes.set(robotId, runtime);
        console.log(`[RuntimeManager] Created runtime for ${robotId}`);
        return runtime;
    }

    public async stopRuntime(robotId: string) {
        if (this.runtimes.has(robotId)) {
            this.runtimes.get(robotId)!.destroy();
            this.runtimes.delete(robotId);
            console.log(`[RuntimeManager] Destroyed runtime for ${robotId}`);
        }
    }
    
    public hasRuntime(robotId: string): boolean {
        return this.runtimes.has(robotId);
    }

    public async heartbeatAll() {
        const supabase = getSupabaseAdmin();
        const robotIds = Array.from(this.runtimes.keys());
        if (robotIds.length === 0) return;

        // In a real app we might batch this or update each robot
        for (const id of robotIds) {
            await supabase.from('robots').update({ last_heartbeat_at: new Date().toISOString() }).eq('id', id);
            console.log(`[Heartbeat] robot=${id} OK`);
        }
    }
}
