import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { ProcessService } from './ProcessService';
import { Cube } from '../objects/Cube';
import { Rules } from '../objects/Rules';
import { CellService } from './CellService';
import { ViewService } from './ViewService';
import { formatUrl, caseAndSpaceInsensitiveEquals, lowerAndDropSpaces } from '../utils/Utils';
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
        /** Get all cube names from TM1 Server.
         * Matches tm1py get_all_names(): uses /ModelCubes() when skip_control_cubes=True.
         *
         * :param skipControlCubes: exclude control cubes (cubes with } prefix)
         * :return: Array of cube names
         */
        const endpoint = skipControlCubes ? "/ModelCubes()" : "/Cubes";
        const url = `${endpoint}?$select=Name`;
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

    public async searchForDimensionSubstring(
        substring: string,
        skipControlCubes: boolean = false
    ): Promise<{[cubeName: string]: string[]}> {
        /** Search cubes that contain dimensions with specific substring.
         * Matches tm1py search_for_dimension_substring(): uses server-side OData $filter and $expand.
         *
         * :param substring: substring to search for in dimension names
         * :param skip_control_cubes: exclude control cubes
         * :return: dictionary with cube names as keys and matching dimension names as values
         */
        const endpoint = skipControlCubes ? "ModelCubes()" : "Cubes";
        const normalizedSubstring = lowerAndDropSpaces(substring);
        const url = `/${endpoint}?$select=Name` +
            `&$filter=Dimensions/any(d: contains(replace(tolower(d/Name), ' ', ''),'${normalizedSubstring}'))` +
            `&$expand=Dimensions($select=Name;$filter=contains(replace(tolower(Name), ' ', ''), '${normalizedSubstring}'))`;

        const response = await this.rest.get(url);
        const results: {[cubeName: string]: string[]} = {};

        for (const cube of response.data.value) {
            const matchingDimensions = cube.Dimensions
                ? cube.Dimensions.map((d: any) => d.Name)
                : [];
            if (matchingDimensions.length > 0) {
                results[cube.Name] = matchingDimensions;
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
        /** Search cubes by rules substring.
         * Matches tm1py search_for_rule_substring(): uses server-side OData $filter with
         * 4 sensitivity variants: case+space, case only, space only, exact.
         */
        const endpoint = skipControlCubes ? "ModelCubes()" : "Cubes";

        let normalizedSubstring = substring;
        if (caseInsensitive) normalizedSubstring = normalizedSubstring.toLowerCase();
        if (spaceInsensitive) normalizedSubstring = normalizedSubstring.replace(/\s+/g, '');

        let urlFilter = "Rules ne null and contains(";
        if (caseInsensitive && spaceInsensitive) {
            urlFilter += `tolower(replace(Rules, ' ', '')),'${normalizedSubstring}')`;
        } else if (caseInsensitive) {
            urlFilter += `tolower(Rules),'${normalizedSubstring}')`;
        } else if (spaceInsensitive) {
            urlFilter += `replace(Rules, ' ', ''),'${normalizedSubstring}')`;
        } else {
            urlFilter += `Rules,'${normalizedSubstring}')`;
        }

        const url = `/${endpoint}?$filter=${urlFilter}&$expand=Dimensions($select=Name)`;
        const response = await this.rest.get(url);
        return response.data.value.map((cube: any) => Cube.fromDict(cube));
    }

    public async getStorageDimensionOrder(cubeName: string): Promise<string[]> {
        /** Get the storage dimension order of a cube
         *
         * :param cube_name: name of the cube
         * :return: List of dimension names in storage order
         */
        const url = formatUrl("/Cubes('{}')/tm1.DimensionsStorageOrder()?$select=Name", cubeName);
        const response = await this.rest.get(url);
        return response.data.value.map((dim: any) => dim.Name);
    }

    public async updateStorageDimensionOrder(cubeName: string, dimensionNames: string[]): Promise<number> {
        /** Update the storage dimension order of a cube
         *
         * :param cube_name: name of the cube
         * :param dimension_names: ordered list of dimension names
         * :return: Float - percent change in memory usage
         */
        const url = formatUrl("/Cubes('{}')/tm1.ReorderDimensions", cubeName);
        const payload: any = {};
        payload['Dimensions@odata.bind'] = dimensionNames.map(d => formatUrl("Dimensions('{}')", d));
        const response = await this.rest.post(url, JSON.stringify(payload));
        return response.data.value;
    }

    public async getRandomIntersection(cubeName: string, uniqueNames: boolean = false): Promise<string[]> {
        /** Get a random intersection from cube.
         * Matches tm1py get_random_intersection(): traverses dimensions/hierarchies
         * client-side and picks a random element from each.
         */
        const dimensionNames = await this.getDimensionNames(cubeName);
        const elements: string[] = [];

        for (const dimensionName of dimensionNames) {
            const url = formatUrl(
                "/Dimensions('{}')/Hierarchies('{}')/Elements?$select=Name",
                dimensionName, dimensionName
            );
            const response = await this.rest.get(url);
            const elementNames = response.data.value.map((e: any) => e.Name);

            if (elementNames.length === 0) {
                elements.push('');
                continue;
            }

            const randomIndex = Math.floor(Math.random() * elementNames.length);
            const element = elementNames[randomIndex];

            if (uniqueNames) {
                elements.push(`[${dimensionName}].[${element}]`);
            } else {
                elements.push(element);
            }
        }

        return elements;
    }

    // Memory Management Functions
    public async load(cubeName: string): Promise<AxiosResponse> {
        const url = formatUrl("/Cubes('{}')/tm1.Load", cubeName);
        return await this.rest.post(url);
    }

    public async unload(cubeName: string): Promise<AxiosResponse> {
        const url = formatUrl("/Cubes('{}')/tm1.Unload", cubeName);
        return await this.rest.post(url);
    }

    public async lock(cubeName: string): Promise<AxiosResponse> {
        const url = formatUrl("/Cubes('{}')/tm1.Lock", cubeName);
        return await this.rest.post(url);
    }

    public async unlock(cubeName: string): Promise<AxiosResponse> {
        const url = formatUrl("/Cubes('{}')/tm1.Unlock", cubeName);
        return await this.rest.post(url);
    }

    public async cubeSaveData(cubeName: string): Promise<any> {
        /** Save cube data to disk.
         * Matches tm1py cube_save_data(): executes TI code CubeSaveData('cubeName')
         * via ProcessService.execute_ti_code().
         */
        const escapedCubeName = cubeName.replace(/'/g, "''");
        const tiCode = `CubeSaveData('${escapedCubeName}');`;
        const processService = new ProcessService(this.rest);
        return await processService.executeTiCode([tiCode]);
    }

    public async getVmm(cubeName: string): Promise<number> {
        /** Get view storage max memory for cube.
         * Matches tm1py get_vmm(): GET /Cubes('{}')?$select=ViewStorageMaxMemory.
         */
        const url = formatUrl("/Cubes('{}')?$select=ViewStorageMaxMemory", cubeName);
        const response = await this.rest.get(url);
        return response.data.ViewStorageMaxMemory;
    }

    public async setVmm(cubeName: string, vmm: number): Promise<AxiosResponse> {
        /** Set view storage max memory for cube.
         * Matches tm1py set_vmm(): PATCH /Cubes('{}') with {ViewStorageMaxMemory: value}.
         */
        const url = formatUrl("/Cubes('{}')", cubeName);
        const body = { ViewStorageMaxMemory: vmm };
        return await this.rest.patch(url, body);
    }

    public async getVmt(cubeName: string): Promise<number> {
        /** Get view storage min time for cube.
         * Matches tm1py get_vmt(): GET /Cubes('{}')?$select=ViewStorageMinTime.
         */
        const url = formatUrl("/Cubes('{}')?$select=ViewStorageMinTime", cubeName);
        const response = await this.rest.get(url);
        return response.data.ViewStorageMinTime;
    }

    public async setVmt(cubeName: string, vmt: number): Promise<AxiosResponse> {
        /** Set view storage min time for cube.
         * Matches tm1py set_vmt(): PATCH /Cubes('{}') with {ViewStorageMinTime: value}.
         */
        const url = formatUrl("/Cubes('{}')", cubeName);
        const body = { ViewStorageMinTime: vmt };
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
    public async checkRules(cubeName: string): Promise<any[]> {
        /** Check cube rules syntax.
         * Matches tm1py check_rules(): returns response.json()["value"] (the errors array).
         */
        const url = formatUrl("/Cubes('{}')/tm1.CheckRules", cubeName);
        const response = await this.rest.post(url);
        return response.data.value;
    }

    public async updateOrCreateRules(cubeName: string, rules: string | Rules): Promise<AxiosResponse> {
        /** Update or create rules for cube.
         * Matches tm1py update_or_create_rules(): PATCH /Cubes('{}') with rules.body.
         */
        const rulesObj = typeof rules === 'string' ? new Rules(rules) : rules;
        const url = formatUrl("/Cubes('{}')", cubeName);
        return await this.rest.patch(url, rulesObj.body);
    }

    public async getMeasureDimension(cubeName: string): Promise<string> {
        const cube = await this.get(cubeName);
        return cube.dimensions[cube.dimensions.length - 1];
    }

    // ===== ADVANCED SEARCH METHODS =====

    /**
     * Search for cubes that contain a specific dimension.
     * Matches tm1py search_for_dimension(): uses server-side OData $filter.
     */
    public async searchForDimension(
        dimensionName: string,
        skipControlCubes: boolean = false
    ): Promise<string[]> {
        const endpoint = skipControlCubes ? "ModelCubes()" : "Cubes";
        const normalizedName = lowerAndDropSpaces(dimensionName);
        const url = `/${endpoint}?$select=Name&$filter=Dimensions/any(d: replace(tolower(d/Name), ' ', '') eq '${normalizedName}')`;
        const response = await this.rest.get(url);
        return response.data.value.map((cube: any) => cube.Name);
    }

    /**
     * Get all cube names that have rules.
     * Matches tm1py get_all_names_with_rules(): uses server-side OData $filter=Rules ne null.
     */
    public async getAllNamesWithRules(skipControlCubes: boolean = false): Promise<string[]> {
        const endpoint = skipControlCubes ? "ModelCubes()" : "Cubes";
        const url = `/${endpoint}?$select=Name,Rules&$filter=Rules ne null`;
        const response = await this.rest.get(url);
        return response.data.value.map((cube: any) => cube.Name);
    }

    /**
     * Get all cube names that do not have rules.
     * Matches tm1py get_all_names_without_rules(): uses server-side OData $filter=Rules eq null.
     */
    public async getAllNamesWithoutRules(skipControlCubes: boolean = false): Promise<string[]> {
        const endpoint = skipControlCubes ? "ModelCubes()" : "Cubes";
        const url = `/${endpoint}?$select=Name,Rules&$filter=Rules eq null`;
        const response = await this.rest.get(url);
        return response.data.value.map((cube: any) => cube.Name);
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
        const cubes = criteria.skipControlCubes ? await this.getModelCubes() : await this.getAll();
        const results: string[] = [];

        for (const cube of cubes) {
            let matches = true;

            if (criteria.namePattern && !cube.name.toLowerCase().includes(criteria.namePattern.toLowerCase())) {
                matches = false;
            }

            if (criteria.dimensionNames && matches) {
                for (const dimName of criteria.dimensionNames) {
                    if (!cube.dimensions.includes(dimName)) {
                        matches = false;
                        break;
                    }
                }
            }

            if (criteria.hasRules !== undefined && matches) {
                if (criteria.hasRules !== cube.hasRules) {
                    matches = false;
                }
            }

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
