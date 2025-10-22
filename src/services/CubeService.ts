import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { Cube } from '../objects/Cube';
import { Rules } from '../objects/Rules';
import { CellService } from './CellService';
import { ViewService } from './ViewService';
import { formatUrl, caseAndSpaceInsensitiveEquals } from '../utils/Utils';
import { TM1RestException } from '../exceptions/TM1Exception';

export class CubeService extends ObjectService {
    /** Service to handle Object Updates for TM1 Cubes
     *
     */

    public cells: CellService;
    public views: ViewService;
    public annotations: any; // AnnotationService - to avoid circular dependency

    constructor(rest: RestService) {
        // to avoid Circular dependency of modules
        // const AnnotationService = require('./AnnotationService').AnnotationService;
        super(rest);
        this.cells = new CellService(rest);
        this.views = new ViewService(rest);
        // this.annotations = new AnnotationService(rest);
    }

    public async create(cube: Cube): Promise<AxiosResponse> {
        /** create new cube on TM1 Server
         *
         * :param cube: instance of .Cube
         * :return: response
         */
        const url = "/Cubes";
        return await this.rest.post(url, cube.body);
    }

    public async update(cube: Cube): Promise<AxiosResponse> {
        const url = formatUrl("/Cubes('{}')", cube.name);
        return await this.rest.patch(url, cube.body);
    }

    public async updateOrCreate(cube: Cube): Promise<AxiosResponse> {
        if (await this.exists(cube.name)) {
            return await this.update(cube);
        }
        return await this.create(cube);
    }

    public async get(cubeName: string): Promise<Cube> {
        /** get cube from TM1 Server
         *
         * :param cube_name:
         * :return: instance of .Cube
         */
        const url = formatUrl("/Cubes('{}')?$expand=Dimensions($select=Name)", cubeName);
        const response = await this.rest.get(url);
        const cube = Cube.fromJSON(JSON.stringify(response.data));
        // cater for potential EnableSandboxDimension=T setup
        if (caseAndSpaceInsensitiveEquals(cube.dimensions[0], "Sandboxes")) {
            cube.dimensions = cube.dimensions.slice(1);
        }
        return cube;
    }

    public async delete(cubeName: string): Promise<AxiosResponse> {
        const url = formatUrl("/Cubes('{}')", cubeName);
        return await this.rest.delete(url);
    }

    public async getLastDataUpdate(cubeName: string): Promise<string> {
        const url = formatUrl("/Cubes('{}')/LastDataUpdate/$value", cubeName);
        const response = await this.rest.get(url);
        return response.data;
    }

    public async getAll(): Promise<Cube[]> {
        /** get all cubes from TM1 Server as .Cube instances
         *
         * :return: List of .Cube instances
         */
        const url = "/Cubes?$expand=Dimensions($select=Name)";
        const response = await this.rest.get(url);
        const cubes = response.data.value.map((cube: any) => Cube.fromDict(cube));
        return cubes;
    }

    public async getModelCubes(): Promise<Cube[]> {
        /** Get all Cubes without } prefix from TM1 Server as .Cube instances
         *
         * :return: List of .Cube instances
         */
        const url = "/ModelCubes()?$expand=Dimensions($select=Name)";
        const response = await this.rest.get(url);
        const cubes = response.data.value.map((cube: any) => Cube.fromDict(cube));
        return cubes;
    }

    public async getControlCubes(): Promise<Cube[]> {
        /** Get all Cubes with } prefix from TM1 Server as .Cube instances
         *
         * :return: List of .Cube instances
         */
        const url = "/ControlCubes()?$expand=Dimensions($select=Name)";
        const response = await this.rest.get(url);
        const cubes = response.data.value.map((cube: any) => Cube.fromDict(cube));
        return cubes;
    }

    public async getAllNames(skipControlCubes: boolean = false): Promise<string[]> {
        /** Get all cube names from TM1 Server
         *
         * :param skipControlCubes: exclude control cubes (cubes with } prefix)
         * :return: Array of cube names
         */
        let url = "/Cubes?$select=Name";
        
        if (skipControlCubes) {
            url += "&$filter=not startswith(Name,'}')";
        }

        const response = await this.rest.get(url);
        return response.data.value.map((cube: any) => cube.Name);
    }

