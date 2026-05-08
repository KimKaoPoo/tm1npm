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

// Format an array of strings the way Python str(list) does — a leading [, comma-and-space
// separated single-quoted entries, trailing ]. Used so the message wording matches tm1py
// (Exceptions.py:180,197-199) byte-for-byte.
function pyListRepr(items: (string | null)[]): string {
    const parts = items.map(item => {
        if (item === null) return 'None';
        return `'${item.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    });
    return `[${parts.join(', ')}]`;
}

export class TM1pyWriteFailureException extends TM1Exception {
    public statuses: string[];
    public errorLogFiles: (string | null)[];
    // Snake-case alias for callers porting code from tm1py (which exposes `error_log_files`).
    // Points at the SAME array as `errorLogFiles` so mutations stay in sync.
    public error_log_files: (string | null)[];

    constructor(statuses: string[], errorLogFiles: (string | null)[]) {
        // Mirror tm1py Exceptions.py:180 verbatim:
        //   f"All {len(self.statuses)} write operations failed. Details: {self.error_log_files}"
        super(`All ${statuses.length} write operations failed. Details: ${pyListRepr(errorLogFiles)}`);
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
        // Mirror tm1py Exceptions.py:197-199 verbatim:
        //   f"{len(self.statuses)} out of {self.attempts} write operations failed partially. "
        //   f"Details: {self.error_log_files}"
        super(
            `${statuses.length} out of ${attempts} write operations failed partially. ` +
            `Details: ${pyListRepr(errorLogFiles)}`
        );
        this.name = 'TM1pyWritePartialFailureException';
        this.statuses = statuses;
        this.errorLogFiles = errorLogFiles;
        this.error_log_files = errorLogFiles;
        this.attempts = attempts;
    }
}