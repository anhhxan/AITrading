import { IExchangeAdapter } from './IExchangeAdapter';
import { PaperExchangeAdapter } from './PaperExchangeAdapter';

export class ExchangeRouter {
    public static paperAdapter = new PaperExchangeAdapter();

    public async getAdapter(robotSlug: string): Promise<IExchangeAdapter> {
        return ExchangeRouter.paperAdapter;
    }
}
