import { supabase } from '../../../lib/supabaseClient';
import { coreEventBus } from '@/core/infrastructure/EventBus';
import { IEngine, EngineHealth } from '../runtime/IEngine';
import { Clock } from '../../infrastructure/Clock';

export class CQRSProjection implements IEngine {
  private health: EngineHealth;
  private unsubscribeFuncs: Array<() => void> = [];

  constructor() {
    this.health = {
      engineId: 'CQRSProjection',
      status: 'STARTING',
      heartbeat: Clock.now(),
      uptime: 0,
      lastError: null,
      restartCount: 0
    };
  }

  public async initialize(): Promise<void> {
    this.health.status = 'READY';
    
    // Đăng ký lắng nghe các sự kiện cập nhật DB
    this.unsubscribeFuncs.push(
      coreEventBus.subscribe('STATE_TRANSITION_EVENT', async (event: any) => {
        this.health.heartbeat = Clock.now();
        const { robotId } = event;
        const { newState } = event;
        
        const { error } = await supabase
          .from('robots')
          .update({ state: newState, updated_at: new Date().toISOString() })
          .eq('id', robotId);
          
        if (error) {
          console.error('[CQRSProjection] Failed to update robot state', error);
          throw error;
        }
      })
    );
  }

  public async shutdown(): Promise<void> {
    this.health.status = 'SHUTTING_DOWN';
    for (const unsub of this.unsubscribeFuncs) {
      unsub();
    }
    this.unsubscribeFuncs = [];
    this.health.status = 'ERROR'; // Stopped
  }

  public healthCheck(): EngineHealth {
    return this.health;
  }

  public ready(): boolean {
    return this.health.status === 'READY';
  }
}
