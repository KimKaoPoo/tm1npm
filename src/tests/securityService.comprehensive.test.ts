/**
 * Comprehensive SecurityService Tests
 * Target: Achieve 80%+ coverage for SecurityService (currently 5.88%)
 * Testing all security operations including users, groups, permissions
 */

import { SecurityService } from '../services/SecurityService';
import { RestService } from '../services/RestService';
import { User } from '../objects/User';

// Mock dependencies
jest.mock('../objects/User');

describe('SecurityService - Comprehensive Tests', () => {
    let securityService: SecurityService;
    let mockRestService: jest.Mocked<RestService>;
    
    const mockResponse = (data: any) => ({
        data: data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} }
    } as any);

    const mockUser = {
        name: 'testuser',
        password: 'password123',
        groups: ['TM1ConnectionPool'],
        body: {
            Name: 'testuser',
            Password: 'password123',
            Groups: [{ Name: 'TM1ConnectionPool' }]
        }
    } as any;

    beforeEach(() => {
        mockRestService = {
            get: jest.fn(),
            post: jest.fn(),
            patch: jest.fn(),
            put: jest.fn(),
            delete: jest.fn()
        } as any;

        securityService = new SecurityService(mockRestService);
        
        // Note: determineActualObjectName is private method, tested through public methods
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Constructor and Initialization', () => {
        test('should initialize SecurityService properly', () => {
            expect(securityService).toBeDefined();
            expect(securityService).toBeInstanceOf(SecurityService);
        });
    });

    describe('User Name and Group Name Operations', () => {
        test('should determine actual user name', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ 
                value: [{ Name: 'ActualUserName' }] 
            }));

            const result = await securityService.determineActualUserName('TestUser');
            expect(result).toBe('ActualUserName');
        });

        test('should determine actual group name', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ 
                value: [{ Name: 'ActualGroupName' }] 
            }));

            const result = await securityService.determineActualGroupName('TestGroup');
            expect(result).toBe('ActualGroupName');
        });

        test('should handle special characters in user names', async () => {
            const specialUserName = 'user@domain.com';
            mockRestService.get.mockResolvedValue(mockResponse({ 
                value: [{ Name: specialUserName }] 
            }));
            
            const result = await securityService.determineActualUserName(specialUserName);
            expect(result).toBe(specialUserName);
        });

        test('should handle special characters in group names', async () => {
            const specialGroupName = 'Domain\\AdminGroup';
            mockRestService.get.mockResolvedValue(mockResponse({ 
                value: [{ Name: specialGroupName }] 
            }));
            
            const result = await securityService.determineActualGroupName(specialGroupName);
            expect(result).toBe(specialGroupName);
        });
    });

    describe('User CRUD Operations', () => {
        test('should create user successfully', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const result = await securityService.createUser(mockUser);
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith('/Users', mockUser.body);
        });

        test('should get user by name', async () => {
            const userData = {
                Name: 'testuser',
                Groups: [{ Name: 'TM1ConnectionPool' }]
            };
            mockRestService.get.mockResolvedValue(mockResponse(userData));

            // Mock User.fromDict
            const mockUserFromDict = jest.fn().mockReturnValue(mockUser);
            (User as any).fromDict = mockUserFromDict;

            // Mock determineActualUserName to return the input name
            jest.spyOn(securityService as any, 'determineActualUserName').mockResolvedValue('testuser');

            await securityService.getUser('testuser');

            expect(mockUserFromDict).toHaveBeenCalledWith(userData);
            expect(mockRestService.get).toHaveBeenCalledWith("/Users('testuser')?$select=Name,FriendlyName,Password,Type,Enabled&$expand=Groups");
        });

        test('should get current user', async () => {
            const currentUserData = {
                Name: 'admin',
                Groups: [{ Name: 'ADMIN' }]
            };
            mockRestService.get.mockResolvedValue(mockResponse(currentUserData));
            
            const mockUserFromDict = jest.fn().mockReturnValue(mockUser);
            (User as any).fromDict = mockUserFromDict;

            await securityService.getCurrentUser();

            expect(mockUserFromDict).toHaveBeenCalledWith(currentUserData);
            expect(mockRestService.get).toHaveBeenCalledWith("/ActiveUser?$select=Name,FriendlyName,Password,Type,Enabled&$expand=Groups");
        });

        test('should update user', async () => {
            // Mock determineActualUserName call
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'testuser' }] 
            }));
            // Mock getGroups call (SecurityService.getGroups calls determineActualUserName again then gets groups)
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'testuser' }] 
            }));
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'TM1ConnectionPool' }] 
            }));
            mockRestService.patch.mockResolvedValue(mockResponse({}));

            const result = await securityService.updateUser(mockUser);
            
            expect(result).toBeDefined();
            expect(mockRestService.patch).toHaveBeenCalledWith("/Users('testuser')", mockUser.body);
        });

        test('should update user password', async () => {
            mockRestService.patch.mockResolvedValue(mockResponse({}));

            const result = await securityService.updateUserPassword('testuser', 'newpassword123');
            
            expect(result).toBeDefined();
            expect(mockRestService.patch).toHaveBeenCalledWith(
                "/Users('testuser')", 
                JSON.stringify({ Password: 'newpassword123' })
            );
        });

        test('should delete user', async () => {
            // Mock determineActualUserName call
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'testuser' }] 
            }));
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const result = await securityService.deleteUser('testuser');
            
            expect(result).toBeDefined();
            expect(mockRestService.delete).toHaveBeenCalledWith("/Users('testuser')");
        });

        test('should check if user exists', async () => {
            const userData = {
                Name: 'testuser',
                Groups: [{ Name: 'TM1ConnectionPool' }]
            };
            mockRestService.get.mockResolvedValue(mockResponse(userData));

            // Mock User.fromDict
            const mockUserFromDict = jest.fn().mockReturnValue(mockUser);
            (User as any).fromDict = mockUserFromDict;

            // Mock determineActualUserName to return the input name
            jest.spyOn(securityService as any, 'determineActualUserName').mockResolvedValue('testuser');

            const result = await securityService.userExists('testuser');
            
            expect(result).toBe(true);
        });

        test('should return false when user does not exist', async () => {
            mockRestService.get.mockRejectedValue(new Error('User not found'));

            const result = await securityService.userExists('nonexistent');
            
            expect(result).toBe(false);
        });

        test('should check if group exists', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ value: [{ Name: 'TestGroup' }] }));

            const result = await securityService.groupExists('testgroup');
            
            expect(result).toBe(true);
        });

        test('should return false when group does not exist', async () => {
            mockRestService.get.mockRejectedValue(new Error('Group not found'));

            const result = await securityService.groupExists('nonexistent');
            
            expect(result).toBe(false);
        });
    });

    describe('Group Operations', () => {
        test('should create group successfully', async () => {
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const result = await securityService.createGroup('TestGroup');
            
            expect(result).toBeDefined();
            expect(mockRestService.post).toHaveBeenCalledWith('/Groups', JSON.stringify({ Name: 'TestGroup' }));
        });

        test('should delete group', async () => {
            // Mock determineActualGroupName call
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'TestGroup' }] 
            }));
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const result = await securityService.deleteGroup('TestGroup');
            
            expect(result).toBeDefined();
            expect(mockRestService.delete).toHaveBeenCalledWith("/Groups('TestGroup')");
        });

        test('should get all group names', async () => {
            const groupsData = {
                value: [
                    { Name: 'ADMIN' },
                    { Name: 'TM1ConnectionPool' },
                    { Name: 'PowerUser' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(groupsData));

            const result = await securityService.getGroupNames();
            
            expect(result).toEqual(['ADMIN', 'TM1ConnectionPool', 'PowerUser']);
            expect(mockRestService.get).toHaveBeenCalledWith("/Groups?$select=Name");
        });

        test('should get users from group', async () => {
            // Mock determineActualGroupName call
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'PowerUser' }] 
            }));
            // Mock getUsersFromGroup call
            const usersData = {
                value: [
                    { Name: 'admin' },
                    { Name: 'poweruser1' },
                    { Name: 'poweruser2' }
                ]
            };
            mockRestService.get.mockResolvedValueOnce(mockResponse(usersData));

            const result = await securityService.getUsersFromGroup('PowerUser');
            
            expect(result).toEqual(['admin', 'poweruser1', 'poweruser2']);
        });

        test('should get groups for user', async () => {
            // Mock determineActualUserName call
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'testuser' }] 
            }));
            // Mock getGroups call
            const groupsData = {
                value: [
                    { Name: 'TM1ConnectionPool' },
                    { Name: 'PowerUser' }
                ]
            };
            mockRestService.get.mockResolvedValueOnce(mockResponse(groupsData));

            const result = await securityService.getGroups('testuser');
            
            expect(result).toEqual(['TM1ConnectionPool', 'PowerUser']);
        });

        test('should get all groups when no user specified', async () => {
            const allGroupsData = {
                value: [
                    { Name: 'ADMIN' },
                    { Name: 'TM1ConnectionPool' },
                    { Name: 'PowerUser' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(allGroupsData));

            const result = await securityService.getGroups();
            
            expect(result).toEqual(['ADMIN', 'TM1ConnectionPool', 'PowerUser']);
            expect(mockRestService.get).toHaveBeenCalledWith("/Groups?$select=Name");
        });
    });

    describe('User-Group Relationship Operations', () => {
        test('should add user to multiple groups', async () => {
            // Mock determineActualGroupName calls for both groups
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'PowerUser' }] 
            }));
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'testuser' }] 
            }));
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'DataEntry' }] 
            }));
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'testuser' }] 
            }));
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const groupNames = ['PowerUser', 'DataEntry'];
            const results = await securityService.addUserToGroups('testuser', groupNames);
            
            expect(results).toHaveLength(2);
            expect(mockRestService.post).toHaveBeenCalledTimes(2);
        });

        test('should add user to single group', async () => {
            // Mock determineActualGroupName call
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'PowerUser' }] 
            }));
            // Mock determineActualUserName call
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'testuser' }] 
            }));
            mockRestService.post.mockResolvedValue(mockResponse({}));

            const result = await securityService.addUserToGroup('PowerUser', 'testuser');
            
            expect(result).toBeDefined();
        });

        test('should remove user from group', async () => {
            // Mock determineActualGroupName call
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'PowerUser' }] 
            }));
            // Mock determineActualUserName call
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'testuser' }] 
            }));
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            const result = await securityService.removeUserFromGroup('PowerUser', 'testuser');
            
            expect(result).toBeDefined();
        });

        test('should handle empty group list when adding user to groups', async () => {
            const results = await securityService.addUserToGroups('testuser', []);
            
            expect(results).toEqual([]);
            expect(mockRestService.post).not.toHaveBeenCalled();
        });
    });

    describe('User and Group Listing Operations', () => {
        test('should get all user names', async () => {
            const usersData = {
                value: [
                    { Name: 'admin' },
                    { Name: 'user1' },
                    { Name: 'user2' }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(usersData));

            const result = await securityService.getUserNames();
            
            expect(result).toEqual(['admin', 'user1', 'user2']);
            expect(mockRestService.get).toHaveBeenCalledWith("/Users?$select=Name");
        });

        test('should get all users with full details', async () => {
            const usersData = {
                value: [
                    { Name: 'admin', Groups: [{ Name: 'ADMIN' }] },
                    { Name: 'user1', Groups: [{ Name: 'PowerUser' }] }
                ]
            };
            mockRestService.get.mockResolvedValue(mockResponse(usersData));

            const mockUserFromDict = jest.fn().mockImplementation((data) => ({ name: data.Name }));
            (User as any).fromDict = mockUserFromDict;

            const result = await securityService.getAllUsers();
            
            expect(result).toHaveLength(2);
            expect(mockUserFromDict).toHaveBeenCalledTimes(2);
            expect(mockRestService.get).toHaveBeenCalledWith("/Users?$select=Name,FriendlyName,Password,Type,Enabled&$expand=Groups");
        });
    });

    describe('Security Configuration Operations', () => {
        test('should get security refresh time', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ Value: 300 }));

            const result = await securityService.getSecurityRefreshTime();
            
            expect(result).toBe(300);
            expect(mockRestService.get).toHaveBeenCalledWith("/StaticConfiguration/ServerSettings('SecurityRefreshTime')");
        });
    });



    describe('Error Handling', () => {
        test('should handle user creation errors', async () => {
            const error = new Error('User already exists');
            mockRestService.post.mockRejectedValue(error);

            await expect(securityService.createUser(mockUser)).rejects.toThrow('User already exists');
        });

        test('should handle user retrieval errors', async () => {
            const error = new Error('User not found');
            mockRestService.get.mockRejectedValue(error);

            await expect(securityService.getUser('nonexistent')).rejects.toThrow('User not found');
        });

        test('should handle group creation errors', async () => {
            const error = new Error('Group already exists');
            mockRestService.post.mockRejectedValue(error);

            await expect(securityService.createGroup('ExistingGroup')).rejects.toThrow('Group already exists');
        });
    });

    describe('Edge Cases and Special Scenarios', () => {
        test('should handle empty results gracefully', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ value: [] }));

            // Mock determineActualGroupName to return the input name
            jest.spyOn(securityService as any, 'determineActualGroupName').mockResolvedValue('EmptyGroup');

            const userNames = await securityService.getUserNames();
            const groupNames = await securityService.getGroupNames();
            const usersFromGroup = await securityService.getUsersFromGroup('EmptyGroup');

            expect(userNames).toEqual([]);
            expect(groupNames).toEqual([]);
            expect(usersFromGroup).toEqual([]);
        });

        test('should handle special characters in names', async () => {
            const specialName = "user@domain.com";
            // Mock determineActualGroupName call
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'Domain\\Group' }] 
            }));
            // Mock determineActualUserName call
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: specialName }] 
            }));
            mockRestService.post.mockResolvedValue(mockResponse({}));

            await securityService.addUserToGroup('Domain\\Group', specialName);
            
            // The formatUrl function URL-encodes backslashes, so expect the encoded version
            expect(mockRestService.post).toHaveBeenCalledWith(
                "/Groups('Domain%5CGroup')/Users",
                JSON.stringify({ '@odata.id': `Users('${specialName}')` })
            );
        });

        test('should handle case sensitivity in group operations', async () => {
            // Mock determineActualGroupName calls for both groups
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'admin' }] 
            }));
            mockRestService.get.mockResolvedValueOnce(mockResponse({ value: [] }));
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'ADMIN' }] 
            }));
            mockRestService.get.mockResolvedValueOnce(mockResponse({ value: [] }));

            await securityService.getUsersFromGroup('admin');
            await securityService.getUsersFromGroup('ADMIN');
            
            expect(mockRestService.get).toHaveBeenCalledTimes(4);
        });

        test('should handle null and undefined parameters', async () => {
            mockRestService.get.mockResolvedValue(mockResponse({ value: [] }));

            // These should not throw errors
            await expect(securityService.getGroups(undefined)).resolves.toBeDefined();
            
            expect(mockRestService.get).toHaveBeenCalledWith("/Groups?$select=Name");
        });

        test('should handle large user/group lists', async () => {
            const largeUserList = Array.from({ length: 10000 }, (_, i) => ({ Name: `user${i}` }));
            mockRestService.get.mockResolvedValue(mockResponse({ value: largeUserList }));

            const result = await securityService.getUserNames();
            
            expect(result).toHaveLength(10000);
            expect(result[0]).toBe('user0');
            expect(result[9999]).toBe('user9999');
        });
    });

    describe('Security Integration Patterns', () => {
        test('should support user lifecycle management', async () => {
            // Mock for addUserToGroup - determineActualGroupName call
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'PowerUser' }] 
            }));
            // Mock for addUserToGroup - determineActualUserName call
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'testuser' }] 
            }));
            // Mock for removeUserFromGroup - determineActualGroupName call
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'PowerUser' }] 
            }));
            // Mock for removeUserFromGroup - determineActualUserName call
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'testuser' }] 
            }));
            // Mock for deleteUser - determineActualUserName call
            mockRestService.get.mockResolvedValueOnce(mockResponse({ 
                value: [{ Name: 'testuser' }] 
            }));
            
            mockRestService.post.mockResolvedValue(mockResponse({}));
            mockRestService.patch.mockResolvedValue(mockResponse({}));
            mockRestService.delete.mockResolvedValue(mockResponse({}));

            // Create user
            await securityService.createUser(mockUser);
            
            // Add to group
            await securityService.addUserToGroup('PowerUser', 'testuser');
            
            // Update password
            await securityService.updateUserPassword('testuser', 'newpassword');
            
            // Remove from group
            await securityService.removeUserFromGroup('PowerUser', 'testuser');
            
            // Delete user
            await securityService.deleteUser('testuser');

            expect(mockRestService.post).toHaveBeenCalledTimes(2);
            expect(mockRestService.patch).toHaveBeenCalledTimes(1);
            expect(mockRestService.delete).toHaveBeenCalledTimes(2);
        });
    });
});