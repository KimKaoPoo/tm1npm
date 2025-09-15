import { RestService } from './RestService';

export abstract class ObjectService {
    protected rest: RestService;

    constructor(rest: RestService) {
        this.rest = rest;
    }

    protected formatUrl(template: string, ...args: string[]): string {
        let url = template;
        for (const arg of args) {
            url = url.replace('{}', encodeURIComponent(arg));
        }
        return url;
    }

    protected caseAndSpaceInsensitiveEquals(str1: string, str2: string): boolean {
        return str1.toLowerCase().replace(/\s+/g, '') === str2.toLowerCase().replace(/\s+/g, '');
    }
}