import { TM1Object } from './TM1Object';
import { verifyVersion } from '../utils/Utils';

export class Process extends TM1Object {
    /** Abstraction of a TM1 Process.
     *
     *     IMPORTANT. doesn't work with Processes that were generated through the Wizard
     */

    /** the auto_generated_string code is required to be in all code-tabs. */
    public static readonly BEGIN_GENERATED_STATEMENTS = "#****Begin: Generated Statements***";
    public static readonly END_GENERATED_STATEMENTS = "#****End: Generated Statements****";
    public static readonly AUTO_GENERATED_STATEMENTS = `${Process.BEGIN_GENERATED_STATEMENTS}\r\n${Process.END_GENERATED_STATEMENTS}\r\n`;
    public static readonly MAX_STATEMENTS = 16_380;
    public static readonly MAX_STATEMENTS_POST_11_8_015 = 100_000;

    private _name: string;
    private _hasSecurityAccess: boolean | undefined;
    private _uiData: string;
    private _parameters: any[];
    private _variables: any[];
    private _variablesUiData: any[];
    private _prologProcedure: string;
    private _metadataProcedure: string;
    private _dataProcedure: string;
    private _epilogProcedure: string;
    private _datasourceType: string;
    private _datasourceAsciiDecimalSeparator: string;
    private _datasourceAsciiDelimiterChar: string;
    private _datasourceAsciiDelimiterType: string;
    private _datasourceAsciiHeaderRecords: number | string;
    private _datasourceAsciiQuoteCharacter: string;
    private _datasourceAsciiThousandSeparator: string;
    private _datasourceDataSourceNameForClient: string;
    private _datasourceDataSourceNameForServer: string;
    private _datasourcePassword: string;
    private _datasourceUserName: string;
    private _datasourceQuery: string;
    private _datasourceUsesUnicode: boolean | string;
    private _datasourceView: string;
    private _datasourceSubset: string;
    private _datasourceJsonRootPointer: string;
    private _datasourceJsonVariableMapping: string;

    public static maxStatements(version: string): number {
        if (verifyVersion("11.8.015", version)) {
            return Process.MAX_STATEMENTS_POST_11_8_015;
        }
        return Process.MAX_STATEMENTS;
    }

    public static addGeneratedStringToCode(code: string): string {
        const pattern = /#\*\*\*\*Begin: Generated Statements[\s\S]*#\*\*\*\*End: Generated Statements\*\*\*\*/;
        if (pattern.test(code)) {
            return code;
        } else {
            return Process.AUTO_GENERATED_STATEMENTS + code;
        }
    }

