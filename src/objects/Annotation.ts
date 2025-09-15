import { TM1Object } from './TM1Object';
import { formatUrl } from '../utils/Utils';

export class Annotation extends TM1Object {
    /** Abstraction of TM1 Annotation
     *
     *     :Notes:
     *         - Class complete, functional and tested.
     *         - doesn't cover Attachments though
     */

    private _id?: string;
    private _text: string;
    private _creator?: string;
    private _created?: string;
    private _lastUpdatedBy?: string;
    private _lastUpdated?: string;
    private _dimensionalContext: string[];
    private _commentType: string;
    private _commentValue: string;
    private _objectName: string;

    constructor(
        commentValue: string,
        objectName: string,
        dimensionalContext: Iterable<string>,
        commentType: string = 'ANNOTATION',
        annotationId?: string,
        text: string = '',
        creator?: string,
        created?: string,
        lastUpdatedBy?: string,
        lastUpdated?: string
    ) {
        super();
        this._id = annotationId;
        this._text = text;
        this._creator = creator;
        this._created = created;
        this._lastUpdatedBy = lastUpdatedBy;
        this._lastUpdated = lastUpdated;
        this._dimensionalContext = Array.from(dimensionalContext);
        this._commentType = commentType;
        this._commentValue = commentValue;
        this._objectName = objectName;
    }

    public static fromJSON(annotationAsJson: string): Annotation {
        /** Alternative constructor
         *
         *     :param annotation_as_json: String, JSON
         *     :return: instance of .Process
         */
        const annotationAsDict = JSON.parse(annotationAsJson);
        const annotationId = annotationAsDict.ID;
        const text = annotationAsDict.Text;
        const creator = annotationAsDict.Creator;
        const created = annotationAsDict.Created;
        const lastUpdatedBy = annotationAsDict.LastUpdatedBy;
        const lastUpdated = annotationAsDict.LastUpdated;
        const dimensionalContext = annotationAsDict.DimensionalContext.map((item: any) => item.Name);
        const commentType = annotationAsDict.commentType;
        const commentValue = annotationAsDict.commentValue;
        const objectName = annotationAsDict.objectName;
        
        return new Annotation(
            commentValue,
            objectName,
            dimensionalContext,
            commentType,
            annotationId,
            text,
            creator,
            created,
            lastUpdatedBy,
            lastUpdated
        );
    }

    public get body(): string {
        return JSON.stringify(this.constructBody());
    }

    public get bodyAsDict(): any {
        return this.constructBody();
    }

    public get commentValue(): string {
        return this._commentValue;
    }

    public set commentValue(value: string) {
        this._commentValue = value;
    }

    public get text(): string {
        return this._text;
    }

    public get dimensionalContext(): string[] {
        return this._dimensionalContext;
    }

    public get created(): string | undefined {
        return this._created;
    }

    public get objectName(): string {
        return this._objectName;
    }

    public get lastUpdated(): string | undefined {
        return this._lastUpdated;
    }

    public get lastUpdatedBy(): string | undefined {
        return this._lastUpdatedBy;
    }

    public get id(): string | undefined {
        return this._id;
    }

    public move(
        dimensionOrder: Iterable<string>,
        dimension: string,
        targetElement: string,
        sourceElement?: string
    ): void {
        /** Move annotation on given dimension from source_element to target_element
         * 
         *     :param dimension_order: List, order of the dimensions in the cube
         *     :param dimension: dimension name
         *     :param target_element: target element name
         *     :param source_element:  source element name
         *     :return: 
         */
        const dimensionOrderArray = Array.from(dimensionOrder);
        for (let i = 0; i < dimensionOrderArray.length; i++) {
            const dimensionName = dimensionOrderArray[i];
            if (dimensionName.toLowerCase() === dimension.toLowerCase()) {
                if (!sourceElement || this._dimensionalContext[i] === sourceElement) {
                    this._dimensionalContext[i] = targetElement;
                }
            }
        }
    }

    private constructBody(): any {
        /** construct the ODATA conform JSON representation for the Annotation entity.
         *
         *     :return: string, the valid JSON
         */
        const dimensionalContext = this._dimensionalContext.map(element => ({ Name: element }));
        const body: any = {};
        body.ID = this._id;
        body.Text = this._text;
        body.Creator = this._creator;
        body.Created = this._created;
        body.LastUpdatedBy = this._lastUpdatedBy;
        body.LastUpdated = this._lastUpdated;
        body.DimensionalContext = dimensionalContext;
        const commentLocations = this._dimensionalContext.join(',');
        body.commentLocation = commentLocations.substring(1);
        body.commentType = this._commentType;
        body.commentValue = this._commentValue;
        body.objectName = this._objectName;
        return body;
    }

    public constructBodyForPost(cubeDimensions: string[]): any {
        const body: any = {};
        body.Text = this.text;
        body.ApplicationContext = [{
            "Facet@odata.bind": "ApplicationContextFacets('}Cubes')",
            "Value": this.objectName
        }];
        body["DimensionalContext@odata.bind"] = [];

        for (let i = 0; i < cubeDimensions.length; i++) {
            const dimension = cubeDimensions[i];
            const element = this.dimensionalContext[i];
            const coordinates = formatUrl("Dimensions('{}')/Hierarchies('{}')/Members('{}')", dimension, dimension, element);
            body["DimensionalContext@odata.bind"].push(coordinates);
        }

        body.objectName = this.objectName;
        body.commentValue = this.commentValue;
        body.commentType = 'ANNOTATION';
        body.commentLocation = this.dimensionalContext.join(',');

        return body;
    }
}