export interface OrderRequest {
    clientOrderId: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    type: 'MARKET' | 'LIMIT';
    price?: number;
    quantity: number;
}

export interface ProtectionRequest {
    parentOrderId: string; // The exchange order ID of the Entry
    clientOrderId: string; // The protection order ID
    symbol: string;
    side: 'LONG' | 'SHORT'; // Direction of protection (Opposite of entry)
    stopLossPrice: number;
    takeProfitPrice?: number;
    quantity: number;
}

export interface OrderResponse {
    status: 'ACCEPTED' | 'REJECTED' | 'FILLED' | 'PARTIAL_FILL' | 'TIMEOUT';
    orderId?: string;
    fillPrice?: number;
    filledQuantity?: number;
    reason?: string;
}

export interface IExchangeAdapter {
    getProviderName(): string;
    placeOrder(request: OrderRequest): Promise<OrderResponse>;
    placeProtection(request: ProtectionRequest): Promise<OrderResponse>;
    queryOrder(clientOrderId: string): Promise<OrderResponse>;
}
