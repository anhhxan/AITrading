import { BaseEvent, EventFactory } from '../../infrastructure/EventFactory';
import { coreEventBus } from '@/core/infrastructure/EventBus';
import { SequenceAuthority } from '../../infrastructure/SequenceAuthority';

export interface RealtimePriceEvent extends BaseEvent {
    symbol: string;
    price: number;
    eventTimestamp: number;
    source: string;
    sequenceId: number;
}

export type FeedStatus = 'CONNECTING' | 'CONNECTED' | 'STALE' | 'RECONNECTING' | 'DISCONNECTED';

const WATCHDOG_THRESHOLD_MS = 15000;
const STALE_THRESHOLD_MS = 5000;
const RECONNECT_DELAY_MS = 3000;

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

    private engineId = 'RealtimePriceFeed_1';

    constructor(robotId: string, symbol: string) {
        this.robotId = robotId;
        this.symbol = symbol;
    }

    private heartbeatInterval: any = null;

    private clockSkew: number | null = null;
    private reconnectCount: number = 0;

    public isDataValid(): boolean {
        return this.status === 'CONNECTED' &&
               this.lastPrice > 0 &&
               this.lastMarketTimestamp > 0 &&
               (this.clockSkew !== null && (Date.now() - this.clockSkew) - this.lastMarketTimestamp <= STALE_THRESHOLD_MS);
    }

    public start() {
        if (this.status === 'CONNECTED' || this.status === 'CONNECTING') return;
        this.logForensic('REALTIME_FEED_STARTED');
        this.connect();

        // Stale & Watchdog check
        this.staleCheckInterval = setInterval(() => {
            if (this.clockSkew !== null && this.lastMarketTimestamp > 0) {
                const adjustedNow = Date.now() - this.clockSkew;
                const age = adjustedNow - this.lastMarketTimestamp;
                
                if (age > WATCHDOG_THRESHOLD_MS) {
                    if (this.status !== 'RECONNECTING') {
                        this.reconnect('WATCHDOG_TIMEOUT');
                    }
                } else if (age > STALE_THRESHOLD_MS && this.status === 'CONNECTED') {
                    this.status = 'STALE';
                    this.logForensic('REALTIME_FEED_STALE');
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
        const seq = SequenceAuthority.next(this.robotId);
        const trace = EventFactory.createTrace(
            `ws-heartbeat-${seq}`,
            `ws-agg-${this.lastMarketTimestamp}`,
            this.engineId,
            seq
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
        this.clockSkew = null;
        if (this.ws) {
            try { this.ws.close(); } catch(e) {}
            this.ws = null;
        }

        const streamSymbol = this.symbol.replace('BINANCE:', '').toLowerCase();

        const wsUrl = `wss://fstream.binance.com/ws/${streamSymbol}@trade`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            this.status = 'CONNECTING';
            this.logForensic('REALTIME_FEED_CONNECTING');

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
                        if (this.clockSkew === null) {
                            this.clockSkew = Date.now() - timestamp;
                            console.log(`[RealtimePriceFeed] Detected clock skew: ${this.clockSkew}ms`);
                        }

                        this.lastPrice = price;
                        this.lastMarketTimestamp = timestamp; // Event time

                        if (this.status === 'STALE' || this.status === 'DISCONNECTED' || this.status === 'CONNECTING' || this.status === 'RECONNECTING') {
                            this.status = 'CONNECTED';
                            this.logForensic('REALTIME_FEED_CONNECTED');
                        }

                        this.publishEvent();
                    }
                }
            } catch (err) {
                console.error(`[RealtimePriceFeed] JSON parse error:`, err);
                this.logForensic('REALTIME_PARSE_ERROR');
            }
        };

        this.ws.onclose = () => {
            if (this.pingInterval) clearInterval(this.pingInterval);
            if (this.status !== 'DISCONNECTED' && this.status !== 'RECONNECTING') {
                this.status = 'DISCONNECTED';
                this.logForensic('REALTIME_FEED_DISCONNECTED');
            }
            if (this.status !== 'RECONNECTING') {
                this.reconnectTimeout = setTimeout(() => this.reconnect('SOCKET_CLOSED'), RECONNECT_DELAY_MS);
            }
        };

        this.ws.onerror = (err: any) => {
            console.error(`[RealtimePriceFeed] WebSocket error for ${this.symbol}:`, err);
        };
    }

    private async publishEvent() {
        if (!this.isDataValid()) {
            return; // Safety Rule: Do not publish price events if feed is STALE or CONNECTING
        }

        const seq = SequenceAuthority.next(this.robotId);
        const trace = EventFactory.createTrace(
            `ws-${seq}`,
            `ws-agg-${this.lastMarketTimestamp}`,
            this.engineId,
            seq
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
                sequenceId: seq
            }
        );

        await coreEventBus.publish(priceEvent as any);
    }

    private reconnect(reason: string) {
        if (this.status === 'RECONNECTING') return;
        this.status = 'RECONNECTING';
        this.reconnectCount++;
        
        const age = (this.clockSkew !== null && this.lastMarketTimestamp > 0) ? (Date.now() - this.clockSkew - this.lastMarketTimestamp) : 0;
        this.logForensic('REALTIME_FEED_RECONNECT', { reason, previousAge: age, clockSkew: this.clockSkew, reconnectCount: this.reconnectCount });

        if (this.ws) {
            this.ws.onclose = null; // Prevent onclose from firing and triggering the 3s timeout again
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws.onopen = null;
            try { this.ws.close(); } catch(e) {}
            this.ws = null;
        }

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        // Delay slightly to prevent tight loop
        setTimeout(() => this.connect(), 100);
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

    private async logForensic(event: string, extraPayload: any = {}) {
        console.log(JSON.stringify({
            event,
            robot_id: this.robotId,
            symbol: this.symbol,
            timestamp: Date.now(),
            ...extraPayload
        }));

        const seq = SequenceAuthority.next(this.robotId);
        const trace = EventFactory.createTrace(
            `ws-sys-${Date.now()}`,
            'sys',
            this.engineId,
            seq
        );

        const sysEvent = EventFactory.createEvent(
            event,
            this.robotId,
            1,
            trace,
            {
                symbol: this.symbol,
                status: this.status,
                timestamp: Date.now(),
                ...extraPayload
            }
        );

        await coreEventBus.publish(sysEvent as any);
    }
}
