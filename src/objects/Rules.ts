import { TM1Object } from './TM1Object';

export class Rules extends TM1Object {
    /**
     *     Abstraction of Rules on a cube.
     *
     *     rules_analytics
     *         A collection of rulestatements, where each statement is stored in uppercase without linebreaks.
     *         comments are not included.
     *
     */
    public static readonly KEYWORDS = ['SKIPCHECK', 'FEEDSTRINGS', 'UNDEFVALS', 'FEEDERS'];

    private _text: string;
    private _rulesAnalytics: string[] = [];

    constructor(rules: string) {
        super();
        this._text = rules;
        this._rulesAnalytics = [];
        this.initAnalytics();
    }

    // this._rulesAnalytics serves for analysis on cube rules
    private initAnalytics(): void {
        const textWithoutComments = this._text
            .split('\n')
            .filter(rule => rule.trim().length > 0 && rule.trim()[0] !== '#')
            .join('\n');

        for (const statement of textWithoutComments.split(';')) {
            if (statement.trim().length > 0) {
                this._rulesAnalytics.push(statement.replace(/\n/g, '').toUpperCase());
            }
        }
    }

    public get text(): string {
        return this._text;
    }

    public get rulesAnalytics(): string[] {
        return this._rulesAnalytics;
    }

    public get ruleStatements(): string[] {
        if (this.hasFeeders) {
            return this.rulesAnalytics.slice(0, this._rulesAnalytics.indexOf('FEEDERS'));
        }
        return this.rulesAnalytics;
    }

    public get feederStatements(): string[] {
        if (this.hasFeeders) {
            return this.rulesAnalytics.slice(this._rulesAnalytics.indexOf('FEEDERS') + 1);
        }
        return [];
    }

    public get skipcheck(): boolean {
        for (const rule of this._rulesAnalytics.slice(0, 5)) {
            if (rule === 'SKIPCHECK') {
                return true;
            }
        }
        return false;
    }

    public get undefvals(): boolean {
        for (const rule of this._rulesAnalytics.slice(0, 5)) {
            if (rule === 'UNDEFVALS') {
                return true;
            }
        }
        return false;
    }

    public get feedstrings(): boolean {
        for (const rule of this._rulesAnalytics.slice(0, 5)) {
            if (rule === 'FEEDSTRINGS') {
                return true;
            }
        }
        return false;
    }

    public get hasFeeders(): boolean {
        if (this._rulesAnalytics.includes('FEEDERS')) {
            // has feeders declaration
            const feeders = this.rulesAnalytics.slice(this._rulesAnalytics.indexOf('FEEDERS'));
            // has at least one actual feeder statement
            return feeders.length > 1;
        }
        return false;
    }

    public get body(): string {
        return JSON.stringify(this.bodyAsDict);
    }

    public get bodyAsDict(): any {
        return { Rules: this.text };
    }

    public get length(): number {
        return this.rulesAnalytics.length;
    }

    // iterate through actual rule statements without linebreaks. Ignore comments.
    public *[Symbol.iterator](): Iterator<string> {
        yield* this.rulesAnalytics;
    }

    public toString(): string {
        return this.text;
    }
}