import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { View } from '../objects/View';
import { MDXView } from '../objects/MDXView';
import { NativeView } from '../objects/NativeView';
import { TM1RestException } from '../exceptions/TM1Exception';
import { formatUrl } from '../utils/Utils';

export class ViewService extends ObjectService {
    /** Service to handle Object Updates for cube views (NativeViews and MDXViews)
     * 
     */

    constructor(rest: RestService) {
        super(rest);
    }

    public async create(view: MDXView | NativeView, isPrivate: boolean = false): Promise<AxiosResponse> {
        /** create a new view on TM1 Server
         *
         * :param view: instance of subclass of .View (.NativeView or .MDXView)
         * :param private: boolean
         *
         * :return: Response
         */
        const viewType = isPrivate ? "PrivateViews" : "Views";
        const url = formatUrl("/Cubes('{}')/{}", view.cube, viewType);
        return await this.rest.post(url, view.body);
    }

    public async exists(cubeName: string, viewName: string, isPrivate?: boolean): Promise<boolean | [boolean, boolean]> {
        /** Checks if view exists as private, public or both
         *
         * :param cube_name:  string, name of the cube
         * :param view_name: string, name of the view
         * :param private: boolean, if None: check for private and public
         *
         * :return boolean tuple
         */
        const urlTemplate = "/Cubes('{}')/{}('{}')";
        
        if (isPrivate !== undefined) {
            const url = formatUrl(urlTemplate, cubeName, isPrivate ? "PrivateViews" : "Views", viewName);
            return await this._exists(url);
        }

        const viewTypes = new Map<string, boolean>();
        viewTypes.set('PrivateViews', false);
        viewTypes.set('Views', false);
        
        for (const [viewType] of viewTypes) {
            try {
                const url = formatUrl(urlTemplate, cubeName, viewType, viewName);
                await this.rest.get(url);
                viewTypes.set(viewType, true);
            } catch (e) {
                if (!(e instanceof TM1RestException && e.statusCode === 404)) {
                    throw e;
                }
            }
        }
        return [viewTypes.get('PrivateViews')!, viewTypes.get('Views')!];
    }

    public async get(cubeName: string, viewName: string, isPrivate: boolean = false): Promise<View> {
        const viewType = isPrivate ? "PrivateViews" : "Views";
        const url = formatUrl("/Cubes('{}')/{}('{}')?$expand=*", cubeName, viewType, viewName);
        const response = await this.rest.get(url);
        const viewAsDict = response.data;
        
        if ("MDX" in viewAsDict) {
            return new MDXView(cubeName, viewName, viewAsDict.MDX);
        } else {
            return await this.getNativeView(cubeName, viewName, isPrivate);
        }
    }

    public async getNativeView(cubeName: string, viewName: string, isPrivate: boolean = false): Promise<NativeView> {
        /** Get a NativeView from TM1 Server
         *
         * :param cube_name:  string, name of the cube
         * :param view_name:  string, name of the native view
         * :param private:    boolean
         *
         * :return: instance of .NativeView
         */
        const viewType = isPrivate ? "PrivateViews" : "Views";
        const url = formatUrl(
            "/Cubes('{}')/{}('{}')?$expand=" +
            "tm1.NativeView/Rows/Subset($expand=Hierarchy($select=Name;" +
            "$expand=Dimension($select=Name)),Elements($select=Name);" +
            "$select=Expression,UniqueName,Name, Alias),  " +
            "tm1.NativeView/Columns/Subset($expand=Hierarchy($select=Name;" +
            "$expand=Dimension($select=Name)),Elements($select=Name);" +
            "$select=Expression,UniqueName,Name,Alias), " +
            "tm1.NativeView/Titles/Subset($expand=Hierarchy($select=Name;" +
            "$expand=Dimension($select=Name)),Elements($select=Name);" +
            "$select=Expression,UniqueName,Name,Alias), " +
            "tm1.NativeView/Titles/Selected($select=Name)",
            cubeName, viewType, viewName);
        
        const response = await this.rest.get(url);
        const nativeView = NativeView.fromJSON(JSON.stringify(response.data), cubeName);
        return nativeView;
    }

    public async update(view: MDXView | NativeView, isPrivate: boolean = false): Promise<AxiosResponse> {
        /** Update an existing view on TM1 Server
         *
         * :param view: instance of subclass of .View (.NativeView or .MDXView)
         * :param private: boolean
         *
         * :return: Response
         */
        const viewType = isPrivate ? "PrivateViews" : "Views";
        const url = formatUrl("/Cubes('{}')/{}/('{}')}", view.cube, viewType, view.name);
        return await this.rest.patch(url, view.body);
    }

