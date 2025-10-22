import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { User } from '../objects/User';
import { formatUrl, CaseAndSpaceInsensitiveSet } from '../utils/Utils';
import { ProcessService } from './ProcessService';

export class SecurityService extends ObjectService {
    /** Service to handle Security stuff
     * 
     */

    constructor(rest: RestService) {
        super(rest);
    }

    public async determineActualUserName(userName: string): Promise<string> {
        return await this.determineActualObjectName("Users", userName);
    }

    public async determineActualGroupName(groupName: string): Promise<string> {
        return await this.determineActualObjectName("Groups", groupName);
    }

    
    public async createUser(user: User): Promise<AxiosResponse> {
        /** Create a user on TM1 Server
         *
         * :param user: instance of .User
         * :return: response
         */
        const url = '/Users';
        return await this.rest.post(url, user.body);
    }

    
    public async createGroup(groupName: string): Promise<AxiosResponse> {
        /** Create a Security group in the TM1 Server
         *
         * :param group_name:
         * :return:
         */
        const url = '/Groups';
        return await this.rest.post(url, JSON.stringify({ Name: groupName }));
    }

    public async getUser(userName: string): Promise<User> {
        /** Get user from TM1 Server
         *
         * :param user_name:
         * :return: instance of .User
         */
        const actualUserName = await this.determineActualUserName(userName);
        const url = formatUrl(
            "/Users('{}')?$select=Name,FriendlyName,Password,Type,Enabled&$expand=Groups",
            actualUserName);
        const response = await this.rest.get(url);
        return User.fromDict(response.data);
    }

    public async getCurrentUser(): Promise<User> {
        /** Get user and group assignments of this session
         *
         * :return: instance of .User
         */
        const url = "/ActiveUser?$select=Name,FriendlyName,Password,Type,Enabled&$expand=Groups";
        const response = await this.rest.get(url);
        return User.fromDict(response.data);
    }

    
    public async updateUser(user: User): Promise<AxiosResponse> {
        /** Update user on TM1 Server
         *
         * :param user: instance of .User
         * :return: response
         */
        user.name = await this.determineActualUserName(user.name);
        const currentGroups = await this.getGroups(user.name);
        
        for (const currentGroup of currentGroups) {
            if (!user.groups.includes(currentGroup)) {
                await this.removeUserFromGroup(currentGroup, user.name);
            }
        }
        
        const url = formatUrl("/Users('{}')", user.name);
        return await this.rest.patch(url, user.body);
    }

    public async updateUserPassword(userName: string, password: string): Promise<AxiosResponse> {
        const url = formatUrl("/Users('{}')", userName);
        const body = { Password: password };
        return await this.rest.patch(url, JSON.stringify(body));
    }

    
    public async deleteUser(userName: string): Promise<AxiosResponse> {
        /** Delete user on TM1 Server
         *
         * :param user_name:
         * :return: response
         */
        const actualUserName = await this.determineActualUserName(userName);
        const url = formatUrl("/Users('{}')", actualUserName);
        return await this.rest.delete(url);
    }

    
    public async deleteGroup(groupName: string): Promise<AxiosResponse> {
        /** Delete a Security group in the TM1 Server
         *
         * :param group_name:
         * :return: response
         */
        const actualGroupName = await this.determineActualGroupName(groupName);
        const url = formatUrl("/Groups('{}')", actualGroupName);
        return await this.rest.delete(url);
    }

    public async getUserNames(): Promise<string[]> {
        /** Get all user names
         *
         * :return: List of user names
         */
        const url = "/Users?$select=Name";
        const response = await this.rest.get(url);
        return response.data.value.map((user: any) => user.Name);
    }

    public async getAllUserNames(): Promise<string[]> {
        return await this.getUserNames();
    }

    public async getGroupNames(): Promise<string[]> {
        /** Get all group names
         *
         * :return: List of group names
         */
        const url = "/Groups?$select=Name";
        const response = await this.rest.get(url);
        return response.data.value.map((group: any) => group.Name);
    }

    public async getAllGroups(): Promise<string[]> {
        return await this.getGroupNames();
    }

    public async getAllUsers(): Promise<User[]> {
        /** Get all users
         *
         * :return: List of User instances
         */
        const url = "/Users?$select=Name,FriendlyName,Password,Type,Enabled&$expand=Groups";
        const response = await this.rest.get(url);
        return response.data.value.map((userDict: any) => User.fromDict(userDict));
    }

    public async getGroups(userName?: string): Promise<string[]> {
        /** Get groups for a user or all groups
         *
         * :param user_name: Optional user name
         * :return: List of group names
         */
        if (userName) {
            const actualUserName = await this.determineActualUserName(userName);
            const url = formatUrl("/Users('{}')/Groups?$select=Name", actualUserName);
            const response = await this.rest.get(url);
            return response.data.value.map((group: any) => group.Name);
        } else {
            return await this.getGroupNames();
        }
    }

