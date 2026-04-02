/**
 * ElementService Tests — Issue #38 new methods
 */

import { ElementService } from '../services/ElementService';
import { RestService } from '../services/RestService';
import { ElementAttribute } from '../objects/ElementAttribute';

const createMockResponse = (data: any, status: number = 200) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : status === 204 ? 'No Content' : 'Error',
    headers: {},
    config: {} as any
});

describe('ElementService — Issue #38 new methods', () => {
    let elementService: ElementService;
    let mockRestService: jest.Mocked<RestService>;

    beforeEach(() => {
        mockRestService = {
            get: jest.fn(),
            post: jest.fn(),
            patch: jest.fn(),
            delete: jest.fn(),
            put: jest.fn(),
            config: {} as any,
            rest: {} as any,
            buildBaseUrl: jest.fn(),
            extractErrorMessage: jest.fn()
        } as any;

        elementService = new ElementService(mockRestService);
    });

    // ===== addElementAttributes =====

    describe('addElementAttributes', () => {
        test('should POST to ElementAttributes endpoint with correct body', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201));

            const attrs = [
                new ElementAttribute('Description', 'String'),
                new ElementAttribute('Score', 'Numeric')
            ];

            await elementService.addElementAttributes('TestDimension', 'TestHierarchy', attrs);

            expect(mockRestService.post).toHaveBeenCalledTimes(1);
            const [url, body] = mockRestService.post.mock.calls[0];

            expect(url).toContain("Dimensions('TestDimension')/Hierarchies('TestHierarchy')/ElementAttributes");

            const parsed = JSON.parse(body);
            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed).toHaveLength(2);
            expect(parsed[0].Name).toBe('Description');
            expect(parsed[0].Type).toBe('String');
            expect(parsed[1].Name).toBe('Score');
            expect(parsed[1].Type).toBe('Numeric');
        });

        test('should POST an empty array when no attributes provided', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201));

            await elementService.addElementAttributes('TestDimension', 'TestHierarchy', []);

            expect(mockRestService.post).toHaveBeenCalledTimes(1);
            const [, body] = mockRestService.post.mock.calls[0];
            const parsed = JSON.parse(body);
            expect(parsed).toEqual([]);
        });

        test('should POST a single attribute', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201));

            const attrs = [new ElementAttribute('Alias', 'Alias')];

            await elementService.addElementAttributes('Dim', 'Hier', attrs);

            const [, body] = mockRestService.post.mock.calls[0];
            const parsed = JSON.parse(body);
            expect(parsed).toHaveLength(1);
            expect(parsed[0].Name).toBe('Alias');
            expect(parsed[0].Type).toBe('Alias');
        });

        test('should include dimension and hierarchy names in the URL', async () => {
            mockRestService.post.mockResolvedValue(createMockResponse({}, 201));

            await elementService.addElementAttributes(
                'MyDimension',
                'MyHierarchy',
                [new ElementAttribute('Attr1', 'String')]
            );

            const [url] = mockRestService.post.mock.calls[0];
            expect(url).toContain("MyDimension");
            expect(url).toContain("MyHierarchy");
        });
    });
});
