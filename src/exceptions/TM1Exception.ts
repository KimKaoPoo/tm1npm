export class TM1Exception extends Error {
    public response?: any;
    public statusCode?: number;

    constructor(message: string, response?: any) {
        super(message);
        this.name = 'TM1Exception';
        this.response = response;
        this.statusCode = response?.status;
    }
}

export class TM1RestException extends TM1Exception {
    public status?: number;
    
    constructor(message: string, status?: number, response?: any) {
        super(message, response);
        this.name = 'TM1RestException';
        this.status = status;
    }
}

export class TM1TimeoutException extends TM1Exception {
    public timeout: number;
    
    constructor(message: string, timeout: number = 0) {
        super(message);
        this.name = 'TM1TimeoutException';
        this.timeout = timeout;
    }
}

export class TM1VersionDeprecationException extends TM1Exception {
    constructor(message: string) {
        super(message);
        this.name = 'TM1VersionDeprecationException';
    }
}