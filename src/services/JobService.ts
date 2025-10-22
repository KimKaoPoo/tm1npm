import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { formatUrl, requireVersion } from '../utils/Utils';

export class JobService extends ObjectService {
    /** Service to handle TM1 Job objects introduced in v12
     */

    constructor(rest: RestService) {
        super(rest);
    }

    @requireVersion("12.0.0")
    public async getAll(): Promise<any[]> {
        /** Return a dict of the currently running jobs from the TM1 Server
         *
         *    :return:
         *        dict: the response
         */
        const url = '/Jobs';
        const response = await this.rest.get(url);
        return response.data.value;
    }

    @requireVersion("12.0.0")
    public async cancel(jobId: string | number): Promise<AxiosResponse> {
        /** Cancels a running Job
         *
         * :param job_id:
         * :return:
         */
        const url = formatUrl("/Jobs('{}')/tm1.Cancel", jobId.toString());
        const response = await this.rest.post(url);
        return response;
    }

    @requireVersion("12.0.0")
    public async cancelAll(): Promise<any[]> {
        const jobs = await this.getAll();
        const canceledJobs: any[] = [];
        
        for (const job of jobs) {
            await this.cancel(job["ID"]);
            canceledJobs.push(job);
        }
        
        return canceledJobs;
    }

    @requireVersion("12.0.0")
    public async getAsDataFrame(): Promise<any[]> {
        /** Gets jobs and returns them as an array (equivalent to dataframe)
         * Note: In JavaScript/TypeScript, we return array of objects instead of pandas DataFrame
         */
        const jobs = await this.getAll();
        return jobs;
    }

    // snake_case aliases for tm1py parity
    public async get_all(): Promise<any[]> {
        return this.getAll();
    }

    public async cancel_all(): Promise<any[]> {
        return this.cancelAll();
    }

    public async get_as_dataframe(): Promise<any[]> {
        return this.getAsDataFrame();
    }
}
