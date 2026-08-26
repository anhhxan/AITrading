export class SequenceAuthority {
    private static sequences: Map<string, number> = new Map();

    public static next(robotId: string): number {
        const seq = (this.sequences.get(robotId) || 0) + 1;
        this.sequences.set(robotId, seq);
        return seq;
    }

    public static current(robotId: string): number {
        return this.sequences.get(robotId) || 0;
    }

    public static reset(robotId: string): void {
        this.sequences.delete(robotId);
    }
}
