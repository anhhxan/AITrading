/**
 * LockManager prevents race conditions and multiple duplicate executions.
 * Useful for ensuring a Robot doesn't execute a BUY signal multiple times concurrently.
 */
class LockManagerService {
  private locks: Map<string, boolean>;

  constructor() {
    this.locks = new Map<string, boolean>();
  }

  /**
   * Acquires a lock for a given key (e.g. robot_id or robot_id + action)
   * Returns true if lock was successfully acquired, false if it is already locked.
   */
  public acquireLock(key: string): boolean {
    if (this.locks.has(key) && this.locks.get(key) === true) {
      return false; // Already locked
    }
    
    this.locks.set(key, true);
    return true;
  }

  /**
   * Releases a lock for a given key.
   */
  public releaseLock(key: string): void {
    this.locks.set(key, false);
  }

  /**
   * Checks if a key is currently locked without acquiring it.
   */
  public isLocked(key: string): boolean {
    return this.locks.get(key) === true;
  }
  
  /**
   * Execute a function with a lock. Automatically releases the lock when done.
   * Throws an error if the lock cannot be acquired.
   */
  public async executeWithLock<T>(key: string, task: () => Promise<T>): Promise<T> {
    if (!this.acquireLock(key)) {
      throw new Error(`Execution Locked for key: ${key}`);
    }
    
    try {
      return await task();
    } finally {
      this.releaseLock(key);
    }
  }
}

// Export as a singleton
export const LockManager = new LockManagerService();
