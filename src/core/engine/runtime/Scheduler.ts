/**
 * Hiến pháp Core Engine - Mục 19: Scheduler Contract
 * Quản lý vòng đời chạy của từng Robot (Start/Stop/Pause/Resume).
 */
export interface IScheduler {
  startRobot(robotId: string): Promise<void>;
  stopRobot(robotId: string): Promise<void>;
  pauseRobot(robotId: string): Promise<void>;
  resumeRobot(robotId: string): Promise<void>;
}

export class Scheduler implements IScheduler {
  // Mapping từ robotId -> trạng thái hiện tại (RUNNING, PAUSED)
  private activeRobots: Map<string, 'RUNNING' | 'PAUSED'> = new Map();

  public async startRobot(robotId: string): Promise<void> {
    if (this.activeRobots.has(robotId)) {
      throw new Error(`Robot ${robotId} is already running.`);
    }
    this.activeRobots.set(robotId, 'RUNNING');
    console.log(`[Scheduler] Robot ${robotId} STARTED.`);
    
    // Gửi Event kích hoạt để MarketDataEngine subscribe symbol
    // Sẽ kết nối EventBus ở đây
  }

  public async stopRobot(robotId: string): Promise<void> {
    if (!this.activeRobots.has(robotId)) return;
    this.activeRobots.delete(robotId);
    console.log(`[Scheduler] Robot ${robotId} STOPPED.`);
  }

  public async pauseRobot(robotId: string): Promise<void> {
    if (!this.activeRobots.has(robotId)) return;
    this.activeRobots.set(robotId, 'PAUSED');
    console.log(`[Scheduler] Robot ${robotId} PAUSED.`);
  }

  public async resumeRobot(robotId: string): Promise<void> {
    if (this.activeRobots.get(robotId) === 'PAUSED') {
      this.activeRobots.set(robotId, 'RUNNING');
      console.log(`[Scheduler] Robot ${robotId} RESUMED.`);
    }
  }
}
