export class Server {
    /** Abstraction of the TM1 Server
     *
     *    :Notes:
     *        contains the information you get from http://localhost:5895/Servers
     *        no methods so far
     */
    public name: string;
    public ipAddress: string;
    public ipV6Address: string;
    public portNumber: number;
    public clientMessagePortNumber: number;
    public httpPortNumber: number;
    public usingSSL: boolean;
    public acceptingClients: boolean;
    public selfRegistered: boolean;
    public host: string;
    public isLocal: boolean;
    public sslCertificateId: string;
    public sslCertificateAuthority: string;
    public sslCertificateRevocationList: string;
    public clientExportSslServerKeyId: string;
    public clientExportSslServerCert: string;
    public lastUpdated: string;

    constructor(serverAsDict: Record<string, any>) {
        this.name = serverAsDict['Name'];
        this.ipAddress = serverAsDict['IPAddress'];
        this.ipV6Address = serverAsDict['IPv6Address'];
        this.portNumber = serverAsDict['PortNumber'];
        this.clientMessagePortNumber = serverAsDict['ClientMessagePortNumber'];
        this.httpPortNumber = serverAsDict['HTTPPortNumber'];
        this.usingSSL = serverAsDict['UsingSSL'];
        this.acceptingClients = serverAsDict['AcceptingClients'];
        this.selfRegistered = serverAsDict['SelfRegistered'];
        this.host = serverAsDict['Host'];
        this.isLocal = serverAsDict['IsLocal'];
        this.sslCertificateId = serverAsDict['SSLCertificateID'];
        this.sslCertificateAuthority = serverAsDict['SSLCertificateAuthority'];
        this.sslCertificateRevocationList = serverAsDict['SSLCertificateRevocationList'];
        this.clientExportSslServerKeyId = serverAsDict['ClientExportSSLSvrKeyID'];
        this.clientExportSslServerCert = serverAsDict['ClientExportSSLSvrCert'];
        this.lastUpdated = serverAsDict['LastUpdated'];
    }
}