    public async delete(cubeName: string, viewName: string, isPrivate: boolean = false): Promise<AxiosResponse> {
        /** Delete an existing view on TM1 Server
         *
         * :param cube_name: string, name of the cube
         * :param view_name: string, name of the view
         * :param private: boolean
         *
         * :return: Response
         */
        const viewType = isPrivate ? "PrivateViews" : "Views";
        const url = formatUrl("/Cubes('{}')/{}('{}')", cubeName, viewType, viewName);
        return await this.rest.delete(url);
    }

    public async getAll(cubeName: string): Promise<[NativeView[], MDXView[]]> {
        /** Get all views from a cube
         *
         * :param cube_name: String, name of the cube
         * :return: Tuple of List of instances of .NativeView and .MDXView
         */
        const url = formatUrl("/Cubes('{}')/Views?$expand=*", cubeName);
        const response = await this.rest.get(url);
        
        const nativeViews: NativeView[] = [];
        const mdxViews: MDXView[] = [];
        
        for (const viewDict of response.data.value) {
            if ("MDX" in viewDict) {
                mdxViews.push(new MDXView(cubeName, viewDict.Name, viewDict.MDX));
            } else {
                const nativeView = await this.getNativeView(cubeName, viewDict.Name, false);
                nativeViews.push(nativeView);
            }
        }
        
        return [nativeViews, mdxViews];
    }

    public async getAllNames(cubeName: string, isPrivate?: boolean): Promise<string[]> {
        /** Get all view names from a cube
         *
         * :param cube_name: String, name of the cube  
         * :param private: Boolean, private views only
         * :return: List of view names
         */
        let viewType = "Views";
        if (isPrivate === true) {
            viewType = "PrivateViews";
        } else if (isPrivate === false) {
            viewType = "Views";
        }
        
        if (isPrivate === undefined) {
            // Get both private and public view names
            const privateUrl = formatUrl("/Cubes('{}')/PrivateViews?$select=Name", cubeName);
            const publicUrl = formatUrl("/Cubes('{}')/Views?$select=Name", cubeName);
            
            const [privateResponse, publicResponse] = await Promise.all([
                this.rest.get(privateUrl),
                this.rest.get(publicUrl)
            ]);
            
            const privateNames = privateResponse.data.value.map((v: any) => v.Name);
            const publicNames = publicResponse.data.value.map((v: any) => v.Name);
            
            return [...privateNames, ...publicNames];
        }
        
        const url = formatUrl("/Cubes('{}')/{}?$select=Name", cubeName, viewType);
        const response = await this.rest.get(url);
        return response.data.value.map((view: any) => view.Name);
    }

