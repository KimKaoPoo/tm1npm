import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { User } from '../objects/User';
import { formatUrl, caseAndSpaceInsensitiveEquals, requireAdmin } from '../utils/Utils';

export class UserService extends ObjectService {

    constructor(rest: RestService) {
        super(rest);
    }

    public async getAll(): Promise<User[]> {
        /** Get all users
         *
         * :return: List of .User instances
         */
        const url = '/Users?$expand=Groups';
        const response = await this.rest.get(url);
        const users = response.data.value.map((user: any) => User.fromDict(user));
        return users;
    }

    public async getActive(): Promise<User[]> {
        /** Get the activate users in TM1
         *
         * :return: List of .User instances
         */
        const url = '/Users?$filter=IsActive eq true&$expand=Groups';
        const response = await this.rest.get(url);
        const users = response.data.value.map((user: any) => User.fromDict(user));
        return users;
    }

    public async isActive(userName: string): Promise<boolean> {
        /** Check if user is currently active in TM1
         *
         * :param user_name:
         * :return: Boolean
         */
        const url = formatUrl("/Users('{}')/IsActive", userName);
        const response = await this.rest.get(url);
        return Boolean(response.data.value);
    }

    public async disconnect(userName: string): Promise<AxiosResponse> {
        /** Disconnect User
         *
         * :param user_name:
         * :return:
         */
        const url = formatUrl("/Users('{}')/tm1.Disconnect", userName);
        const response = await this.rest.post(url);
        return response;
    }

    
    public async disconnectAll(): Promise<string[]> {
        const currentUser = await this.getCurrent();
        const activeUsers = await this.getActive();
        const disconnectedUsers: string[] = [];
        
        for (const activeUser of activeUsers) {
            if (!caseAndSpaceInsensitiveEquals(currentUser.name, activeUser.name)) {
                await this.disconnect(activeUser.name);
                disconnectedUsers.push(activeUser.name);
            }
        }
        return disconnectedUsers;
    }

    public async getCurrent(): Promise<User> {
        const { SecurityService } = await import('./SecurityService');
        const securityService = new SecurityService(this.rest);
        return await securityService.getCurrentUser();
    }
}