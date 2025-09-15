import { TM1Object } from './TM1Object';

export abstract class View extends TM1Object {
    /** Abstraction of TM1 View
     *     serves as a parentclass for .Objects.MDXView and .Objects.NativeView
     *
     */

    protected _cube: string;
    protected _name: string;

    constructor(cube: string, name: string) {
        super();
        this._cube = cube;
        this._name = name;
    }

    public abstract get body(): string;

    public get cube(): string {
        return this._cube;
    }

    public get name(): string {
        return this._name;
    }

    public set cube(value: string) {
        this._cube = value;
    }

    public set name(value: string) {
        this._name = value;
    }

    public get mdx(): string {
        throw new Error("NotImplementedError");
    }
}

// Re-export the concrete classes
export { MDXView } from './MDXView';
export { NativeView } from './NativeView';