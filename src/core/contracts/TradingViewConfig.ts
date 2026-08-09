import { z } from "zod";

export const ExpectedIndicatorConfigSchema = z.object({
  length: z.number().int().positive(),
  source: z.string().min(1),
  mult: z.number().positive(),
  mult2: z.number().positive(),
  // Immutable mapping enforced by the schema
  mapping: z.object({
    line1: z.literal("upper"),
    line2: z.literal("upper2"),
    line3: z.literal("basis"),
    line4: z.literal("lower2"),
    line5: z.literal("lower")
  }).default({
    line1: "upper",
    line2: "upper2",
    line3: "basis",
    line4: "lower2",
    line5: "lower"
  })
});

export type ExpectedIndicatorConfig = z.infer<typeof ExpectedIndicatorConfigSchema>;

export const SignalSourceSchema = z.object({
  provider: z.literal("TradingView"),
  symbol: z.string().min(1),
  timeframe: z.string().min(1)
});

export type SignalSource = z.infer<typeof SignalSourceSchema>;

export const ExecutionProviderSchema = z.object({
  provider: z.enum(["Binance", "Exness", "OKX"]),
  symbol: z.string().min(1),
  accountId: z.string().uuid().optional()
});

export type ExecutionProvider = z.infer<typeof ExecutionProviderSchema>;

export const TradingAccountResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  provider: z.string(),
  status: z.string(),
  lastConnected: z.string().optional(),
  maskedApiKey: z.string()
  // api_secret is explicitly omitted
});

export type TradingAccountResponse = z.infer<typeof TradingAccountResponseSchema>;
