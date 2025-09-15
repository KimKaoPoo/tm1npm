/**
 * Exception for timeout related errors
 */

import { TM1Exception } from './TM1Exception';

export class TM1TimeoutException extends TM1Exception {
    public timeout: number;

    constructor(message: string, timeout: number = 0) {
        super(message);
        this.name = 'TM1TimeoutException';
        this.timeout = timeout;
    }
}