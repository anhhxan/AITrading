import { IExchangeAdapter, OrderRequest, ProtectionRequest, OrderResponse } from './IExchangeAdapter';

export class PaperExchangeAdapter implements IExchangeAdapter {
    // For testing partial failures
    public mockNextOrderResponse?: OrderResponse;
    public mockNextProtectionResponse?: OrderResponse;
    public mockNextQueryResponse?: OrderResponse;
    
    // Simulating internal state
    private orders = new Map<string, OrderResponse>();

    public getProviderName(): string {
        return 'PAPER_EXCHANGE';
    }

    public async placeOrder(request: OrderRequest): Promise<OrderResponse> {
        if (this.mockNextOrderResponse) {
            const resp = this.mockNextOrderResponse;
            this.mockNextOrderResponse = undefined;
            if (resp.status !== 'TIMEOUT' && resp.status !== 'REJECTED') {
                this.orders.set(request.clientOrderId, resp);
            }
            return resp;
        }

        // Default happy path
        const resp: OrderResponse = {
            status: 'FILLED',
            orderId: 'exch_' + request.clientOrderId,
            fillPrice: request.price || 50000,
            filledQuantity: request.quantity
        };
        this.orders.set(request.clientOrderId, resp);
        return resp;
    }

    public async placeProtection(request: ProtectionRequest): Promise<OrderResponse> {
        if (this.mockNextProtectionResponse) {
            const resp = this.mockNextProtectionResponse;
            this.mockNextProtectionResponse = undefined;
            return resp;
        }

        // Default happy path
        return {
            status: 'ACCEPTED',
            orderId: 'exch_prot_' + request.clientOrderId
        };
    }

    public async queryOrder(clientOrderId: string): Promise<OrderResponse> {
        if (this.mockNextQueryResponse) {
            const resp = this.mockNextQueryResponse;
            this.mockNextQueryResponse = undefined;
            return resp;
        }
        
        const existing = this.orders.get(clientOrderId);
        if (existing) return existing;
        
        return { status: 'REJECTED', reason: 'Not Found' };
    }
}
