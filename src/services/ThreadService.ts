import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { formatUrl, verifyVersion, deprecatedInVersion } from '../utils/Utils';

export class ThreadService extends ObjectService {
    /** Service to work with Threads in TM1
     * Deprecated as of TM1 Server v12
     */
    constructor(rest: RestService) {
        super(rest);
        if (rest.version && verifyVersion(rest.version, '12.0.0')) {
            // warn only due to use in Monitoring Service
            console.warn("Threads not available in this version of TM1, removed as of 12.0.0");
        }
    }

    @deprecatedInVersion("12.0.0")
    public async getAll(): Promise<any[]> {
        /** Return a list of the currently running threads from the TM1 Server
         *
         *    :return:
         *        dict: the response
         */
        const url = '/Threads';
        const response = await this.rest.get(url);
        return response.data.value;
    }

    @deprecatedInVersion("12.0.0")
    public async getActive(): Promise<any[]> {
        /**Return a list of non-idle threads from the TM1 Server
         *
         *    :return:
         *        list: TM1 threads as dict
         */
        const url = "/Threads?$filter=Function ne 'GET /Threads' and State ne 'Idle'";
        const response = await this.rest.get(url);
        return response.data.value;
    }

    @deprecatedInVersion("12.0.0")
    public async cancel(threadId: number): Promise<AxiosResponse> {
        /** Kill a running thread
         *
         * :param thread_id:
         * :return:
         */
        const url = formatUrl("/Threads('{}')/tm1.CancelOperation", threadId.toString());
        const response = await this.rest.post(url);
        return response;
    }

    @deprecatedInVersion("12.0.0")
    public async cancelAllRunning(): Promise<any[]> {
        const runningThreads = await this.getAll();
        const canceledThreads: any[] = [];
        
        for (const thread of runningThreads) {
            if (thread["State"] === "Idle") {
                continue;
            }
            if (thread["Type"] === "System") {
                continue;
            }
            if (thread["Name"] === "Pseudo") {
                continue;
            }
            if (thread["Function"] === "GET /Threads") {
                continue;
            }
            if (thread["Function"] === "GET /api/v1/Threads") {
                continue;
            }
            await this.cancel(thread["ID"]);
            canceledThreads.push(thread);
        }
        return canceledThreads;
    }
}
