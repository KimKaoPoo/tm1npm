import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { User } from '../objects/User';
import { ThreadService } from './ThreadService';
import { SessionService } from './SessionService';
import { UserService } from './UserService';

export class MonitoringService extends ObjectService {
    /** Service to Query and Cancel Threads in TM1
     */

    public users: UserService;
    public threads: ThreadService;
    public session: SessionService;

    constructor(rest: RestService) {
        super(rest);
        console.warn("Monitoring Service will be moved to a new location in a future version");
        this.users = new UserService(rest);
        this.threads = new ThreadService(rest);
        this.session = new SessionService(rest);
    }

    public async getThreads(): Promise<any[]> {
        /** Return a dict of the currently running threads from the TM1 Server
         *
         *    :return:
         *        dict: the response
         */
        return await this.threads.getAll();
    }

    public async getActiveThreads(): Promise<any[]> {
        /**Return a list of non-idle threads from the TM1 Server
         *
         *    :return:
         *        list: TM1 threads as dict
         */
        return await this.threads.getActive();
    }

    public async cancelThread(threadId: number): Promise<AxiosResponse> {
        /** Kill a running thread
         * 
         * :param thread_id: 
         * :return: 
         */
        return await this.threads.cancel(threadId);
    }

    public async cancelAllRunningThreads(): Promise<any[]> {
        return await this.threads.cancelAllRunning();
    }

    public async getActiveUsers(): Promise<User[]> {
        /** Get the activate users in TM1
         *
         * :return: List of .User instances
         */
        return await this.users.getActive();
    }

    public async userIsActive(userName: string): Promise<boolean> {
        /** Check if user is currently active in TM1
         *
         * :param user_name:
         * :return: Boolean
         */
        return await this.users.isActive(userName);
    }

    public async disconnectUser(userName: string): Promise<AxiosResponse> {
        /** Disconnect User
         * 
         * :param user_name: 
         * :return: 
         */
        return await this.users.disconnect(userName);
    }

    public async getActiveSessionThreads(excludeIdle: boolean = true): Promise<any[]> {
        return await this.session.getThreadsForCurrent(excludeIdle);
    }

    public async getSessions(includeUser: boolean = true, includeThreads: boolean = true): Promise<any[]> {
        return await this.session.getAll(includeUser, includeThreads);
    }

    public async disconnectAllUsers(): Promise<string[]> {
        return await this.users.disconnectAll();
    }

    public async closeSession(sessionId: string): Promise<AxiosResponse> {
        return await this.session.close(sessionId);
    }

    public async closeAllSessions(): Promise<any[]> {
        return await this.session.closeAll();
    }

    public async getCurrentUser(): Promise<User> {
        return await this.users.getCurrent();
    }
}