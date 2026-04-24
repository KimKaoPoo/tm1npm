import { User, UserType } from '../objects/User';
import { CaseAndSpaceInsensitiveSet } from '../utils/Utils';

describe('UserType — string enum (issue #61)', () => {
    test('should produce correct string names from toString()', () => {
        expect(UserType.User.toString()).toBe('User');
        expect(UserType.SecurityAdmin.toString()).toBe('SecurityAdmin');
        expect(UserType.DataAdmin.toString()).toBe('DataAdmin');
        expect(UserType.Admin.toString()).toBe('Admin');
        expect(UserType.OperationsAdmin.toString()).toBe('OperationsAdmin');
    });

    test('should serialize Type field as string name in body', () => {
        const user = new User('Alice', [], undefined, undefined, UserType.Admin);
        const body = JSON.parse(user.body);
        expect(body.Type).toBe('Admin');
    });

    test('should serialize User type as "User" string in body', () => {
        const user = new User('Alice', []);
        const body = JSON.parse(user.body);
        expect(body.Type).toBe('User');
    });

    test('should parse string value in userType setter', () => {
        const user = new User('Alice', []);
        user.userType = 'Admin';
        expect(user.userType).toBe(UserType.Admin);
    });

    test('should parse case-insensitive string in userType setter', () => {
        const user = new User('Alice', []);
        user.userType = 'admin';
        expect(user.userType).toBe(UserType.Admin);
    });

    test('should throw on invalid userType string', () => {
        const user = new User('Alice', []);
        expect(() => { user.userType = 'InvalidType'; }).toThrow();
    });
});

describe('User — group auto-detection (issue #61)', () => {
    test('should detect Admin type from groups', () => {
        const user = new User('Alice', ['Admin']);
        expect(user.userType).toBe(UserType.Admin);
    });

    test('should detect SecurityAdmin type from groups', () => {
        const user = new User('Alice', ['SecurityAdmin']);
        expect(user.userType).toBe(UserType.SecurityAdmin);
    });

    test('should detect DataAdmin type from groups', () => {
        const user = new User('Alice', ['DataAdmin']);
        expect(user.userType).toBe(UserType.DataAdmin);
    });

    test('should detect OperationsAdmin type from groups', () => {
        const user = new User('Alice', ['OperationsAdmin']);
        expect(user.userType).toBe(UserType.OperationsAdmin);
    });

    test('should default to User type when no special groups present', () => {
        const user = new User('Alice', ['Everyone', 'SomeTeam']);
        expect(user.userType).toBe(UserType.User);
    });

    test('should add correct string group when userType set to Admin', () => {
        const user = new User('Alice', []);
        user.userType = UserType.Admin;
        expect(user.groups).toContain('Admin');
    });

    test('should not add a group when userType set to User', () => {
        const user = new User('Alice', []);
        user.userType = UserType.User;
        expect(user.groups).toHaveLength(0);
    });
});

describe('User — isXxxAdmin getters (issue #61)', () => {
    test('should return true for isAdmin when Admin group present', () => {
        const user = new User('Alice', ['Admin']);
        expect(user.isAdmin).toBe(true);
    });

    test('should return false for isAdmin when Admin group absent', () => {
        const user = new User('Alice', ['Everyone']);
        expect(user.isAdmin).toBe(false);
    });

    test('should return true for isDataAdmin when Admin group present', () => {
        const user = new User('Alice', ['Admin']);
        expect(user.isDataAdmin).toBe(true);
    });

    test('should return true for isDataAdmin when DataAdmin group present', () => {
        const user = new User('Alice', ['DataAdmin']);
        expect(user.isDataAdmin).toBe(true);
    });

    test('should return true for isSecurityAdmin when SecurityAdmin group present', () => {
        const user = new User('Alice', ['SecurityAdmin']);
        expect(user.isSecurityAdmin).toBe(true);
    });

    test('should return true for isOpsAdmin when OperationsAdmin group present', () => {
        const user = new User('Alice', ['OperationsAdmin']);
        expect(user.isOpsAdmin).toBe(true);
    });
});

describe('User.fromDict — Type field parsing (issue #61)', () => {
    test('should parse Type string field from API response dict', () => {
        const dict = {
            Name: 'Alice',
            FriendlyName: 'Alice',
            Groups: [{ Name: 'Admin' }],
            Type: 'Admin',
            Enabled: true,
        };
        const user = User.fromDict(dict);
        expect(user.userType).toBe(UserType.Admin);
    });

    test('should parse SecurityAdmin Type field from API response dict', () => {
        const dict = {
            Name: 'Bob',
            FriendlyName: 'Bob',
            Groups: [{ Name: 'SecurityAdmin' }],
            Type: 'SecurityAdmin',
            Enabled: true,
        };
        const user = User.fromDict(dict);
        expect(user.userType).toBe(UserType.SecurityAdmin);
    });
});

describe('CaseAndSpaceInsensitiveSet — casing preservation (issue #61)', () => {
    test('should preserve original casing of first insertion', () => {
        const set = new CaseAndSpaceInsensitiveSet();
        set.add('Admin');
        set.add('ADMIN');
        set.add('admin');
        expect(set.size).toBe(1);
        expect(Array.from(set)).toEqual(['Admin']);
    });

    test('should find by any casing variant', () => {
        const set = new CaseAndSpaceInsensitiveSet();
        set.add('HelloWorld');
        expect(set.has('helloworld')).toBe(true);
        expect(set.has('HELLOWORLD')).toBe(true);
        expect(set.has('Hello World')).toBe(true);
        expect(set.has('hello world')).toBe(true);
    });

    test('should return first-inserted casing during iteration', () => {
        const set = new CaseAndSpaceInsensitiveSet();
        set.add('MyGroup');
        set.add('mygroup');
        set.add('MYGROUP');
        expect(Array.from(set)).toEqual(['MyGroup']);
    });

    test('should delete by any casing variant', () => {
        const set = new CaseAndSpaceInsensitiveSet();
        set.add('Admin');
        expect(set.delete('ADMIN')).toBe(true);
        expect(set.size).toBe(0);
        expect(set.has('Admin')).toBe(false);
    });

    test('should return false when deleting non-existent entry', () => {
        const set = new CaseAndSpaceInsensitiveSet();
        expect(set.delete('NonExistent')).toBe(false);
    });

    test('should maintain correct size after operations', () => {
        const set = new CaseAndSpaceInsensitiveSet();
        set.add('A');
        set.add('B');
        set.add('a'); // duplicate — ignored
        expect(set.size).toBe(2);
        set.delete('A');
        expect(set.size).toBe(1);
    });

    test('should clear all entries', () => {
        const set = new CaseAndSpaceInsensitiveSet();
        set.add('A');
        set.add('B');
        set.clear();
        expect(set.size).toBe(0);
        expect(set.has('A')).toBe(false);
    });

    test('should handle values with spaces', () => {
        const set = new CaseAndSpaceInsensitiveSet();
        set.add('Data Admin');
        expect(set.has('dataadmin')).toBe(true);
        expect(set.has('DataAdmin')).toBe(true);
        expect(Array.from(set)).toEqual(['Data Admin']);
    });
});
