import { Candle, IIndicator, IStrategy, StrategyContext, SignalSide } from '../../interfaces/PluginInterfaces';
import { BB_MB_Indicator } from '../../plugins/indicators/BB_MB';
import { BB_Strategy } from '../../plugins/strategies/BB_Strategy';

/**
 * Plugin Loader & Isolator
 * Tôn trọng kiến trúc Make it work. Tập trung quản lý và cô lập an toàn Plugin.
 */
export class PluginLoader {
  /**
   * Khởi tạo Indicator từ tên định danh.
   */
  public static loadIndicator(name: string): IIndicator {
    if (name === 'BB_MB') {
      return new BB_MB_Indicator();
    }
    throw new Error(`[PluginLoader] Indicator Plugin không tồn tại: ${name}`);
  }

  public static loadStrategy(name: string): IStrategy {
    if (name === 'BB_Strategy') {
      return new BB_Strategy();
    }
    throw new Error(`[PluginLoader] Strategy Plugin không tồn tại: ${name}`);
  }

  /**
   * Khởi tạo, cấu hình và kiểm tra hợp lệ Indicator.
   */
  public static loadAndInitializeIndicator(name: string, params: Record<string, any>): IIndicator {
    const instance = this.loadIndicator(name);
    instance.init(params);
    if (!instance.validate()) {
      throw new Error(`[PluginLoader] Indicator Plugin configuration invalid: ${name}`);
    }
    return instance;
  }

  /**
   * Warmup một Plugin với dữ liệu lịch sử
   */
  public static warmup(indicator: IIndicator, historicalCandles: Candle[]): void {
    try {
      indicator.warmup(historicalCandles);
    } catch (error) {
      console.error(`[PluginLoader] FATAL: Indicator Plugin ${indicator.name} crashed during warmup!`, error);
    }
  }

  /**
   * Cô lập (Isolation): Gọi update trong một sandbox an toàn
   * Đảm bảo một plugin bị lỗi không làm sập tiến trình chung của Engine.
   */
  public static safeUpdate(indicator: IIndicator, candle: Candle): any {
    try {
      return indicator.update(candle);
    } catch (error) {
      console.error(`[PluginLoader] FATAL: Indicator Plugin ${indicator.name} crashed during update!`, error);
      return { 
        ready: false, 
        error: true, 
        crashMessage: (error as Error).message,
        line1: null,
        line2: null,
        line3: null,
        line4: null,
        line5: null
      };
    }
  }

  public static safeEvaluateStrategy(strategy: IStrategy, context: StrategyContext): SignalSide | 'ERROR' {
    try {
      return strategy.evaluate(context);
    } catch (error) {
      console.error(`[PluginLoader] FATAL: Strategy Plugin ${strategy.name} crashed during evaluate!`, error);
      return 'ERROR';
    }
  }
}
