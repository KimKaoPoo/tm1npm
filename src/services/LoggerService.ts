import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { formatUrl, CaseAndSpaceInsensitiveDict } from '../utils/Utils';

export class LoggerService extends ObjectService {
    /** Service to query and update loggers
     */

    constructor(rest: RestService) {
        super(rest);
    }

    
    public async getAll(): Promise<any[]> {
        const url = "/Loggers";
        const response = await this.rest.get(url);
        return response.data.value;
    }

    
    public async getAllNames(): Promise<string[]> {
        const loggers = await this.getAll();
        return loggers.map((logger: any) => logger.Name);
    }

    
    public async get(logger: string): Promise<any> {
        /** Get level for specified logger
         *
         * :param logger: string name of logger
         * :return: Dict of logger and level
         */
        const url = formatUrl("/Loggers('{}')", logger);
        const response = await this.rest.get(url);
        const loggerData = response.data;
        delete loggerData["@odata.context"];
        return loggerData;
    }

    
    public async search(wildcard: string = '', level: string = ''): Promise<any[]> {
        /** Searches logger names by wildcard or by level. Combining wildcard and level will filter via AND and not OR
         *
         * :param wildcard: string to match in logger name
         * :param level: string e.g. FATAL, ERROR, WARNING, INFO, DEBUG, UNKOWN, OFF
         * :return: Dict of matching loggers and levels
         */
        let url = "/Loggers";

        const loggerFilters: string[] = [];

        if (level) {
            const levelDict = new CaseAndSpaceInsensitiveDict([
                ['FATAL', 0], ['ERROR', 1], ['WARNING', 2], ['INFO', 3], ['DEBUG', 4], ['UNKNOWN', 5], ['OFF', 6]
            ]);
            const levelIndex = levelDict.get(level);
            if (levelIndex !== undefined) {
                loggerFilters.push(`Level eq ${levelIndex}`);
            }
        }

        if (wildcard) {
            loggerFilters.push(`contains(tolower(Name), tolower('${wildcard}'))`);
        }

        if (loggerFilters.length > 0) {
            url += `?$filter=${loggerFilters.join(" and ")}`;
        }

        const response = await this.rest.get(url);
        return response.data.value;
    }

    
    public async exists(logger: string): Promise<boolean> {
        /** Test if logger exists
         * :param logger: string name of logger
         * :return: bool
         */
        const url = formatUrl("/Loggers('{}')", logger);
        return await this._exists(url);
    }

    
    public async setLevel(logger: string, level: string): Promise<AxiosResponse> {
        /** Set logger level
         * :param logger: string name of logger
         * :param level: string e.g. FATAL, ERROR, WARNING, INFO, DEBUG, UNKOWN, OFF
         * :return: response
         */
        const url = formatUrl("/Loggers('{}')", logger);

        if (!(await this.exists(logger))) {
            throw new Error(`${logger} is not a valid logger`);
        }

        const levelDict = new CaseAndSpaceInsensitiveDict([
            ['FATAL', 0], ['ERROR', 1], ['WARNING', 2], ['INFO', 3], ['DEBUG', 4], ['UNKNOWN', 5], ['OFF', 6]
        ]);
        const levelIndex = levelDict.get(level);
        if (levelIndex !== undefined) {
            const loggerData = { 'Level': levelIndex };
            return await this.rest.patch(url, JSON.stringify(loggerData));
        } else {
            throw new Error(`${level} is not a valid level`);
        }
    }
}