    public async getUsersFromGroup(groupName: string): Promise<string[]> {
        /** Get users that belong to a group
         *
         * :param group_name: name of the group
         * :return: List of user names
         */
        const actualGroupName = await this.determineActualGroupName(groupName);
        const url = formatUrl("/Groups('{}')/Users?$select=Name", actualGroupName);
        const response = await this.rest.get(url);
        return response.data.value.map((user: any) => user.Name);
    }

    public async getUserNamesFromGroup(groupName: string): Promise<string[]> {
        return await this.getUsersFromGroup(groupName);
    }

    
    public async addUserToGroups(userName: string, groupNames: string[]): Promise<AxiosResponse[]> {
        /** Add user to multiple groups
         *
         * :param user_name: name of the user
         * :param group_names: list of group names
         * :return: list of responses
         */
        const responses: AxiosResponse[] = [];
        for (const groupName of groupNames) {
            const response = await this.addUserToGroup(groupName, userName);
            responses.push(response);
        }
        return responses;
    }

    
    public async addUserToGroup(groupName: string, userName: string): Promise<AxiosResponse> {
        /** Add user to a group
         *
         * :param group_name: name of the group
         * :param user_name: name of the user
         * :return: response
         */
        const actualGroupName = await this.determineActualGroupName(groupName);
        const actualUserName = await this.determineActualUserName(userName);
        
        const url = formatUrl("/Groups('{}')/Users", actualGroupName);
        const body = {
            '@odata.id': `Users('${actualUserName}')`
        };
        return await this.rest.post(url, JSON.stringify(body));
    }

    
    public async removeUserFromGroup(groupName: string, userName: string): Promise<AxiosResponse> {
        /** Remove user from a group
         *
         * :param group_name: name of the group
         * :param user_name: name of the user
         * :return: response
         */
        const actualGroupName = await this.determineActualGroupName(groupName);
        const actualUserName = await this.determineActualUserName(userName);
        
        const url = formatUrl("/Groups('{}')/Users('{}')", actualGroupName, actualUserName);
        return await this.rest.delete(url);
    }

    
    public async getSecurityRefreshTime(): Promise<number> {
        /** Get security refresh time in seconds
         *
         * :return: security refresh time
         */
        const url = "/StaticConfiguration/ServerSettings('SecurityRefreshTime')";
        const response = await this.rest.get(url);
        return parseInt(response.data.Value);
    }

    public async userExists(userName: string): Promise<boolean> {
        /** Check if user exists
         *
         * :param user_name: name of the user
         * :return: True if user exists
         */
        try {
            await this.getUser(userName);
            return true;
        } catch {
            return false;
        }
    }

    public async groupExists(groupName: string): Promise<boolean> {
        /** Check if group exists
         *
         * :param group_name: name of the group
         * :return: True if group exists
         */
        try {
            const actualGroupName = await this.determineActualGroupName(groupName);
            const url = formatUrl("/Groups('{}')", actualGroupName);
            await this.rest.get(url);
            return true;
        } catch {
            return false;
        }
    }

    public async securityRefresh(): Promise<any> {
        const processService = new ProcessService(this.rest);
        return await processService.executeTiCode(['SecurityRefresh;']);
    }

    public async getCustomSecurityGroups(): Promise<string[]> {
        const groups = new CaseAndSpaceInsensitiveSet(...await this.getGroupNames());
        groups.delete('Admin');
        groups.delete('DataAdmin');
        groups.delete('SecurityAdmin');
        groups.delete('OperationsAdmin');
        groups.delete('}tp_Everyone');
        return Array.from(groups);
    }

    public async getReadOnlyUsers(): Promise<string[]> {
        const mdx = `
        SELECT
        {[}ClientProperties].[ReadOnlyUser]} ON COLUMNS,
        NON EMPTY {[}Clients].MEMBERS} ON ROWS
        FROM [}ClientProperties]
        `;

        const response = await this.rest.post('/ExecuteMDX', { MDX: mdx });
        const axes = response.data?.Axes || [];
        const rowsAxis = axes.length > 1 ? axes[1] : axes[0];
        const tuples = rowsAxis?.Tuples || [];
        const cells = response.data?.Cells || [];

        const readOnlyUsers: string[] = [];

        for (let i = 0; i < tuples.length; i++) {
            const tuple = tuples[i];
            const member = tuple?.Members?.[0];
            const userName = member?.Name || member?.Element?.Name || member?.UniqueName;
            const value = cells[i]?.Value;

            if (userName && value) {
                readOnlyUsers.push(userName);
            }
        }

        return readOnlyUsers;
    }

}
