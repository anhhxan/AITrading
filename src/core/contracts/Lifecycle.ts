export const LIFECYCLE_STATUS = {
  CREATED: 'CREATED',
  CONFIGURED: 'CONFIGURED',
  READY: 'READY',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  STOPPED: 'STOPPED',
  ERROR: 'ERROR',
  ARCHIVED: 'ARCHIVED'
} as const;

export type LifecycleStatus = typeof LIFECYCLE_STATUS[keyof typeof LIFECYCLE_STATUS];

export const isValidTransition = (current: LifecycleStatus, next: LifecycleStatus): boolean => {
  if (next === LIFECYCLE_STATUS.ARCHIVED) return true; // Handled by complex rule later
  
  switch (current) {
    case LIFECYCLE_STATUS.CREATED:
      return next === LIFECYCLE_STATUS.RUNNING; // Simplified for now
    case LIFECYCLE_STATUS.RUNNING:
      return next === LIFECYCLE_STATUS.PAUSED || next === LIFECYCLE_STATUS.STOPPED;
    case LIFECYCLE_STATUS.PAUSED:
      return next === LIFECYCLE_STATUS.RUNNING || next === LIFECYCLE_STATUS.STOPPED;
    case LIFECYCLE_STATUS.STOPPED:
      return next === LIFECYCLE_STATUS.RUNNING;
    default:
      return false;
  }
};

export const EXECUTION_STATES = {
  IDLE: 'IDLE',
  SIGNAL_DETECTED: 'SIGNAL_DETECTED',
  WAIT_CANDLE_B_CONFIRMATION: 'WAIT_CANDLE_B_CONFIRMATION',
  READY_TO_ENTER: 'READY_TO_ENTER',
  EXECUTION_PENDING: 'EXECUTION_PENDING',
  POSITION_OPEN: 'POSITION_OPEN',
  EXIT_PENDING: 'EXIT_PENDING'
} as const;

export type ExecutionState = typeof EXECUTION_STATES[keyof typeof EXECUTION_STATES];

export const canArchive = (currentState: string): boolean => {
  // Reject archive if there is an open position or pending execution
  if (
    currentState === EXECUTION_STATES.POSITION_OPEN ||
    currentState === EXECUTION_STATES.EXECUTION_PENDING ||
    currentState === EXECUTION_STATES.EXIT_PENDING
  ) {
    return false;
  }
  return true;
};