    constructor(
        name: string,
        hasSecurityAccess: boolean | undefined = false,
        uiData: string = "CubeAction=1511\fDataAction=1503\fCubeLogChanges=0\f",
        parameters?: Iterable<any>,
        variables?: Iterable<any>,
        variablesUiData?: Iterable<any>,
        prologProcedure: string = '',
        metadataProcedure: string = '',
        dataProcedure: string = '',
        epilogProcedure: string = '',
        datasourceType: string = 'None',
        datasourceAsciiDecimalSeparator: string = '.',
        datasourceAsciiDelimiterChar: string = ';',
        datasourceAsciiDelimiterType: string = 'Character',
        datasourceAsciiHeaderRecords: number | string = 1,
        datasourceAsciiQuoteCharacter: string = '',
        datasourceAsciiThousandSeparator: string = ',',
        datasourceDataSourceNameForClient: string = '',
        datasourceDataSourceNameForServer: string = '',
        datasourcePassword: string = '',
        datasourceUserName: string = '',
        datasourceQuery: string = '',
        datasourceUsesUnicode: boolean | string = true,
        datasourceView: string = '',
        datasourceSubset: string = '',
        datasourceJsonRootPointer: string = '',
        datasourceJsonVariableMapping: string = ''
    ) {
        /** Default constructor
         *
         * :param name: name of the process - mandatory
         * :param has_security_access:
         * :param ui_data:
         * :param parameters:
         * :param variables:
         * :param variables_ui_data:
         * :param prolog_procedure:
         * :param metadata_procedure:
         * :param data_procedure:
         * :param epilog_procedure:
         * :param datasource_type:
         * :param datasource_ascii_decimal_separator:
         * :param datasource_ascii_delimiter_char:
         * :param datasource_ascii_delimiter_type:
         * :param datasource_ascii_header_records:
         * :param datasource_ascii_quote_character:
         * :param datasource_ascii_thousand_separator:
         * :param datasource_data_source_name_for_client:
         * :param datasource_data_source_name_for_server:
         * :param datasource_password:
         * :param datasource_user_name:
         * :param datasource_query:
         * :param datasource_uses_unicode:
         * :param datasource_view:
         * :param datasource_subset:
         * :param datasource_json_root_pointer:
         * :param datasource_json_variable_mapping:
         */
        super();
        this._name = name;
        this._hasSecurityAccess = hasSecurityAccess;
        this._uiData = uiData;
        this._parameters = parameters ? Array.from(parameters) : [];
        this._variables = variables ? Array.from(variables) : [];
        if (variablesUiData) {
            // Handle encoding issue in variable_ui_data for async requests
            this._variablesUiData = Array.from(variablesUiData).map((entry: any) =>
                typeof entry === 'string' ? entry.replace('€', '\f') : entry
            );
        } else {
            this._variablesUiData = [];
        }
        this._prologProcedure = Process.addGeneratedStringToCode(prologProcedure);
        this._metadataProcedure = Process.addGeneratedStringToCode(metadataProcedure);
        this._dataProcedure = Process.addGeneratedStringToCode(dataProcedure);
        this._epilogProcedure = Process.addGeneratedStringToCode(epilogProcedure);
        this._datasourceType = datasourceType;
        this._datasourceAsciiDecimalSeparator = datasourceAsciiDecimalSeparator;
        this._datasourceAsciiDelimiterChar = datasourceAsciiDelimiterChar;
        this._datasourceAsciiDelimiterType = datasourceAsciiDelimiterType;
        this._datasourceAsciiHeaderRecords = datasourceAsciiHeaderRecords;
        this._datasourceAsciiQuoteCharacter = datasourceAsciiQuoteCharacter;
        this._datasourceAsciiThousandSeparator = datasourceAsciiThousandSeparator;
        this._datasourceDataSourceNameForClient = datasourceDataSourceNameForClient;
        this._datasourceDataSourceNameForServer = datasourceDataSourceNameForServer;
        this._datasourcePassword = datasourcePassword;
        this._datasourceUserName = datasourceUserName;
        this._datasourceQuery = datasourceQuery;
        this._datasourceUsesUnicode = datasourceUsesUnicode;
        this._datasourceView = datasourceView;
        this._datasourceSubset = datasourceSubset;
        this._datasourceJsonRootPointer = datasourceJsonRootPointer;
        this._datasourceJsonVariableMapping = datasourceJsonVariableMapping;
    }

    public get name(): string {
        return this._name;
    }

    public set name(value: string) {
        this._name = value;
    }

    public get hasSecurityAccess(): boolean | undefined {
        return this._hasSecurityAccess;
    }

    public set hasSecurityAccess(value: boolean | undefined) {
        this._hasSecurityAccess = value;
    }

    public get uiData(): string {
        return this._uiData;
    }

    public set uiData(value: string) {
        this._uiData = value;
    }

    public get parameters(): any[] {
        return this._parameters;
    }

    public set parameters(value: any[]) {
        this._parameters = value;
    }

    public get variables(): any[] {
        return this._variables;
    }

    public set variables(value: any[]) {
        this._variables = value;
    }

    public get variablesUiData(): any[] {
        return this._variablesUiData;
    }

    public set variablesUiData(value: any[]) {
        this._variablesUiData = value;
    }

    public get prologProcedure(): string {
        return this._prologProcedure;
    }

    public set prologProcedure(value: string) {
        this._prologProcedure = Process.addGeneratedStringToCode(value);
    }

