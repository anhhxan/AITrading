import { v4 as uuidv4 } from "uuid";

export class IdGenerator {
  private static mockIdBase: string | null = null;
  private static counter: number = 0;

  public static generate(): string {
    if (this.mockIdBase !== null) {
      this.counter++;
      return `${this.mockIdBase}-${this.counter}`;
    }
    return uuidv4();
  }

  public static setDeterministic(baseId: string): void {
    this.mockIdBase = baseId;
    this.counter = 0;
  }

  public static reset(): void {
    this.mockIdBase = null;
    this.counter = 0;
  }
}
