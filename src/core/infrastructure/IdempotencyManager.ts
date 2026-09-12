import * as fs from 'fs';
import * as path from 'path';

export interface IIdempotencyManager {
    acquireLock(signalId: string): Promise<{ acquired: boolean }>;
    updateState(signalId: string, state: string): Promise<void>;
    getState(signalId: string): Promise<string | null>;
}

export class FileIdempotencyManager implements IIdempotencyManager {
    private filePath: string;

    constructor() {
        this.filePath = path.resolve(process.cwd(), 'idempotency.json');
        if (!fs.existsSync(this.filePath)) {
            fs.writeFileSync(this.filePath, JSON.stringify({}));
        }
    }

    private readData(): any {
        try {
            const data = fs.readFileSync(this.filePath, 'utf8');
            return JSON.parse(data);
        } catch {
            return {};
        }
    }

    private writeData(data: any) {
        fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    }

    public async acquireLock(signalId: string): Promise<{ acquired: boolean }> {
        const data = this.readData();
        if (data[signalId]) {
            return { acquired: false };
        }
        data[signalId] = { state: 'PROCESSING', timestamp: Date.now() };
        this.writeData(data);
        return { acquired: true };
    }

    public async updateState(signalId: string, state: string): Promise<void> {
        const data = this.readData();
        if (data[signalId]) {
            data[signalId].state = state;
            this.writeData(data);
        }
    }

    public async getState(signalId: string): Promise<string | null> {
        const data = this.readData();
        return data[signalId] ? data[signalId].state : null;
    }
}
