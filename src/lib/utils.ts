import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function translateRobotState(state: string | null | undefined): string {
  if (!state) return 'KHÔNG XÁC ĐỊNH';
  switch (state) {
    case 'WAIT_SIGNAL': return 'Chờ Tín Hiệu (Nến A)';
    case 'WAIT_CANDLE_B_CONFIRMATION': return 'Nến B';
    case 'READY_TO_ENTER': return 'Chờ Vào Lệnh';
    case 'POSITION_OPEN': return 'Đang Ôm Lệnh';
    default: return state;
  }
}
