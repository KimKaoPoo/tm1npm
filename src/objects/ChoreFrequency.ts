import { TM1Object } from './TM1Object';

export class ChoreFrequency extends TM1Object {
    /** Utility class to handle time representation fore Chore Frequency
     */

    private _days: string;
    private _hours: string;
    private _minutes: string;
    private _seconds: string;

    constructor(days: string | number, hours: string | number, minutes: string | number, seconds: string | number) {
        super();
        this._days = String(days).padStart(2, '0');
        this._hours = String(hours).padStart(2, '0');
        this._minutes = String(minutes).padStart(2, '0');
        this._seconds = String(seconds).padStart(2, '0');
    }

    public get days(): string {
        return this._days;
    }

    public get hours(): string {
        return this._hours;
    }

    public get minutes(): string {
        return this._minutes;
    }

    public get seconds(): string {
        return this._seconds;
    }

    public set days(value: string | number) {
        this._days = String(value).padStart(2, '0');
    }

    public set hours(value: string | number) {
        this._hours = String(value).padStart(2, '0');
    }

    public set minutes(value: string | number) {
        this._minutes = String(value).padStart(2, '0');
    }

    public set seconds(value: string | number) {
        this._seconds = String(value).padStart(2, '0');
    }

    public static fromString(frequencyString: string): ChoreFrequency {
        const posDt = frequencyString.indexOf('DT', 1);
        const posH = frequencyString.indexOf('H', posDt);
        const posM = frequencyString.indexOf('M', posH);
        const posS = frequencyString.length - 1;
        
        return new ChoreFrequency(
            frequencyString.substring(1, posDt),
            frequencyString.substring(posDt + 2, posH),
            frequencyString.substring(posH + 1, posM),
            frequencyString.substring(posM + 1, posS)
        );
    }

    public get frequencyString(): string {
        return `P${this._days}DT${this._hours}H${this._minutes}M${this._seconds}S`;
    }

    public get body(): string {
        return JSON.stringify({
            Days: this._days,
            Hours: this._hours,
            Minutes: this._minutes,
            Seconds: this._seconds,
            FrequencyString: this.frequencyString
        });
    }

    public toString(): string {
        return this.frequencyString;
    }
}