    public get metadataProcedure(): string {
        return this._metadataProcedure;
    }

    public set metadataProcedure(value: string) {
        this._metadataProcedure = Process.addGeneratedStringToCode(value);
    }

    public get dataProcedure(): string {
        return this._dataProcedure;
    }

    public set dataProcedure(value: string) {
        this._dataProcedure = Process.addGeneratedStringToCode(value);
    }

    public get epilogProcedure(): string {
        return this._epilogProcedure;
    }

    public set epilogProcedure(value: string) {
        this._epilogProcedure = Process.addGeneratedStringToCode(value);
    }

    public get datasourceType(): string {
        return this._datasourceType;
    }

    public set datasourceType(value: string) {
        this._datasourceType = value;
    }

    public static fromDict(processAsDict: any): Process {
        /** Alternative constructor
         *
         * :param process_as_dict: process as dict
         * :return: process, an instance of this class
         */
        const ds = processAsDict['DataSource'] ?? {};
        return new Process(
            processAsDict['Name'],
            processAsDict['HasSecurityAccess'],
            processAsDict['UIData'] ?? '',
            processAsDict['Parameters'],
            processAsDict['Variables'],
            processAsDict['VariablesUIData'] ?? '',
            processAsDict['PrologProcedure'],
            processAsDict['MetadataProcedure'],
            processAsDict['DataProcedure'],
            processAsDict['EpilogProcedure'],
            ds['Type'] ?? '',
            ds['asciiDecimalSeparator'] ?? '',
            ds['asciiDelimiterChar'] ?? '',
            ds['asciiDelimiterType'] ?? '',
            ds['asciiHeaderRecords'] ?? '',
            ds['asciiQuoteCharacter'] ?? '',
            ds['asciiThousandSeparator'] ?? '',
            ds['dataSourceNameForClient'] ?? '',
            ds['dataSourceNameForServer'] ?? '',
            ds['password'] ?? '',
            ds['userName'] ?? '',
            ds['query'] ?? '',
            ds['usesUnicode'] ?? '',
            ds['view'] ?? '',
            ds['subset'] ?? '',
            ds['jsonRootPointer'] ?? '',
            ds['jsonVariableMapping'] ?? ''
        );
    }

    public addVariable(name: string, variableType: string): void {
        // variable consists of actual variable and UI-Information ('ignore','other', etc.)
        // 1. handle Variable info
        const variable = {
            Name: name,
            Type: variableType,
            Position: this._variables.length + 1,
            StartByte: 0,
            EndByte: 0,
        };
        this._variables.push(variable);
        // 2. handle UI info
        const varType = variableType === 'Numeric' ? 33 : 32;
        // '\f' !
        const variableUiData = 'VarType=' + varType + '\f' + 'ColType=' + 827 + '\f';
        /*
         * mapping VariableUIData:
         *     VarType 33 -> Numeric
         *     VarType 32 -> String
         *     ColType 827 -> Other
         */
        this._variablesUiData.push(variableUiData);
    }

    public removeVariable(name: string): void {
        for (const variable of this._variables.slice()) {
            if (variable['Name'] === name) {
                const vuid = this._variablesUiData[this._variables.indexOf(variable)];
                const vuidIdx = this._variablesUiData.indexOf(vuid);
                if (vuidIdx !== -1) {
                    this._variablesUiData.splice(vuidIdx, 1);
                }
                const varIdx = this._variables.indexOf(variable);
                if (varIdx !== -1) {
                    this._variables.splice(varIdx, 1);
                }
            }
        }
    }

    public addParameter(
        name: string,
        prompt: string,
        value: string | number,
        parameterType?: string
    ): void {
        if (!parameterType) {
            parameterType = typeof value === 'string' ? 'String' : 'Numeric';
        }
        const parameter = { Name: name, Prompt: prompt, Value: value, Type: parameterType };
        this._parameters.push(parameter);
    }

