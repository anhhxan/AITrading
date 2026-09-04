const fs = require('fs');
const content = `import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function translateRobotState(state: string | null | undefined): string {
  if (!state) return 'KHÔNG XÁC Ð?NH';
  switch (state) {
    case 'WAIT_SIGNAL': return 'Ch? Tín Hi?u (N?n A)';
    case 'WAIT_CANDLE_B_CONFIRMATION': return 'N?n B';
    case 'READY_TO_ENTER': return 'Ch? Vào L?nh';
    case 'POSITION_OPEN': return 'Ðang Ôm L?nh';
    default: return state;
  }
}
`;
fs.writeFileSync('src/lib/utils.ts', content, 'utf8');
