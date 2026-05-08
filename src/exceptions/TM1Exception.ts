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

export class TM1pyWriteFailureException extends TM1Exception {
    public statuses: string[];
    public errorLogFiles: (string | null)[];
    // Snake-case alias for callers porting code from tm1py (which exposes `error_log_files`).
    // Points at the SAME array as `errorLogFiles` so mutations stay in sync.
    public error_log_files: (string | null)[];

    constructor(statuses: string[], errorLogFiles: (string | null)[]) {
        super(
            `TM1 write failed. Statuses: ${JSON.stringify(statuses)}. ` +
            `ErrorLogFiles: ${JSON.stringify(errorLogFiles)}`
        );
        this.name = 'TM1pyWriteFailureException';
        this.statuses = statuses;
        this.errorLogFiles = errorLogFiles;
        this.error_log_files = errorLogFiles;
    }
}

export class TM1pyWritePartialFailureException extends TM1Exception {
    public statuses: string[];
    public errorLogFiles: (string | null)[];
    // Snake-case alias for tm1py compatibility (see TM1pyWriteFailureException above).
    public error_log_files: (string | null)[];
    public attempts: number;

    constructor(statuses: string[], errorLogFiles: (string | null)[], attempts: number) {
        super(
            `TM1 write partial failure (${statuses.length}/${attempts} chunks failed). ` +
            `Statuses: ${JSON.stringify(statuses)}. ErrorLogFiles: ${JSON.stringify(errorLogFiles)}`
        );
        this.name = 'TM1pyWritePartialFailureException';
        this.statuses = statuses;
        this.errorLogFiles = errorLogFiles;
        this.error_log_files = errorLogFiles;
        this.attempts = attempts;
    }
}