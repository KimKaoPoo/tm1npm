export class ChoreStartTime {
    /** Utility class to handle time representation for Chore Start Time
     */

    private _datetime: Date;
    public tz?: string;

    constructor(year: number, month: number, day: number, hour: number, minute: number, second: number, tz?: string) {
        /**
         * :param year: year
         * :param month: month
         * :param day: day
         * :param hour: hour or None
         * :param minute: minute or None
         * :param second: second or None
         */
        this._datetime = new Date(year, month - 1, day, hour, minute, second); // month is 0-indexed in JS
        this.tz = tz;
    }

    public static fromString(startTimeString: string): ChoreStartTime {
        // extract optional tz info (e.g., +01:00) from string end
        let tz: string | undefined;
        if (startTimeString.includes('+')) {
            // case "2020-11-05T08:00:01+01:00",
            tz = "+" + startTimeString.split('+')[1];
        } else if (startTimeString.split('-').length === 4) {
            // case: "2020-11-05T08:00:01-01:00",
            const parts = startTimeString.split('-');
            tz = "-" + parts[parts.length - 1];
        } else {
            tz = undefined;
        }

        // f to handle strange timestamp 2016-09-25T20:25Z instead of common 2016-09-25T20:25:00Z
        // second is defaulted to 0 if not specified in the chore schedule
        const f = (x: string | undefined): number => x ? parseInt(x) : 0;
        
        return new ChoreStartTime(
            f(startTimeString.substring(0, 4)),
            f(startTimeString.substring(5, 7)),
            f(startTimeString.substring(8, 10)),
            f(startTimeString.substring(11, 13)),
            f(startTimeString.substring(14, 16)),
            startTimeString[16] !== ":" ? 0 : f(startTimeString.substring(17, 19)),
            tz
        );
    }

    public get startTimeString(): string {
        // produce timestamp 2016-09-25T20:25:00Z instead of common 2016-09-25T20:25Z where no seconds are specified
        const year = this._datetime.getFullYear().toString().padStart(4, '0');
        const month = (this._datetime.getMonth() + 1).toString().padStart(2, '0');
        const day = this._datetime.getDate().toString().padStart(2, '0');
        const hour = this._datetime.getHours().toString().padStart(2, '0');
        const minute = this._datetime.getMinutes().toString().padStart(2, '0');
        const second = this._datetime.getSeconds().toString().padStart(2, '0');
        
        let startTime = `${year}-${month}-${day}T${hour}:${minute}:${second}`;

        if (this.tz) {
            startTime += this.tz;
        } else {
            startTime += "Z";
        }

        return startTime;
    }

    public get datetime(): Date {
        return this._datetime;
    }

    public toString(): string {
        return this.startTimeString;
    }

    public setTime(
        year?: number, 
        month?: number, 
        day?: number, 
        hour?: number, 
        minute?: number,
        second?: number
    ): void {
        const _year = year !== undefined ? year : this._datetime.getFullYear();
        const _month = month !== undefined ? month - 1 : this._datetime.getMonth(); // month is 0-indexed
        const _day = day !== undefined ? day : this._datetime.getDate();
        const _hour = hour !== undefined ? hour : this._datetime.getHours();
        const _minute = minute !== undefined ? minute : this._datetime.getMinutes();
        const _second = second !== undefined ? second : this._datetime.getSeconds();

        this._datetime = new Date(_year, _month, _day, _hour, _minute, _second);
    }

    public add(days: number = 0, hours: number = 0, minutes: number = 0, seconds: number = 0): void {
        const totalMs = days * 24 * 60 * 60 * 1000 + 
                       hours * 60 * 60 * 1000 + 
                       minutes * 60 * 1000 + 
                       seconds * 1000;
        this._datetime = new Date(this._datetime.getTime() + totalMs);
    }

    public subtract(days: number = 0, hours: number = 0, minutes: number = 0, seconds: number = 0): void {
        const totalMs = days * 24 * 60 * 60 * 1000 + 
                       hours * 60 * 60 * 1000 + 
                       minutes * 60 * 1000 + 
                       seconds * 1000;
        this._datetime = new Date(this._datetime.getTime() - totalMs);
    }
}