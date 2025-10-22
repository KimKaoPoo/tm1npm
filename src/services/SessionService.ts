import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { UserService } from './UserService';
import { formatUrl, caseAndSpaceInsensitiveEquals, requireAdmin } from '../utils/Utils';

export class SessionService extends ObjectService {
    /** Service to Query and Cancel Threads in TM1
     */

    private users: UserService;

    constructor(rest: RestService) {
        super(rest);
        this.users = new UserService(rest);
    }

    public async getAll(includeUser: boolean = true, includeThreads: boolean = true): Promise<any[]> {
        let url = "/Sessions";
        
        if (includeUser || includeThreads) {
            const expands: string[] = [];
            if (includeUser) {
                expands.push("User");
            }
            if (includeThreads) {
                expands.push("Threads");
            }
            url += "?$expand=" + expands.join(",");
        }

        const response = await this.rest.get(url);
        return response.data.value;
    }

    public async getCurrent(): Promise<any> {
        const url = "/ActiveSession";
        const response = await this.rest.get(url);
        return response.data.value;
    }

    public async getThreadsForCurrent(excludeIdle: boolean = true): Promise<any[]> {
        let url = "/ActiveSession/Threads?$filter=Function ne 'GET /ActiveSession/Threads'";
        if (excludeIdle) {
            url += " and State ne 'Idle'";
        }

        const response = await this.rest.get(url);
        return response.data.value;
    }

    public async close(sessionId: string): Promise<AxiosResponse> {
        const url = formatUrl("/Sessions('{}')/tm1.Close", sessionId);
        return await this.rest.post(url);
    }

    @requireAdmin
    public async closeAll(): Promise<any[]> {
        const currentUser = await this.users.getCurrent();
        const sessions = await this.getAll();
        const closedSessions: any[] = [];
        
        for (const session of sessions) {
            if (!("User" in session)) {
                continue;
            }
            if (session["User"] === null) {
                continue;
            }
            if (!("Name" in session["User"])) {
                continue;
            }
            if (caseAndSpaceInsensitiveEquals(currentUser.name, session["User"]["Name"])) {
                continue;
            }
            await this.close(session['ID']);
            closedSessions.push(session);
        }
        return closedSessions;
    }

}
