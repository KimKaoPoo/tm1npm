import { TM1Object } from './TM1Object';
import { Rules } from './Rules';

export class Cube extends TM1Object {
    /** Abstraction of a TM1 Cube
     *        
     */

    private _name: string = '';
    private _dimensions: string[] = [];
    private _rules?: Rules;

    constructor(name: string, dimensions: Iterable<string>, rules?: string | Rules) {
        /**
         * 
         * :param name: name of the Cube
         * :param dimensions: list of (existing) dimension names
         * :param rules: instance of .Objects.Rules
         */
        super();
        this._name = name;
        this.dimensions = Array.from(dimensions);
        this.rules = rules;
    }

    public get name(): string {
        return this._name;
    }

    public get dimensions(): string[] {
        return this._dimensions;
    }

    public set dimensions(value: string[]) {
        this._dimensions = value;
    }

    public get hasRules(): boolean {
        if (this._rules) {
            return true;
        }
        return false;
    }

    public get rules(): Rules | undefined {
        return this._rules;
    }

    public set rules(value: string | Rules | undefined) {
        if (value === undefined || value === null) {
            this._rules = undefined;
        } else if (typeof value === 'string') {
            this._rules = new Rules(value);
        } else if (value instanceof Rules) {
            this._rules = value;
        } else {
            throw new Error('value must be undefined or of type string or Rules');
        }
    }

    public get skipcheck(): boolean {
        if (this.hasRules && this.rules) {
            return this.rules.skipcheck;
        }
        return false;
    }

    public get undefvals(): boolean {
        if (this.hasRules && this.rules) {
            return this.rules.undefvals;
        }
        return false;
    }

    public get feedstrings(): boolean {
        if (this.hasRules && this.rules) {
            return this.rules.feedstrings;
        }
        return false;
    }

    public static fromJSON(cubeAsJson: string): Cube {
        /** Alternative constructor
         *
         * :param cube_as_json: user as JSON string
         * :return: cube, an instance of this class
         */
        const cubeAsDict = JSON.parse(cubeAsJson);
        return Cube.fromDict(cubeAsDict);
    }

    public static fromDict(cubeAsDict: any): Cube {
        /** Alternative constructor
         *
         * :param cube_as_dict: user as dict
         * :return: user, an instance of this class
         */
        return new Cube(
            cubeAsDict.Name,
            cubeAsDict.Dimensions.map((dimension: any) => dimension.Name),
            cubeAsDict.Rules ? new Rules(cubeAsDict.Rules) : undefined
        );
    }

    public get body(): string {
        return JSON.stringify(this.constructBody());
    }

    public get bodyAsDict(): any {
        return this.constructBody();
    }

    private constructBody(): any {
        const body: any = {
            Name: this._name,
            Dimensions: this._dimensions.map(dim => ({ Name: dim }))
        };

        if (this._rules) {
            body.Rules = this._rules.text;
        }

        return body;
    }
}