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
    private _hasSecurityAccess: boolean;
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
    private _datasourceAsciiHeaderRecords: number;
    private _datasourceAsciiQuoteCharacter: string;
    private _datasourceAsciiThousandSeparator: string;
    private _datasourceDataSourceNameForClient: string;
    private _datasourceDataSourceNameForServer: string;
    private _datasourcePassword: string;
    private _datasourceUserName: string;
    private _datasourceQuery: string;
    private _datasourceUsesUnicode: boolean;
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
        hasSecurityAccess: boolean = false,
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
        datasourceAsciiHeaderRecords: number = 1,
        datasourceAsciiQuoteCharacter: string = '',
        datasourceAsciiThousandSeparator: string = ',',
        datasourceDataSourceNameForClient: string = '',
        datasourceDataSourceNameForServer: string = '',
        datasourcePassword: string = '',
        datasourceUserName: string = '',
        datasourceQuery: string = '',
        datasourceUsesUnicode: boolean = true,
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
        this._variablesUiData = variablesUiData ? Array.from(variablesUiData) : [];
        this._prologProcedure = prologProcedure;
        this._metadataProcedure = metadataProcedure;
        this._dataProcedure = dataProcedure;
        this._epilogProcedure = epilogProcedure;
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

    public get hasSecurityAccess(): boolean {
        return this._hasSecurityAccess;
    }

    public set hasSecurityAccess(value: boolean) {
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
        return new Process(
            processAsDict.Name,
            processAsDict.HasSecurityAccess || false,
            processAsDict.UIData || "CubeAction=1511\fDataAction=1503\fCubeLogChanges=0\f",
            processAsDict.Parameters || [],
            processAsDict.Variables || [],
            processAsDict.VariablesUIData || [],
            processAsDict.PrologProcedure || '',
            processAsDict.MetadataProcedure || '',
            processAsDict.DataProcedure || '',
            processAsDict.EpilogProcedure || '',
            processAsDict.DataSource?.Type || 'None',
            processAsDict.DataSource?.AsciiDecimalSeparator || '.',
            processAsDict.DataSource?.AsciiDelimiterChar || ';',
            processAsDict.DataSource?.AsciiDelimiterType || 'Character',
            processAsDict.DataSource?.AsciiHeaderRecords || 1,
            processAsDict.DataSource?.AsciiQuoteCharacter || '',
            processAsDict.DataSource?.AsciiThousandSeparator || ',',
            processAsDict.DataSource?.DataSourceNameForClient || '',
            processAsDict.DataSource?.DataSourceNameForServer || '',
            processAsDict.DataSource?.Password || '',
            processAsDict.DataSource?.UserName || '',
            processAsDict.DataSource?.Query || '',
            processAsDict.DataSource?.UsesUnicode !== false,
            processAsDict.DataSource?.View || '',
            processAsDict.DataSource?.Subset || '',
            processAsDict.DataSource?.JsonRootPointer || '',
            processAsDict.DataSource?.JsonVariableMapping || ''
        );
    }

    public get body(): string {
        return JSON.stringify(this.constructBody());
    }

    public get bodyAsDict(): any {
        return this.constructBody();
    }

    private constructBody(): any {
        const body: any = {
            Name: this._name,
            HasSecurityAccess: this._hasSecurityAccess,
            UIData: this._uiData,
            Parameters: this._parameters,
            Variables: this._variables,
            VariablesUIData: this._variablesUiData,
            PrologProcedure: this._prologProcedure,
            MetadataProcedure: this._metadataProcedure,
            DataProcedure: this._dataProcedure,
            EpilogProcedure: this._epilogProcedure
        };

        // Add DataSource information
        body.DataSource = {
            Type: this._datasourceType,
            AsciiDecimalSeparator: this._datasourceAsciiDecimalSeparator,
            AsciiDelimiterChar: this._datasourceAsciiDelimiterChar,
            AsciiDelimiterType: this._datasourceAsciiDelimiterType,
            AsciiHeaderRecords: this._datasourceAsciiHeaderRecords,
            AsciiQuoteCharacter: this._datasourceAsciiQuoteCharacter,
            AsciiThousandSeparator: this._datasourceAsciiThousandSeparator,
            DataSourceNameForClient: this._datasourceDataSourceNameForClient,
            DataSourceNameForServer: this._datasourceDataSourceNameForServer,
            Password: this._datasourcePassword,
            UserName: this._datasourceUserName,
            Query: this._datasourceQuery,
            UsesUnicode: this._datasourceUsesUnicode,
            View: this._datasourceView,
            Subset: this._datasourceSubset,
            JsonRootPointer: this._datasourceJsonRootPointer,
            JsonVariableMapping: this._datasourceJsonVariableMapping
        };

        return body;
    }
}