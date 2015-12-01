///<reference path="../typings/es6-promise/es6-promise.d.ts" />
///<reference path="../typings/greasemonkey/greasemonkey.d.ts" />
///<reference path="../typings/jquery/jquery.d.ts" />
///<reference path="../typings/iitc.d.ts" />

interface GMPluginInfo {
}

interface PluginWindow extends IITCWindow {
    bootPlugins?: Array<any>;
    plugin?: PluginHolder;
}

interface PluginHolder extends Function {
    logManager?: LogManagerConstants;
}

interface LogManagerConstants {
    ROW_LIMIT: number;

    TEAM_NEU: number;
    TEAM_ENL: number;
    TEAM_RES: number;

    TYPE_NONE: number;
    TYPE_DESTROY_RESONATOR: number;
    TYPE_DESTROY_LINK: number;
    TYPE_DESTROY_FIELD: number;
    TYPE_CAPTURE_PORTAL: number;
    TYPE_DEPLOY_RESONATOR: number;
    TYPE_CREATE_LINK: number;
    TYPE_CREATE_FIELD: number;

    instance: LogManager;
    configDialog: LogManagerConfigDialog

    convertTeam(team: string): number;
    convertType(type: string): number;

    teamToCssClass(team: number): string;
    teamToLabel(team: number): string;
    typeToLabel(type: number): string;
    formatDate(date: Date, format?: string): string;
    createPortalLink(log: Log): string;
}

interface PublishChatData {
    raw: Array<any>
    result: Array<Array<any>>
}

interface ChatDetail {
    text: string;
    markup: Array<Array<string|PlainText|Player|PortalInfo>>;
    plextType: string;
    categories: number;
    team: string;
}

interface PlainText {
    plain: string;
}

interface Player {
    plain: string;
    team: string;
}

interface PortalInfo {
    name: string;
    plain: string;
    team: string;
    latE6: number;
    address: string;
    lngE6: number;
}

interface Log {
    id: string;
    type: number;
    time: Date;
    playerName: string;
    playerTeam: number;
    portalName: string;
    portalLat: number;
    portalLng: number;
    portalTeam: number;
}

interface LogManager {

}

interface QueryResult<T> {
    count: number;
    values: Array<T>
}

interface FilterValues {
    type?: number;
    pname?: string;
    agname?: string;
    dateFrom?: Date;
    dateTo?: Date;
}

interface LogManagerDialog {
    updateLogs(logs: QueryResult<Log>): void;
    setOnFilterValuesChangeListener(listener: (values: FilterValues) => void): void;
}

interface LogManagerConfigDialog {
    show(): void;
}