    public removeParameter(name: string): void {
        for (const parameter of this._parameters.slice()) {
            if (parameter['Name'] === name) {
                const idx = this._parameters.indexOf(parameter);
                if (idx !== -1) {
                    this._parameters.splice(idx, 1);
                }
            }
        }
    }

    public dropParameterTypes(): void {
        for (let p = 0; p < this._parameters.length; p++) {
            if ('Type' in this._parameters[p]) {
                delete this._parameters[p]['Type'];
            }
        }
    }

    public get body(): string {
        return JSON.stringify(this.constructBody());
    }

    public get bodyAsDict(): any {
        return this.constructBody();
    }

    private constructBody(): any {
        // general parameters — key order matches tm1py _construct_body_as_dict
        const bodyAsDict: any = {
            Name: this._name,
            PrologProcedure: this._prologProcedure,
            MetadataProcedure: this._metadataProcedure,
            DataProcedure: this._dataProcedure,
            EpilogProcedure: this._epilogProcedure,
            HasSecurityAccess: this._hasSecurityAccess,
            UIData: this._uiData,
            DataSource: {},
            Parameters: this._parameters,
            Variables: this._variables,
            VariablesUIData: this._variablesUiData,
        };

        // specific parameters (depending on datasource type)
        if (this._datasourceType === 'ASCII') {
            bodyAsDict['DataSource'] = {
                Type: this._datasourceType,
                asciiDecimalSeparator: this._datasourceAsciiDecimalSeparator,
                asciiDelimiterChar: this._datasourceAsciiDelimiterChar,
                asciiDelimiterType: this._datasourceAsciiDelimiterType,
                asciiHeaderRecords: this._datasourceAsciiHeaderRecords,
                asciiQuoteCharacter: this._datasourceAsciiQuoteCharacter,
                asciiThousandSeparator: this._datasourceAsciiThousandSeparator,
                dataSourceNameForClient: this._datasourceDataSourceNameForClient,
                dataSourceNameForServer: this._datasourceDataSourceNameForServer,
            };
            if (this._datasourceAsciiDelimiterType === 'FixedWidth') {
                delete bodyAsDict['DataSource']['asciiDelimiterChar'];
            }
        } else if (this._datasourceType === 'None') {
            bodyAsDict['DataSource'] = { Type: 'None' };
        } else if (this._datasourceType === 'ODBC') {
            bodyAsDict['DataSource'] = {
                Type: this._datasourceType,
                dataSourceNameForClient: this._datasourceDataSourceNameForClient,
                dataSourceNameForServer: this._datasourceDataSourceNameForServer,
                userName: this._datasourceUserName,
                password: this._datasourcePassword,
                query: this._datasourceQuery,
                usesUnicode: this._datasourceUsesUnicode,
            };
        } else if (this._datasourceType === 'TM1CubeView') {
            bodyAsDict['DataSource'] = {
                Type: this._datasourceType,
                // Note: tm1py uses _datasource_data_source_name_for_server for BOTH client and server
                dataSourceNameForClient: this._datasourceDataSourceNameForServer,
                dataSourceNameForServer: this._datasourceDataSourceNameForServer,
                view: this._datasourceView,
            };
        } else if (this._datasourceType === 'TM1DimensionSubset') {
            bodyAsDict['DataSource'] = {
                Type: this._datasourceType,
                // Note: tm1py uses _datasource_data_source_name_for_server for BOTH client and server
                dataSourceNameForClient: this._datasourceDataSourceNameForServer,
                dataSourceNameForServer: this._datasourceDataSourceNameForServer,
                subset: this._datasourceSubset,
            };
        } else if (this._datasourceType === 'JSON') {
            bodyAsDict['DataSource'] = {
                Type: this._datasourceType,
                // Note: tm1py uses _datasource_data_source_name_for_server for BOTH client and server
                dataSourceNameForClient: this._datasourceDataSourceNameForServer,
                dataSourceNameForServer: this._datasourceDataSourceNameForServer,
                jsonRootPointer: this._datasourceJsonRootPointer,
                jsonVariableMapping: this._datasourceJsonVariableMapping,
            };
        }

        return bodyAsDict;
    }
}