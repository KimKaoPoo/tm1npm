/**
 * Exception for REST API related errors
 */

import { TM1Exception } from './TM1Exception';

export class TM1RestException extends TM1Exception {
    public status?: number;
    public response?: any;

    constructor(message: string, status?: number, response?: any) {
        super(message);
        this.name = 'TM1RestException';
        this.status = status;
        this.response = response;
    }
}