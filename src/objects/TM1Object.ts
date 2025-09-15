export abstract class TM1Object {
    public static readonly SANDBOX_DIMENSION = "Sandboxes";

    public abstract get body(): string;

    public toString(): string {
        return this.body;
    }

    public toJSON(): any {
        return JSON.parse(this.body);
    }

    public equals(other: TM1Object): boolean {
        return this.body === other.body;
    }
}