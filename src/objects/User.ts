import { TM1Object } from './TM1Object';
import { CaseAndSpaceInsensitiveSet, formatUrl } from '../utils/Utils';

export enum UserType {
    User = 0,
    SecurityAdmin = 1,
    DataAdmin = 2,
    Admin = 3,
    OperationsAdmin = 4
}

export class User extends TM1Object {
    /** Abstraction of a TM1 User
     * 
     */

    private _name: string;
    private _groups: CaseAndSpaceInsensitiveSet;
    private _friendlyName?: string;
    private _password?: string;
    private _enabled?: boolean;
    private _userType: UserType = UserType.User;

    constructor(
        name: string,
        groups: Iterable<string>,
        friendlyName?: string,
        password?: string,
        userType?: UserType | string,
        enabled?: boolean
    ) {
        super();
        this._name = name;
        this._groups = new CaseAndSpaceInsensitiveSet();
        for (const group of groups) {
            this._groups.add(group);
        }
        this._friendlyName = friendlyName;
        this._password = password;
        this._enabled = enabled;
        
        // determine user_type
        if (userType === undefined) {
            if (this._groups.has(UserType.Admin.toString())) {
                this.userType = UserType.Admin;
            } else if (this._groups.has(UserType.SecurityAdmin.toString())) {
                this.userType = UserType.SecurityAdmin;
            } else if (this._groups.has(UserType.DataAdmin.toString())) {
                this.userType = UserType.DataAdmin;
            } else if (this._groups.has(UserType.OperationsAdmin.toString())) {
                this.userType = UserType.OperationsAdmin;
            } else {
                this.userType = UserType.User;
            }
        } else {
            this.userType = userType;
        }
    }

    public get name(): string {
        return this._name;
    }

    public set name(value: string) {
        this._name = value;
    }

    public get userType(): UserType {
        return this._userType;
    }

    public set userType(value: UserType | string) {
        if (typeof value === 'string') {
            // Parse string to UserType enum
            const lowerValue = value.replace(/\s+/g, '').toLowerCase();
            for (const [key, enumValue] of Object.entries(UserType)) {
                if (key.toLowerCase() === lowerValue) {
                    this._userType = enumValue as UserType;
                    break;
                }
            }
            if (this._userType === undefined) {
                throw new Error(`Invalid element type=${value}`);
            }
        } else {
            this._userType = value;
        }

        // update groups as well, since TM1 doesn't react to change in user_type property
        if (this._userType !== UserType.User) {
            this.addGroup(this._userType.toString());
        }
    }

    public get friendlyName(): string | undefined {
        return this._friendlyName;
    }

    public set friendlyName(value: string | undefined) {
        this._friendlyName = value;
    }

    public get password(): string | undefined {
        return this._password;
    }

    public set password(value: string | undefined) {
        this._password = value;
    }

    public get isAdmin(): boolean {
        return this._groups.has("ADMIN");
    }

    public get isDataAdmin(): boolean {
        return this._groups.has("Admin") || this._groups.has("DataAdmin");
    }

    public get isSecurityAdmin(): boolean {
        return this._groups.has("Admin") || this._groups.has("SecurityAdmin");
    }

    public get isOpsAdmin(): boolean {
        return this._groups.has("Admin") || this._groups.has("OperationsAdmin");
    }

    public get groups(): string[] {
        return Array.from(this._groups);
    }

    public get enabled(): boolean | undefined {
        return this._enabled;
    }

    public set enabled(value: boolean | undefined) {
        this._enabled = value;
    }

    public addGroup(groupName: string): void {
        this._groups.add(groupName);
    }

    public removeGroup(groupName: string): void {
        this._groups.delete(groupName);
    }

    public static fromJSON(userAsJson: string): User {
        /** Alternative constructor
         *
         * :param user_as_json: user as JSON string
         * :return: user, an instance of this class
         */
        const userAsDict = JSON.parse(userAsJson);
        return User.fromDict(userAsDict);
    }

    public static fromDict(userAsDict: any): User {
        /** Alternative constructor
         *
         * :param user_as_dict: user as dict
         * :return: user, an instance of this class
         */
        return new User(
            userAsDict.Name,
            userAsDict.Groups.map((group: any) => group.Name),
            userAsDict.FriendlyName,
            undefined, // password not included in dict
            userAsDict.Type,
            userAsDict.Enabled
        );
    }

    public get body(): string {
        return this.constructBody();
    }

    public constructBody(): string {
        /**
         * construct body (json) from the class attributes
         * :return: String, TM1 JSON representation of a user
         */
        const bodyAsDict: any = {};
        bodyAsDict.Name = this.name;
        bodyAsDict.FriendlyName = this.friendlyName || this.name;
        bodyAsDict.Enabled = this._enabled;
        bodyAsDict.Type = this._userType.toString();
        
        if (this.password) {
            bodyAsDict.Password = this._password;
        }
        
        bodyAsDict['Groups@odata.bind'] = this.groups.map(group => 
            formatUrl("Groups('{}')", group)
        );
        
        return JSON.stringify(bodyAsDict);
    }
}