
import { BaseEvent, EventFactory } from '../../infrastructure/EventFactory';
import { coreEventBus } from '../../infrastructure/EventBus';

export interface RealtimePriceEvent extends BaseEvent {
    symbol: string;
    price: number;
    eventTimestamp: number;
    source: string;
    sequenceId: number;
}

export type FeedStatus = 'CONNECTING' | 'CONNECTED' | 'STALE' | 'DISCONNECTED';

export class RealtimePriceFeed {
    private ws: WebSocket | null = null;
    private symbol: string;
    private robotId: string;
    
    public status: FeedStatus = 'DISCONNECTED';
    public lastPrice: number = 0;
    public lastMarketTimestamp: number = 0;
    
    private reconnectTimeout: any = null;
    private staleCheckInterval: any = null;
    private pingInterval: any = null;
    
    private sequenceId = 0;
    private engineId = 'RealtimePriceFeed_1';

    constructor(robotId: string, symbol: string) {
        this.robotId = robotId;
        this.symbol = symbol;
    }

    private heartbeatInterval: any = null;

    public isDataValid(): boolean {
        return this.status === 'CONNECTED' && 
               this.lastPrice > 0 && 
               this.lastMarketTimestamp > 0 && 
               (Date.now() - this.lastMarketTimestamp <= 5000);
    }

    public start() {
        if (this.status === 'CONNECTED' || this.status === 'CONNECTING') return;
        this.logForensic('REALTIME_PRICE_FEED_STARTED');
        this.connect();
        
        // Stale check
        this.staleCheckInterval = setInterval(() => {
            if (this.status === 'CONNECTED') {
                if (this.lastMarketTimestamp <= 0 || Date.now() - this.lastMarketTimestamp > 5000) {
                    this.status = 'STALE';
                    this.logForensic('REALTIME_PRICE_FEED_STALE');
                }
            }
        }, 1000);
        
        // Heartbeat for UI and forensics (every 5 seconds)
        this.heartbeatInterval = setInterval(() => {
            if (this.status === 'CONNECTED' || this.status === 'CONNECTING') {
                this.publishHeartbeat();
            }
        }, 5000);
    }
    
    private async publishHeartbeat() {
        const trace = EventFactory.createTrace(
            `ws-heartbeat-${this.sequenceId}`, 
            `ws-agg-${this.lastMarketTimestamp}`,
            this.engineId,
            this.sequenceId
        );

        const heartbeatEvent = EventFactory.createEvent(
            'PRICE_HEARTBEAT_EVENT',
            this.robotId,
            1,
            trace,
            {
                symbol: this.symbol,
                price: this.lastPrice,
                eventTimestamp: this.lastMarketTimestamp,
                source: 'BINANCE_FUTURES_TRADE',
                status: this.status
            }
        );
        
        await coreEventBus.publish(heartbeatEvent as any);
    }

    private connect() {
        if (this.ws) {
            try { this.ws.close(); } catch(e) {}
            this.ws = null;
        }

        const streamSymbol = this.symbol.replace('BINANCE:', '').toLowerCase();
        
        const wsUrl = `wss://fstream.binance.com/ws/${streamSymbol}@trade`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            this.status = 'CONNECTING';
            this.logForensic('REALTIME_PRICE_FEED_CONNECTING');
            
            // Ping to keep alive
            this.pingInterval = setInterval(() => {
                if (this.ws?.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ method: 'PING' }));
                }
            }, 30000);
        };

        this.ws.onmessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data.toString());
                if (data.e === 'trade') {
                    const price = parseFloat(data.p);
                    const timestamp = data.E;
                    
                    if (price > 0 && timestamp > 0) {
                        this.lastPrice = price;
                        this.lastMarketTimestamp = timestamp; // Event time
                        this.sequenceId++;
                        
                        if (this.status === 'STALE' || this.status === 'DISCONNECTED' || this.status === 'CONNECTING') {
                            this.status = 'CONNECTED';
                            this.logForensic('REALTIME_PRICE_FEED_CONNECTED');
                        }
                        
                        this.publishEvent();
                    }
                }
            } catch (err) {
                console.error(`[RealtimePriceFeed] JSON parse error:`, err);
                this.logForensic('REALTIME_PRICE_PARSE_ERROR');
            }
        };

        this.ws.onclose = () => {
            if (this.pingInterval) clearInterval(this.pingInterval);
            if (this.status !== 'DISCONNECTED') {
                this.status = 'DISCONNECTED';
                this.logForensic('REALTIME_PRICE_FEED_DISCONNECTED');
            }
            // Reconnect logic with basic backoff (fixed 3s for now as requested by stability)
            this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = (err: any) => {
            console.error(`[RealtimePriceFeed] WebSocket error for ${this.symbol}:`, err);
        };
    }

    private async publishEvent() {
        if (!this.isDataValid()) {
            return; // Safety Rule: Do not publish price events if feed is STALE or CONNECTING
        }

        const trace = EventFactory.createTrace(
            `ws-${this.sequenceId}`, 
            `ws-agg-${this.lastMarketTimestamp}`,
            this.engineId,
            this.sequenceId
        );

        const priceEvent = EventFactory.createEvent(
            'REALTIME_PRICE_EVENT',
            this.robotId,
            1,
            trace,
            {
                symbol: this.symbol,
                price: this.lastPrice,
                eventTimestamp: this.lastMarketTimestamp,
                source: 'BINANCE_FUTURES_TRADE',
                sequenceId: this.sequenceId
            }
        );
        
        await coreEventBus.publish(priceEvent as any);
    }

    public stop() {
        if (this.ws) {
            try { this.ws.close(); } catch(e) {}
            this.ws = null;
        }
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        if (this.staleCheckInterval) clearInterval(this.staleCheckInterval);
        if (this.pingInterval) clearInterval(this.pingInterval);
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.status = 'DISCONNECTED';
    }

    private async logForensic(event: string) {
        console.log(JSON.stringify({
            event,
            robot_id: this.robotId,
            symbol: this.symbol,
            timestamp: Date.now()
        }));
        
        const trace = EventFactory.createTrace(
            `ws-sys-${Date.now()}`,
            'sys',
            this.engineId,
            0
        );

        const sysEvent = EventFactory.createEvent(
            event, // eventType = REALTIME_PRICE_FEED_CONNECTED etc
            this.robotId,
            1,
            trace,
            {
                symbol: this.symbol,
                status: this.status,
                timestamp: Date.now()
            }
        );
        
        await coreEventBus.publish(sysEvent as any);
    }
}

