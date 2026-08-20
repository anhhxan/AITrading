import { getSupabaseAdmin } from '@/lib/supabase';
import { StrategyEngine } from '@/core/engine/strategies/StrategyEngine';
import { StateMachineEngine } from '@/core/engine/runtime/StateMachineEngine';
import { RiskEngine } from '@/core/engine/risk/RiskEngine';
import { PaperExecutionEngine } from '@/core/engine/execution/PaperExecutionEngine';
import { PaperPositionTracker } from '@/core/engine/execution/PaperPositionTracker';
import { TradingViewAdapter } from '@/core/adapters/tradingview/TradingViewAdapter';
import { coreEventBus } from '@/core/infrastructure/EventBus';
import { EngineOrchestrator } from '@/core/engine/runtime/EngineOrchestrator';

export class RobotRuntime {
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
            .select('*, robots!inner(*)')
            .eq('robot_id', this.robotId)
            .eq('status', 'ACTIVE')
            .single();

        if (configErr || !configData) throw new Error('MISSING_CONFIG');

        const currentState = configData.robots.current_state || 'WAIT_SIGNAL';
        
        // Register strategy
        this.strategyEngine.registerRobot(this.robotId, 'BB_Strategy', {});
        
        // Register state
        (this.stateMachine as any).states.set(this.robotId, currentState);

        const positionAllocationPercent = configData.position_allocation_percent || configData.robots?.position_allocation_percent || configData.risk_profile?.position_allocation_percent;
        
        this.riskEngine.registerRobotConfig(this.robotId, {
            tradingViewSymbol: configData.robots.trading_view_symbol,
            executionSymbol: configData.robots.execution_symbol,
            timeframe: configData.robots.timeframe,
            accountBalance: configData.robots.paper_balance,
            positionAllocationPercent: positionAllocationPercent || 10,
            leverage: configData.robots.leverage || 1
        });

        const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', this.robotId).single();
        if (pos && pos.context_snapshot) {
            (this.positionTracker as any).positionContexts.set(this.robotId, pos.context_snapshot);
        }

        if (currentState === 'WAIT_RETRACEMENT' || currentState === 'READY_TO_ENTER') {
            const { data: signalEvent } = await supabase
                .from('core_events')
                .select('payload, timestamp')
                .eq('robot_id', this.robotId)
                .eq('event_type', 'STRATEGY_SIGNAL_EVENT')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
                
            if (signalEvent && signalEvent.payload) {
                const activeSignal = signalEvent.payload;
                (this.stateMachine as any).activeSignals.set(this.robotId, activeSignal);
                (this.riskEngine as any).activeSignals.set(this.robotId, activeSignal);
            }
        }
    }
    
    public destroy() {
        (this.strategyEngine as any).robotConfig.delete(this.robotId);
        (this.stateMachine as any).states.delete(this.robotId);
        (this.riskEngine as any).robotConfigs.delete(this.robotId);
        (this.positionTracker as any).positionContexts.delete(this.robotId);
    }
}

export class RuntimeManager {
    private runtimes: Map<string, RobotRuntime> = new Map();
    private orchestrator: EngineOrchestrator;
    public adapter: TradingViewAdapter;
    
    public strategyEngine: StrategyEngine;
    public stateMachine: StateMachineEngine;
    public riskEngine: RiskEngine;
    public executionEngine: PaperExecutionEngine;
    public positionTracker: PaperPositionTracker;

    constructor() {
        this.orchestrator = new EngineOrchestrator();
        this.adapter = new TradingViewAdapter();
        
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
        }
    }
}
