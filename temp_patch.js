const fs = require('fs');
const path = 'c:/A/Tradding AI/trading-platform/src/core/engine/runtime/RealtimePriceFeed.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Update FeedStatus
code = code.replace(
  "export type FeedStatus = 'CONNECTING' | 'CONNECTED' | 'STALE' | 'DISCONNECTED';",
  `export type FeedStatus = 'CONNECTING' | 'CONNECTED' | 'STALE' | 'RECONNECTING' | 'DISCONNECTED';

const WATCHDOG_THRESHOLD_MS = 15000;
const STALE_THRESHOLD_MS = 5000;
const RECONNECT_DELAY_MS = 3000;`
);

// 2. Add reconnectCount
code = code.replace(
  "private clockSkew: number | null = null;",
  "private clockSkew: number | null = null;\n    private reconnectCount: number = 0;"
);

// 3. Update isDataValid
code = code.replace(
  "this.lastMarketTimestamp <= 5000",
  "this.lastMarketTimestamp <= STALE_THRESHOLD_MS"
);

// 4. Update start() method's staleCheckInterval
const oldStart = `        // Stale check
        this.staleCheckInterval = setInterval(() => {
            if (this.status === 'CONNECTED' && this.clockSkew !== null) {
                const adjustedNow = Date.now() - this.clockSkew;
                if (this.lastMarketTimestamp <= 0 || adjustedNow - this.lastMarketTimestamp > 5000) {
                    this.status = 'STALE';
                    this.logForensic('REALTIME_PRICE_FEED_STALE');
                }
            }
        }, 1000);`;
        
const newStart = `        // Stale & Watchdog check
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
        }, 1000);`;
code = code.replace(oldStart, newStart);

// 5. Update connect()
code = code.replace(
  "this.logForensic('REALTIME_PRICE_FEED_CONNECTING');",
  "this.logForensic('REALTIME_FEED_CONNECTING');"
);
code = code.replace(
  "this.logForensic('REALTIME_PRICE_FEED_CONNECTED');",
  "this.logForensic('REALTIME_FEED_CONNECTED');"
);
code = code.replace(
  "this.logForensic('REALTIME_PRICE_PARSE_ERROR');",
  "this.logForensic('REALTIME_PARSE_ERROR');"
);

const oldOnClose = `        this.ws.onclose = () => {
            if (this.pingInterval) clearInterval(this.pingInterval);
            if (this.status !== 'DISCONNECTED') {
                this.status = 'DISCONNECTED';
                this.logForensic('REALTIME_PRICE_FEED_DISCONNECTED');
            }
            // Reconnect logic with basic backoff (fixed 3s for now as requested by stability)
            this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
        };`;
const newOnClose = `        this.ws.onclose = () => {
            if (this.pingInterval) clearInterval(this.pingInterval);
            if (this.status !== 'DISCONNECTED' && this.status !== 'RECONNECTING') {
                this.status = 'DISCONNECTED';
                this.logForensic('REALTIME_FEED_DISCONNECTED');
            }
            if (this.status !== 'RECONNECTING') {
                this.reconnectTimeout = setTimeout(() => this.reconnect('SOCKET_CLOSED'), RECONNECT_DELAY_MS);
            }
        };`;
code = code.replace(oldOnClose, newOnClose);

// 6. Add reconnect method
const reconnectMethod = `
    private reconnect(reason: string) {
        if (this.status === 'RECONNECTING') return;
        this.status = 'RECONNECTING';
        this.reconnectCount++;
        
        const age = (this.clockSkew !== null && this.lastMarketTimestamp > 0) ? (Date.now() - this.clockSkew - this.lastMarketTimestamp) : 0;
        this.logForensic('REALTIME_FEED_RECONNECT', { reason, previousAge: age, clockSkew: this.clockSkew, reconnectCount: this.reconnectCount });

        if (this.ws) {
            this.ws.onclose = null;
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

        // Delay slight to prevent tight loop
        setTimeout(() => this.connect(), 100);
    }
`;

// Insert reconnectMethod right before stop()
code = code.replace("    public stop() {", reconnectMethod + "    public stop() {");

// 7. Update logForensic
const oldLog = `    private async logForensic(event: string) {
        console.log(JSON.stringify({
            event,
            robot_id: this.robotId,
            symbol: this.symbol,
            timestamp: Date.now()
        }));`;
const newLog = `    private async logForensic(event: string, extraPayload: any = {}) {
        console.log(JSON.stringify({
            event,
            robot_id: this.robotId,
            symbol: this.symbol,
            timestamp: Date.now(),
            ...extraPayload
        }));`;
code = code.replace(oldLog, newLog);

code = code.replace(
  "                timestamp: Date.now()",
  "                timestamp: Date.now(),\n                ...extraPayload"
);

fs.writeFileSync(path, code);
console.log("Patched successfully!");
