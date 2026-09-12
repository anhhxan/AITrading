import { z } from 'zod';

export const EntrySignalSchema = z.object({
  signal_id: z.string().min(1),
  robot_slug: z.string().min(1),
  strategy: z.string().min(1),
  symbol: z.string().min(1),
  timeframe: z.string().min(1),
  side: z.enum(['LONG', 'SHORT']),
  entry_price: z.number().positive(),
  entry_type: z.enum(['MARKET', 'LIMIT']).optional().default('MARKET'),
  stop_loss: z.number().positive(),
  take_profit: z.number().positive().optional().nullable(),
  signal_timestamp: z.number().positive(),
  config_version: z.number().int().nonnegative(),
  indicator_snapshot: z.record(z.string(), z.any()).optional()
}).refine(data => {
  if (data.side === 'LONG' && data.stop_loss >= data.entry_price) {
    return false;
  }
  if (data.side === 'SHORT' && data.stop_loss <= data.entry_price) {
    return false;
  }
  return true;
}, "Invalid stop_loss for the given side");

export type EntrySignal = z.infer<typeof EntrySignalSchema>;
