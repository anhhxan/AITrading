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

        if (configErr || !configData) {
            console.warn(`[RuntimeManager] Robot ${this.robotId} is missing config. Registering for heartbeat only.`);
            return;
        }

        // Event Sourcing Replay for True State
        const { data: recentEvents } = await supabase
            .from('core_events')
            .select('event_type, payload, created_at')
            .eq('robot_id', this.robotId)
            .in('event_type', ['STRATEGY_SIGNAL_EVENT', 'STATE_TRANSITION_EVENT'])
            .order('created_at', { ascending: false })
            .limit(100);

        let trueState = configData.robots.current_state || 'WAIT_SIGNAL';
        let trueActiveSignal = null;

        if (recentEvents && recentEvents.length > 0) {
            // Replay events in chronological order (ascending)
            const replayEvents = [...recentEvents].reverse();
            for (const event of replayEvents) {
                if (event.event_type === 'STRATEGY_SIGNAL_EVENT') {
                    trueActiveSignal = event.payload;
                    trueState = 'WAIT_RETRACEMENT';
                } else if (event.event_type === 'STATE_TRANSITION_EVENT') {
                    if (event.payload?.newState) {
                        trueState = event.payload.newState;
                        if (trueState !== 'WAIT_RETRACEMENT' && trueState !== 'READY_TO_ENTER') {
                            trueActiveSignal = null;
                        }
                    }
                }
            }
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
            console.log(`[Heartbeat] robot=${id} OK`);
        }
    }
}
