import { AxiosResponse } from 'axios';
import { RestService } from './RestService';
import { ObjectService } from './ObjectService';
import { Annotation } from '../objects/Annotation';
import { formatUrl, CaseAndSpaceInsensitiveDict } from '../utils/Utils';

export class AnnotationService extends ObjectService {
    /** Service to handle Object Updates for TM1 CellAnnotations
     * 
     */

    constructor(rest: RestService) {
        super(rest);
    }

    public async getAll(cubeName: string): Promise<Annotation[]> {
        /** get all annotations from given cube as a List.
         *
         * :param cube_name:
         */
        const url = formatUrl("/Cubes('{}')/Annotations?$expand=DimensionalContext($select=Name)", cubeName);
        const response = await this.rest.get(url);

        const annotationsAsDict = response.data.value;
        const annotations = annotationsAsDict.map((element: any) => 
            Annotation.fromJSON(JSON.stringify(element)));
        return annotations;
    }

    public async create(annotation: Annotation): Promise<AxiosResponse> {
        /** create an Annotation
         *
         * :param annotation: instance of .Annotation
         */
        const url = "/Annotations";

        // Import here to avoid circular dependency
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { CubeService } = require('./CubeService');
        const cubeService = new CubeService(this.rest);
        const cubeDimensions = await cubeService.getDimensionNames(
            annotation.objectName,
            true // skip_sandbox_dimension
        );

        const response = await this.rest.post(url, 
            JSON.stringify(annotation.constructBodyForPost(cubeDimensions)));
        return response;
    }

    public async createMany(annotations: Iterable<Annotation>): Promise<AxiosResponse> {
        /** create an Annotation
         *
         * :param annotations: instances of .Annotation
         */
        const payload: any[] = [];
        const cubeDimensions = new CaseAndSpaceInsensitiveDict<string[]>();

        for (const annotation of annotations) {
            let dimensionNames = cubeDimensions.get(annotation.objectName);
            if (!dimensionNames) {
                // Import here to avoid circular dependency
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { CubeService } = require('./CubeService');
                const cubeService = new CubeService(this.rest);
                dimensionNames = await cubeService.getDimensionNames(
                    annotation.objectName,
                    true // skip_sandbox_dimension
                );
                cubeDimensions.set(annotation.objectName, dimensionNames || []);
            }
            payload.push(annotation.constructBodyForPost(dimensionNames || []));
        }

        const response = await this.rest.post("/Annotations", JSON.stringify(payload));
        return response;
    }

    public async get(annotationId: string): Promise<Annotation> {
        /** get an annotation from any cube through its unique id
         *
         * :param annotation_id: String, the id of the annotation
         */
        const request = formatUrl("/Annotations('{}')?$expand=DimensionalContext($select=Name)", annotationId);
        const response = await this.rest.get(request);
        return Annotation.fromJSON(JSON.stringify(response.data));
    }

    public async update(annotation: Annotation): Promise<AxiosResponse> {
        /** update Annotation.
         * updateable attributes: commentValue
         *
         * :param annotation: instance of .Annotation
         */
        const url = formatUrl("/Annotations('{}')", annotation.id || '');
        return await this.rest.patch(url, annotation.body);
    }

    public async delete(annotationId: string): Promise<AxiosResponse> {
        /** delete Annotation
         *
         * :param annotation_id: string, the id of the annotation
         */
        const url = formatUrl("/Annotations('{}')", annotationId);
        return await this.rest.delete(url);
    }
}