    public async exists(cubeName: string): Promise<boolean> {
        const url = formatUrl("/Cubes('{}')", cubeName);
        try {
            await this.rest.get(url);
            return true;
        } catch (error) {
            if (error instanceof TM1RestException && error.statusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    public async getNumberOfCubes(skipControlCubes: boolean = false): Promise<number> {
        /** Ask TM1 Server for count of cubes
         *
         * :skip_control_cubes: bool, True will exclude control cubes from count
         * :return: int, count
         */
        if (skipControlCubes) {
            const response = await this.rest.get(formatUrl("/ModelCubes()?$select=Name&$top=0&$count"));
            return parseInt(response.data['@odata.count']);
        }

        const response = await this.rest.get(formatUrl("/Cubes/$count"));
        return parseInt(response.data);
    }

    public async searchForDimensionSubstring(substring: string, skipControlCubes: boolean = false): Promise<{[cubeName: string]: string[]}> {
        /** Search cubes that contain dimensions with specific substring
         *
         * :param substring: substring to search for in dimension names
         * :param skip_control_cubes: exclude control cubes
         * :return: dictionary with cube names as keys and matching dimension names as values
         */
        const cubes = skipControlCubes ? await this.getModelCubes() : await this.getAll();
        const results: {[cubeName: string]: string[]} = {};

        for (const cube of cubes) {
            const matchingDimensions = cube.dimensions.filter(dim => 
                dim.toLowerCase().includes(substring.toLowerCase())
            );
            
            if (matchingDimensions.length > 0) {
                results[cube.name] = matchingDimensions;
            }
        }

        return results;
    }

    public async searchForRuleSubstring(
        substring: string, 
        skipControlCubes: boolean = false, 
        caseInsensitive: boolean = true, 
        spaceInsensitive: boolean = true
    ): Promise<Cube[]> {
        /** Search cubes by rules substring
         *
         * :param substring: substring to search for in rules
         * :param skip_control_cubes: exclude control cubes
         * :param case_insensitive: ignore case when searching
         * :param space_insensitive: ignore spaces when searching
         * :return: List of cubes containing the substring in rules
         */
        const cubes = skipControlCubes ? await this.getModelCubes() : await this.getAll();
        const results: Cube[] = [];

        let searchString = substring;
        if (caseInsensitive) searchString = searchString.toLowerCase();
        if (spaceInsensitive) searchString = searchString.replace(/\s+/g, '');

        for (const cube of cubes) {
            if (cube.rules && cube.rules.text) {
                let ruleText = cube.rules.text;
                if (caseInsensitive) ruleText = ruleText.toLowerCase();
                if (spaceInsensitive) ruleText = ruleText.replace(/\s+/g, '');

                if (ruleText.includes(searchString)) {
                    results.push(cube);
                }
            }
        }

        return results;
    }

    public async getStorageDimensionOrder(cubeName: string): Promise<string[]> {
        /** Get storage dimension order for a cube
         *
         * :param cube_name: name of the cube
         * :return: ordered list of dimension names
         */
        const url = formatUrl("/Cubes('{}')/Dimensions?$select=Name", cubeName);
        const response = await this.rest.get(url);
        return response.data.value.map((dim: any) => dim.Name);
    }

    public async updateStorageDimensionOrder(cubeName: string, dimensionNames: string[]): Promise<AxiosResponse> {
        /** Update storage dimension order for a cube
         *
         * :param cube_name: name of the cube
         * :param dimension_names: ordered list of dimension names
         * :return: response
         */
        const url = formatUrl("/Cubes('{}')/tm1.UpdateStorageOrder", cubeName);
        const body = { Dimensions: dimensionNames };
        return await this.rest.post(url, body);
    }

    public async getRandomIntersection(cubeName: string, uniqueNames: boolean = false): Promise<string[]> {
        /** Get a random intersection from cube
         *
         * :param cube_name: name of the cube
         * :param unique_names: return unique names instead of element names
         * :return: list of element names representing random intersection
         */
        const url = formatUrl("/Cubes('{}')/tm1.GetRandomIntersection", cubeName) + 
                   (uniqueNames ? "?uniqueNames=true" : "");
        const response = await this.rest.get(url);
        return response.data.value || [];
    }

    // Memory Management Functions
    public async load(cubeName: string): Promise<AxiosResponse> {
        /** Load cube into memory
         *
         * :param cube_name: name of the cube
         * :return: response
         */
        const url = formatUrl("/Cubes('{}')/tm1.Load", cubeName);
        return await this.rest.post(url);
    }

    public async unload(cubeName: string): Promise<AxiosResponse> {
        /** Unload cube from memory
         *
         * :param cube_name: name of the cube
         * :return: response
         */
        const url = formatUrl("/Cubes('{}')/tm1.Unload", cubeName);
        return await this.rest.post(url);
    }

    public async lock(cubeName: string): Promise<AxiosResponse> {
        /** Lock cube
         *
         * :param cube_name: name of the cube
         * :return: response
         */
        const url = formatUrl("/Cubes('{}')/tm1.Lock", cubeName);
        return await this.rest.post(url);
    }

    public async unlock(cubeName: string): Promise<AxiosResponse> {
        /** Unlock cube
         *
         * :param cube_name: name of the cube
         * :return: response
         */
        const url = formatUrl("/Cubes('{}')/tm1.Unlock", cubeName);
        return await this.rest.post(url);
    }

    public async cubeSaveData(cubeName: string): Promise<AxiosResponse> {
        /** Save cube data to disk
         *
         * :param cube_name: name of the cube
         * :return: response
         */
        const url = formatUrl("/Cubes('{}')/tm1.SaveData", cubeName);
        return await this.rest.post(url);
    }

    public async getVmm(cubeName: string): Promise<number> {
        /** Get view storage max memory for cube
         *
         * :param cube_name: name of the cube
         * :return: view storage max memory value
         */
        const url = formatUrl("/Cubes('{}')/ViewStorageMaxMemory/$value", cubeName);
        const response = await this.rest.get(url);
        return parseInt(response.data) || 0;
    }

    public async setVmm(cubeName: string, vmm: number): Promise<AxiosResponse> {
        /** Set view storage max memory for cube
         *
         * :param cube_name: name of the cube
         * :param vmm: view storage max memory value
         * :return: response
         */
        const url = formatUrl("/Cubes('{}')/ViewStorageMaxMemory", cubeName);
        const body = { Value: vmm };
        return await this.rest.patch(url, body);
    }

    public async getVmt(cubeName: string): Promise<number> {
        /** Get view storage min time for cube
         *
         * :param cube_name: name of the cube
         * :return: view storage min time value
         */
        const url = formatUrl("/Cubes('{}')/ViewStorageMinTime/$value", cubeName);
        const response = await this.rest.get(url);
        return parseInt(response.data) || 0;
    }

    public async setVmt(cubeName: string, vmt: number): Promise<AxiosResponse> {
        /** Set view storage min time for cube
         *
         * :param cube_name: name of the cube
         * :param vmt: view storage min time value
         * :return: response
         */
        const url = formatUrl("/Cubes('{}')/ViewStorageMinTime", cubeName);
        const body = { Value: vmt };
        return await this.rest.patch(url, body);
    }

    public async getDimensionNames(
        cubeName: string,
        skipSandboxDimension: boolean = true
    ): Promise<string[]> {
        const url = formatUrl("/Cubes('{}')/Dimensions?$select=Name", cubeName);
        const response = await this.rest.get(url);
        let dimensionNames = response.data.value.map((dim: any) => dim.Name);

        if (skipSandboxDimension && dimensionNames.length > 0 && dimensionNames[0] === 'Sandboxes') {
            dimensionNames = dimensionNames.slice(1);
        }

        return dimensionNames;
    }

    // Rules Management Functions
    public async checkRules(cubeName: string): Promise<any> {
        /** Check cube rules syntax
         *
         * :param cube_name: name of the cube
         * :return: rules check result
         */
        const url = formatUrl("/Cubes('{}')/tm1.CheckRules", cubeName);
        return await this.rest.post(url);
    }

    public async updateOrCreateRules(cubeName: string, rules: string | Rules): Promise<AxiosResponse> {
        /** Update or create rules for cube
         *
         * :param cube_name: name of the cube
         * :param rules: rules text or Rules object
         * :return: response
         */
        const url = formatUrl("/Cubes('{}')/Rules", cubeName);
        const body = typeof rules === 'string' ? { Text: rules } : rules.body;
        
        // Try to update first, if it fails, create
        try {
            return await this.rest.patch(url, body);
        } catch (error) {
            return await this.rest.post(url, body);
        }
    }

    public async getMeasureDimension(cubeName: string): Promise<string> {
        /** Get the measure dimension of a cube
         *
         * :param cubeName: string, name of the cube
         * :return: string, name of the measure dimension
         */
        const cube = await this.get(cubeName);
        return cube.dimensions[cube.dimensions.length - 1];
    }

    // ===== ADVANCED SEARCH METHODS =====

    /**
     * Search for cubes that contain specific dimensions
     */
    public async searchForDimension(
        dimensionName: string, 
        skipControlCubes: boolean = false
    ): Promise<string[]> {
        /** Search cubes that contain a specific dimension
         *
         * :param dimensionName: exact dimension name to search for
         * :param skipControlCubes: exclude control cubes
         * :return: array of cube names that contain the dimension
         */
        const cubes = skipControlCubes ? await this.getModelCubes() : await this.getAll();
        const results: string[] = [];

        for (const cube of cubes) {
            if (cube.dimensions.includes(dimensionName)) {
                results.push(cube.name);
            }
        }

        return results;
    }

    /**
     * Get all cube names that have rules
     */
    public async getAllNamesWithRules(skipControlCubes: boolean = false): Promise<string[]> {
        /** Get all cube names that have rules
         *
         * :param skipControlCubes: exclude control cubes
         * :return: array of cube names that have rules
         */
        const cubes = skipControlCubes ? await this.getModelCubes() : await this.getAll();
        const results: string[] = [];

        for (const cube of cubes) {
            if (cube.hasRules) {
                results.push(cube.name);
            }
        }

        return results;
    }

    /**
     * Get all cube names that do not have rules
     */
    public async getAllNamesWithoutRules(skipControlCubes: boolean = false): Promise<string[]> {
        /** Get all cube names that do not have rules
         *
         * :param skipControlCubes: exclude control cubes
         * :return: array of cube names that do not have rules
         */
        const cubes = skipControlCubes ? await this.getModelCubes() : await this.getAll();
        const results: string[] = [];

        for (const cube of cubes) {
            if (!cube.hasRules) {
                results.push(cube.name);
            }
        }

        return results;
    }

    /**
     * Search cubes by multiple criteria
     */
    public async searchCubes(criteria: {
        namePattern?: string;
        dimensionNames?: string[];
        hasRules?: boolean;
        skipControlCubes?: boolean;
        minDimensions?: number;
        maxDimensions?: number;
    }): Promise<string[]> {
        /** Advanced search for cubes based on multiple criteria
         *
         * :param criteria: search criteria object
         * :return: array of cube names matching all criteria
         */
        const cubes = criteria.skipControlCubes ? await this.getModelCubes() : await this.getAll();
        const results: string[] = [];

        for (const cube of cubes) {
            let matches = true;

            // Check name pattern
            if (criteria.namePattern && !cube.name.toLowerCase().includes(criteria.namePattern.toLowerCase())) {
                matches = false;
            }

            // Check required dimensions
            if (criteria.dimensionNames && matches) {
                for (const dimName of criteria.dimensionNames) {
                    if (!cube.dimensions.includes(dimName)) {
                        matches = false;
                        break;
                    }
                }
            }

            // Check rules requirement
            if (criteria.hasRules !== undefined && matches) {
                if (criteria.hasRules !== cube.hasRules) {
                    matches = false;
                }
            }

            // Check dimension count limits
            if (matches) {
                const dimCount = cube.dimensions.length;
                if (criteria.minDimensions !== undefined && dimCount < criteria.minDimensions) {
                    matches = false;
                }
                if (criteria.maxDimensions !== undefined && dimCount > criteria.maxDimensions) {
                    matches = false;
                }
            }

            if (matches) {
                results.push(cube.name);
            }
        }

        return results;
    }
}