    private async _exists(url: string): Promise<boolean> {
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

    public async searchStringInName(
        cubeName: string, 
        searchString: string, 
        isPrivate: boolean = false
    ): Promise<string[]> {
        /** Search for views by name containing specific string
         *
         * :param cube_name: name of the cube
         * :param search_string: string to search for in view names
         * :param is_private: search in private views
         * :return: list of view names containing the search string
         */
        const viewType = isPrivate ? "PrivateViews" : "Views";
        let url = formatUrl("/Cubes('{}')/{}?$select=Name", cubeName, viewType);
        
        const filters = [`indexof(tolower(Name), '${searchString.toLowerCase()}') ge 0`];
        url += "&$filter=" + filters.join(' and ');

        const response = await this.rest.get(url);
        return response.data.value.map((view: any) => view.Name);
    }

    public async searchStringInMdx(
        cubeName: string,
        searchString: string,
        isPrivate: boolean = false,
        caseInsensitive: boolean = true
    ): Promise<string[]> {
        /** Search for MDX views containing specific string in MDX
         *
         * :param cube_name: name of the cube
         * :param search_string: string to search for in MDX
         * :param is_private: search in private views
         * :param case_insensitive: ignore case when searching
         * :return: list of view names containing the search string in MDX
         */
        const viewType = isPrivate ? "PrivateViews" : "Views";
        const url = formatUrl("/Cubes('{}')/{}?$select=Name,MDX", cubeName, viewType);

        const response = await this.rest.get(url);
        const views = response.data.value;
        const matchingViews: string[] = [];

        let searchTerm = searchString;
        if (caseInsensitive) {
            searchTerm = searchTerm.toLowerCase();
        }

        for (const view of views) {
            if (view.MDX) {
                let mdxText = view.MDX;
                if (caseInsensitive) {
                    mdxText = mdxText.toLowerCase();
                }
                
                if (mdxText.includes(searchTerm)) {
                    matchingViews.push(view.Name);
                }
            }
        }

        return matchingViews;
    }

    public async isMdxView(
        cubeName: string, 
        viewName: string, 
        isPrivate: boolean = false
    ): Promise<boolean> {
        /** Check if view is an MDX view
         *
         * :param cube_name: name of the cube
         * :param view_name: name of the view
         * :param is_private: check private view
         * :return: true if view is MDX view, false if native view
         */
        const viewType = isPrivate ? "PrivateViews" : "Views";
        const url = formatUrl("/Cubes('{}')/{}('{}')/?$select=MDX", cubeName, viewType, viewName);
        
        const response = await this.rest.get(url);
        return response.data.MDX !== undefined && response.data.MDX !== null;
    }

    public async isNativeView(
        cubeName: string,
        viewName: string, 
        isPrivate: boolean = false
    ): Promise<boolean> {
        /** Check if view is a native view
         *
         * :param cube_name: name of the cube
         * :param view_name: name of the view
         * :param is_private: check private view
         * :return: true if view is native view, false if MDX view
         */
        return !(await this.isMdxView(cubeName, viewName, isPrivate));
    }

    public async updateOrCreate(
        view: NativeView | MDXView,
        isPrivate: boolean = false
    ): Promise<AxiosResponse> {
        /** Update view if exists, create if it doesn't
         *
         * :param view: NativeView or MDXView instance
         * :param is_private: private view flag
         * :return: response
         */
        const existsResult = await this.exists(view.cube, view.name, isPrivate);
        const viewExists = Array.isArray(existsResult) ? 
                          (isPrivate ? existsResult[0] : existsResult[1]) : 
                          existsResult;

        if (viewExists) {
            return await this.update(view, isPrivate);
        }
        return await this.create(view, isPrivate);
    }

    public async getViewCount(cubeName: string, isPrivate?: boolean): Promise<number> {
        /** Get count of views in cube
         *
         * :param cube_name: name of the cube
         * :param is_private: count private views, undefined for both
         * :return: number of views
         */
        if (isPrivate === undefined) {
            // Count both private and public views
            const privateUrl = formatUrl("/Cubes('{}')/PrivateViews/$count", cubeName);
            const publicUrl = formatUrl("/Cubes('{}')/Views/$count", cubeName);
            
            const [privateResponse, publicResponse] = await Promise.all([
                this.rest.get(privateUrl),
                this.rest.get(publicUrl)
            ]);
            
            const privateCount = parseInt(privateResponse.data) || 0;
            const publicCount = parseInt(publicResponse.data) || 0;
            
            return privateCount + publicCount;
        }
        
        const viewType = isPrivate ? "PrivateViews" : "Views";
        const url = formatUrl("/Cubes('{}')/{}/$count", cubeName, viewType);

        const response = await this.rest.get(url);
        return parseInt(response.data) || 0;
    }

    public async getMdxViewNames(cubeName: string, isPrivate: boolean = false): Promise<string[]> {
        /** Get names of all MDX views from cube
         *
         * :param cube_name: name of the cube
         * :param is_private: get private views
         * :return: list of MDX view names
         */
        const viewType = isPrivate ? "PrivateViews" : "Views";
        const url = formatUrl("/Cubes('{}')/{}?$select=Name,MDX", cubeName, viewType);

        const response = await this.rest.get(url);
        const mdxViewNames: string[] = [];

        for (const view of response.data.value) {
            if (view.MDX) {
                mdxViewNames.push(view.Name);
            }
        }

        return mdxViewNames;
    }

    public async getNativeViewNames(cubeName: string, isPrivate: boolean = false): Promise<string[]> {
        /** Get names of all native views from cube
         *
         * :param cube_name: name of the cube
         * :param is_private: get private views
         * :return: list of native view names
         */
        const viewType = isPrivate ? "PrivateViews" : "Views";
        const url = formatUrl("/Cubes('{}')/{}?$select=Name,MDX", cubeName, viewType);

        const response = await this.rest.get(url);
        const nativeViewNames: string[] = [];

        for (const view of response.data.value) {
            if (!view.MDX) {
                nativeViewNames.push(view.Name);
            }
        }

        return nativeViewNames;
    }
}