///<reference path="./typings/es6-extends.d.ts" />
///<reference path="./typings/es6-promise.d.ts" />
///<reference path="./typings/greasemonkey.d.ts" />
///<reference path="./typings/iitc.d.ts" />
///<reference path="./typings/jquery.d.ts" />
///<reference path="./interfaces.d.ts" />


// ==UserScript==
// @id             iitc-plugin-log-manager@noxi515
// @name           IITC plugin: LogManager
// @category       Controls
// @version        0.1
// @namespace      http://git.noxi.biz/ingress/iitc-log-manager
// @description    ＼( 'ω')／
// @updateURL      http://git.noxi.biz/ingress/iitc-log-manager/raw/master/log-manager.meta.js
// @downloadURL    http://git.noxi.biz/ingress/iitc-log-manager/raw/master/log-manager.user.js
// @include        https://www.ingress.com/intel*
// @include        http://www.ingress.com/intel*
// @match          https://www.ingress.com/intel*
// @match          http://www.ingress.com/intel*
// @grant          none
// ==/UserScript==

function wrapper(plugin_info: GMPluginInfo) {
    'use strict';

    let consts: LogManagerConstants = {
        ROW_LIMIT: 1000,

        TEAM_ENL: 0,
        TEAM_RES: 1,
        TYPE_NONE: 0,
        TYPE_DESTROY_RESONATOR: 1,
        TYPE_DESTROY_LINK: 2,
        TYPE_DESTROY_FIELD: 3,
        TYPE_CAPTURE_PORTAL: 4,
        TYPE_DEPLOY_RESONATOR: 5,
        TYPE_CREATE_LINK: 6,
        TYPE_CREATE_FIELD: 7,

        instance: null,

        convertTeam: (text: string): number => text === 'RESISTANCE' ? consts.TEAM_RES : consts.TEAM_ENL,
        convertType: (text: string): number => {
            if (!text) {
                return consts.TYPE_NONE;
            } else if (text === ' destroyed a Resonator on ') {
                return consts.TYPE_DESTROY_RESONATOR;
            } else if (text === ' destroyed the Link ') {
                return consts.TYPE_DESTROY_LINK;
            } else if (text === ' destroyed a Control Field @') {
                return consts.TYPE_DESTROY_FIELD;
            } else if (text === ' captured ') {
                return consts.TYPE_CAPTURE_PORTAL;
            } else if (text === ' deployed a Resonator on ') {
                return consts.TYPE_DEPLOY_RESONATOR;
            } else if (text === ' linked ') {
                return consts.TYPE_CREATE_LINK;
            } else if (text === ' created a Control Field @') {
                return consts.TYPE_CREATE_FIELD;
            } else {
                return consts.TYPE_NONE;
            }
        },

        teamToCssClass: (team: number): string => team === 0 ? 'enl' : 'res',
        teamToLabel: (team: number): string => team === 0 ? 'ENL' : 'RES',
        typeToLabel: (type: number): string => {
            switch (type) {
                case consts.TYPE_NONE:
                    return '???';
                case consts.TYPE_DESTROY_RESONATOR:
                    return '-- Resonator';
                case consts.TYPE_DESTROY_LINK:
                    return '-- Link';
                case consts.TYPE_DESTROY_FIELD:
                    return '-- Field';
                case consts.TYPE_CAPTURE_PORTAL:
                    return '++ Capture';
                case consts.TYPE_DEPLOY_RESONATOR:
                    return '++ Resonator';
                case consts.TYPE_CREATE_LINK:
                    return '++ Link';
                case consts.TYPE_CREATE_FIELD:
                    return '++ Field';
                default:
                    return '';
            }
        },
        formatDate: (date: Date, format?: string): string  => {
            if (!format)
                format = 'yyyy-MM-dd HH:mm:ss.SSS';
            format = format.replace(/yyyy/g, `${date.getFullYear()}`);
            format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
            format = format.replace(/dd/g, ('0' + date.getDate()).slice(-2));
            format = format.replace(/HH/g, ('0' + date.getHours()).slice(-2));
            format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
            format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));
            if (format.match(/S/g)) {
                let milliSeconds = ('00' + date.getMilliseconds()).slice(-3);
                let length = format.match(/S/g).length;
                for (var i = 0; i < length; i++) {
                    format = format.replace(/S/, milliSeconds.substring(i, i + 1));
                }
            }
            return format;
        },
        createPortalLink: (log: Log): string => {
            let lat = log.portalLat / 1000000;
            let lng = log.portalLng / 1000000;
            return `/intel?ll=${lat},${lng}&z=17&pll=${lat},${lng}`;
        }
    };

    class LogManagerImpl implements LogManager {

        private static findFromMarkup(array: Array<Array<string|PlainText|Player|PortalInfo>>, type: string): any {
            for (var i = 0; i < array.length; i++) {
                let data = array[i];
                if (<string>data[0] == type)
                    return data[1];
            }

            return null;
        }

        private db: LogDB;
        private dialog: LogManagerDialog;

        constructor(private _window: PluginWindow, private plugin_info: GMPluginInfo) {
            if (typeof _window.plugin !== 'function') {
                _window.plugin = () => {
                };
            }

            consts.instance = this;
            _window.plugin.logManager = consts;

            this.db = new LogDB();
        }

        private initUI() {
            if (this._window.useAndroidPanes()) {
                // not supported
                return;
            }

            // Dialog open callback
            $('body').on('dialogopen', (ev: Event) => {
                let target = <HTMLElement>ev.target;
                if (target.id != 'dialog-log-manager')
                    return;

                this.onDialogOpen(target);
            });

            $('#toolbox').append(`<a id="toolbox-show-logs-popup" title="Display a public chat log view [w]" accesskey="w">Logs</a>`);
            $('#toolbox-show-logs-popup').on('click', () => {
                // dialog exists
                if ($('#dialog-log-manager').length > 0)
                    return;

                this._window.dialog({
                    "id": 'log-manager',
                    "title": 'Logs',
                    "html": `<div id="log-manager-dialog-body"></div>`,
                    "width": 900,
                    "closeCallback": () => {
                        this.dialog = null;
                    }
                });
            });
        }

        private onDialogOpen(target: Element) {
            this.dialog = new LogManagerDialogImpl($(target));
            this.dialog.setOnFilterValuesChangeListener(values => this.onFilterValuesChanged(values));

            this.db.getAll(consts.ROW_LIMIT)
                .then(result => this.dialog.updateLogs(result))
                .catch(e => console.error(`Fetch Error: ${e}`));
        }

        private onFilterValuesChanged(values: FilterValues) {
            let indexNameArgs: Array<string> = [];
            let args: Array<any> = [];
            if (values.type) {
                indexNameArgs.push('type');
                args.push(values.type);
            }
            if (values.pname) {
                indexNameArgs.push('pname');
                args.push(values.pname);
            }
            if (values.agname) {
                indexNameArgs.push('agname');
                args.push(values.agname);
            }

            var promise: Promise<QueryResult<Log>>;
            if (indexNameArgs.length == 0) {
                if (!values.dateFrom && !values.dateTo) {
                    promise = this.db.getAll(consts.ROW_LIMIT);
                } else {
                    let lower = values.dateFrom ? values.dateFrom : new Date(2015, 1, 1, 0, 0, 0, 0);
                    let upper = values.dateTo ? values.dateTo : new Date();
                    promise = this.db.getWithCondition('time', consts.ROW_LIMIT, IDBKeyRange.bound(lower, upper));
                }
            } else {
                indexNameArgs.push('time');

                let lower = args.slice();
                lower.push(values.dateFrom ? values.dateFrom : new Date(2015, 1, 1, 0, 0, 0, 0));
                let upper = args.slice();
                upper.push(values.dateTo ? values.dateTo : new Date());
                promise = this.db.getWithCondition(indexNameArgs.join(','), consts.ROW_LIMIT, IDBKeyRange.bound(lower, upper));
            }

            promise.then(result => this.dialog.updateLogs(result))
                   .catch(e => console.error(`Fetch Error: ${e}`));
        }

        private onPublishChatDataAvailable(data: PublishChatData) {
            let result = data.result;
            let logs: Array<Log> = [];

            result.forEach(chat => {
                    let time = new Date(chat[1]);
                    let detail: ChatDetail = chat[2].plext;
                    let player: Player = LogManagerImpl.findFromMarkup(detail.markup, "PLAYER");
                    let text: PlainText = LogManagerImpl.findFromMarkup(detail.markup, "TEXT");
                    let portal: PortalInfo = LogManagerImpl.findFromMarkup(detail.markup, "PORTAL");

                    let log: Log = {
                        "id": (<string>chat[0]).substr(0, 32),
                        "time": time,
                        "type": consts.convertType(text.plain),
                        "playerName": player.plain,
                        "playerTeam": consts.convertTeam(player.team),
                        "portalName": portal.name,
                        "portalLat": portal.latE6,
                        "portalLng": portal.lngE6,
                        "portalTeam": consts.convertTeam(portal.team)
                    };

                    logs.push(log);
                }
            );

            this.db.addAll(logs);
            console.info(`${logs.length} chat logs inserted.`);
        }

        public exec() {
            let setup: any = () => {
                this.initUI();
                this._window.addHook('publicChatDataAvailable', (data: PublishChatData) => this.onPublishChatDataAvailable(data));
            };
            setup.info = this.plugin_info;
            (this._window.bootPlugins || (this._window.bootPlugins = [])).push(setup);

            // if IITC has already booted, immediately run the 'setup' function
            if (this._window.iitcLoaded)
                setup();
        }
    }

    class LogManagerDialogImpl implements LogManagerDialog {

        private $title: JQuery;
        private $filters: JQuery;
        private $table: JQuery;
        private $inputs: JQuery;

        private wrappers: Array<LogRowWrapper> = new Array(1000);

        private filterChangeListener: (values: FilterValues) => void;
        private filterValues: FilterValues = {};

        constructor(private $root: JQuery) {
            this.$title = $root.prev().find('.ui-dialog-title');
            this.$filters = $($('#noxi-log-filter-template').html());
            this.$table = $($('#noxi-log-table-template').html());

            let $tableBody = $(this.$table.find('tbody'));
            let logRowTemplate = $('#noxi-log-row-template').html();
            for (var i = 0; i < 1000; i++) {
                let $row = $(logRowTemplate);
                $tableBody.append($row);
                this.wrappers[i] = new LogRowWrapper($row);
            }

            // Links in dialog events
            // Portal GUID unknown...so cannot open the portal panel...
            $tableBody.on('click', '.nx-plink', (ev: Event) => {
                ev.preventDefault();
            });

            this.$root.children()
                .append(this.$filters)
                .append(this.$table);

            this.$inputs = this.$filters.find('input:text, select');

            this.$filters
                .on('keyup', 'input:text', ev => {
                    if (ev.keyCode !== 13)
                        return;

                    this.onFilterChanged();
                })
                .on('change', 'select', ev => this.onFilterChanged());
        }

        public setOnFilterValuesChangeListener(listener: (values: FilterValues) => void) {
            this.filterChangeListener = listener;
        }

        public updateLogs(result: QueryResult<Log>): void {
            let logs = result.values;
            this.$title.text(`Logs (${logs.length} in ${result.count})`);

            let length = logs.length;
            this.wrappers.forEach((w: LogRowWrapper, i: number) => w.log = i < length ? logs[i] : null);
        }

        private onFilterChanged() {
            let newValues: FilterValues = {};
            for (var i = 0; i < this.$inputs.length; i++) {
                let el = <HTMLInputElement|HTMLSelectElement>this.$inputs[i];
                if (!el.checkValidity())
                    return;

                let key = el.id.replace(/^log-manager-/, '');
                let value = el.value;

                switch (key) {
                    case 'type':
                        newValues.type = value ? parseInt(value) : null;
                        break;

                    case 'pname':
                        newValues.pname = value ? value : null;
                        break;

                    case 'agname':
                        newValues.agname = value ? value : null;
                        break;

                    case 'dateFrom':
                        newValues.dateFrom = value ? new Date(value.replace(/\s/, 'T')) : null;
                        break;

                    case 'dateTo':
                        newValues.dateTo = value ? new Date(value.replace(/\s/, 'T')) : null;
                        break;
                }
            }

            this.filterValues = newValues;
            this.filterChanged();
        }

        private filterChanged() {
            if (this.filterChangeListener)
                this.filterChangeListener(this.filterValues);
        }
    }

    class LogRowWrapper {

        private root: HTMLTableRowElement;
        private time: HTMLTableDataCellElement;
        private type: HTMLTableDataCellElement;
        private portalName: HTMLAnchorElement;
        private portalTeam: HTMLTableDataCellElement;
        private playerName: HTMLTableDataCellElement;
        private playerTeam: HTMLTableDataCellElement;

        private _log: Log;

        get log() {
            return this._log;
        }

        set log(log: Log) {
            if (log == null) {
                this.$root.hide();
                return;
            }

            this.$root.show();

            this.time.textContent = consts.formatDate(log.time);
            this.type.textContent = consts.typeToLabel(log.type);
            this.portalName.textContent = log.portalName;
            this.portalName.href = consts.createPortalLink(log);
            this.portalTeam.textContent = consts.teamToLabel(log.portalTeam);
            this.playerName.textContent = log.playerName;
            this.playerTeam.textContent = consts.teamToLabel(log.playerTeam);

            LogRowWrapper.updateTeamCssClass(this.root, log.playerTeam);
            LogRowWrapper.updateTeamCssClass(this.portalTeam, log.portalTeam);
            LogRowWrapper.updateTeamCssClass(this.playerTeam, log.playerTeam);

            this._log = log;
        }

        constructor(private $root: JQuery) {
            this.root = <HTMLTableRowElement>$root[0];
            this.time = <HTMLTableDataCellElement>this.root.children[0];
            this.type = <HTMLTableDataCellElement>this.root.children[1];
            this.portalName = <HTMLAnchorElement>(<HTMLElement>this.root.children[2]).children[0];
            this.portalTeam = <HTMLTableDataCellElement>this.root.children[3];
            this.playerName = <HTMLTableDataCellElement>this.root.children[4];
            this.playerTeam = <HTMLTableDataCellElement>this.root.children[5];
        }

        private static updateTeamCssClass(element: Element, newTeam: number) {
            element.classList.remove('enl');
            element.classList.remove('res');
            element.classList.add(consts.teamToCssClass(newTeam));
        }

    }

    class LogDB {

        private db: DBDatabase;

        constructor() {
            let req = indexedDB.open('log-manager', 2);
            req.onerror = () => console.error('IndexedDB open error');
            req.onsuccess = ev => this.db = (<any>ev.target).result;
            req.onupgradeneeded = ev => {
                this.db = (<any>ev.target).result;
                this.db.onerror = ev => console.error(`DB error: ${ev}`);

                let store: DBObjectStore<Log>;
                if (this.db.objectStoreNames.contains('logs')) {
                    store = this.db.transaction('logs', 'readwrite').objectStore('logs');
                    var indexNames = store.indexNames;
                    for (var i = 0; i < indexNames.length; i++) {
                        store.deleteIndex(indexNames[i]);
                    }
                } else {
                    store = this.db.createObjectStore('logs', {"keyPath": "id"});
                }

                let nonUnique = {"unique": false};
                store.createIndex('time', 'time', nonUnique);

                store.createIndex('type,time', ['type', 'time'], nonUnique);
                store.createIndex('type,pname,time', ['type', 'portalName', 'time'], nonUnique);
                store.createIndex('type,agname,time', ['type', 'playerName', 'time'], nonUnique);
                store.createIndex('type,pname,agname,time', ['type', 'portalName', 'playerName', 'time'], nonUnique);

                store.createIndex('pname,time', ['portalName', 'time'], nonUnique);
                store.createIndex('pname,agname,time', ['portalName', 'playerName', 'time'], nonUnique);

                store.createIndex('agname,time', ['playerName', 'time'], nonUnique);

                store.createIndex('loc,time', ['portalLat', 'portalLng', 'time'], nonUnique);
                store.createIndex('type,loc,time', ['type', 'portalLat', 'portalLng', 'time'], nonUnique);
                store.createIndex('type,loc,pname,time', ['type', 'portalLat', 'portalLng', 'portalName', 'time'], nonUnique);
                store.createIndex('type,loc,agname,time', ['type', 'portalLat', 'portalLng', 'playerName', 'time'], nonUnique);
                store.createIndex('type,loc,pname,agname,time', ['type', 'portalLat', 'portalLng', 'portalName', 'playerName', 'time'], nonUnique);
            };
        }

        public add(log: Log) {
            this.getWritableStore().add(log);
        }

        public addAll(logs: Array<Log>) {
            let store = this.getWritableStore();
            for (var i = 0; i < logs.length; i++) {
                store.add(logs[i]);
            }
        }

        public getAll(limit: number): Promise<QueryResult<Log>> {
            return this.getWithCondition('time', limit, null);
        }

        public getWithCondition(indexName: string, limit: number, range: IDBKeyRange) {
            return this.getCount(indexName, range)
                       .then(count => this.fetch(indexName, count > limit ? limit : count, range)
                                          .then(logs => Promise.resolve({"count": count, "values": logs})));
        }

        public clearAll() {
            this.getWritableStore().clear();
        }

        private getCount(indexName: string, range: IDBKeyRange = null): Promise<number> {
            return new Promise((resolve: (count: number) => any, reject: (ev: Event) => any) => {
                let req = range
                    ? this.getWritableStore().index(indexName).count(range)
                    : this.getWritableStore().index(indexName).count();
                req.onerror = reject;
                req.onsuccess = () => resolve(req.result);
            });
        }

        private fetch(indexName: string, limit: number, range: IDBKeyRange = null, direction: string = 'prev'): Promise<Array<Log>> {
            return new Promise((resolve: (logs: Array<Log>) => any, reject: (ev: Event) => any) => {
                let req = this.getWritableStore().index(indexName).openCursor(range, direction);
                let logs: Array<Log> = [];
                req.onerror = reject;
                req.onsuccess = (ev: any) => {
                    var cursor: DBCursor<Log> = ev.target.result;
                    if (cursor) {
                        logs.push(cursor.value);

                        if (logs.length < limit) {
                            cursor.continue();
                        } else {
                            resolve(logs);
                        }
                    } else {
                        resolve(logs);
                    }
                };
            });
        }

        private getWritableStore(): DBObjectStore<Log> {
            return this.db.transaction(['logs'], 'readwrite').objectStore('logs');
        }

        private getReadableStore(): DBObjectStore<Log> {
            return this.db.transaction(['logs'], 'readonly').objectStore('logs');
        }

    }

    new LogManagerImpl(<PluginWindow>window, plugin_info).exec();
}

// inject code into site context
let script = document.createElement('script');
script.id = 'noxi-iitc-log-manager';
let info: any = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = {
    version: GM_info.script.version,
    name: GM_info.script.name,
    description: GM_info.script.description
};
script.appendChild(document.createTextNode(`(${wrapper})(${JSON.stringify(info)});`));
(document.body || document.head || document.documentElement).appendChild(script);


// BEGIN CSS

let style = document.createElement('style');
style.id = 'noxi-iitc-log-manager-css';
style.type = 'text/css';
style.appendChild(document.createTextNode(`
#dialog-log-manager {
    max-width: 900px !important;
}

.log-manager-logs {
    table-layout: fixed;
    width: 876px;
}

.log-manager-logs th,
.log-manager-logs td {
    border-bottom: 1px solid #0B314E;
    padding: 3px 5px;
}

.log-manager-logs td {
    white-space: nowrap;
    overflow: hidden;
}

.log-manager-logs .nx-time {
    width: 150px;
}

.log-manager-logs .nx-type {
    width: 80px;
}

.log-manager-logs .nx-pname {
    width: 400px;
}

.log-manager-logs .nx-pteam,
.log-manager-logs .nx-agteam {
    width: 38px;
}

.log-manager-logs .nx-agname {
    width: 100px;
}

.log-manager-logs tr.enl,
.log-manager-logs td.enl {
    color: #03FE03 !important;
}

.log-manager-logs tr.res,
.log-manager-logs td.res {
    color: #00C5FF !important;
}

.log-manager-logs tr.enl {
    background-color: #017F01;
}

.log-manager-logs tr.res {
    background-color: #005684;
}

.log-manager-filters {
}

.log-manager-filter-row {
}

.log-manager-filter {
    float: left;
    width: 32%;
    height: 26px;
}

.log-manager-filter label {
    width: 35%;
    float: left;
    padding-top: 6px;
    font-size: 14px;
    font-weight: bold;
}

.log-manager-filter div.filter-container {
    width: 65%;
    float: left;
}
`));
document.head.appendChild(style);

// END CSS


// BEGIN HTML Template

let logFilterTemplate = <HTMLScriptElement>document.createElement('script');
logFilterTemplate.id = 'noxi-log-filter-template';
logFilterTemplate.type = 'text/template';
logFilterTemplate.appendChild(document.createTextNode(`
<div class="log-manager-filters">
    <div class="log-manager-filter-row">
        <div class="log-manager-filter">
            <label for="log-manager-type">Type</label>
            <div class="filter-container">
                <select id="log-manager-type">
                    <option value="">ALL</option>
                    <option value="1">Destroy resonator</option>
                    <option value="2">Destroy link</option>
                    <option value="3">Destroy field</option>
                    <option value="4">Capture portal</option>
                    <option value="5">Deploy resonator</option>
                    <option value="6">Create link</option>
                    <option value="7">Create field</option>
                </select>
            </div>
        </div>
        <div class="log-manager-filter">
            <label for="log-manager-pname">Portal Name</label>
            <div class="filter-container">
                <input type="text" id="log-manager-pname" placeholder="Portal name"/>
            </div>
        </div>
        <div class="log-manager-filter">
            <label for="log-manager-dateFrom">Date From</label>
            <div class="filter-container">
                <input type="text" id="log-manager-dateFrom" placeholder="2015-01-01 00:00:00" pattern="\\d{4}-\\d{2}-\\d{2}\\s\\d{2}:\\d{2}:\\d{2}">
            </div>
        </div>
    </div>
    <div class="log-manager-filter-row">
        <div class="log-manager-filter">
        </div>
        <div class="log-manager-filter">
            <label for="log-manager-agname">Agent Name</label>
            <div class="filter-container">
                <input type="text" id="log-manager-agname" placeholder="Agent name">
            </div>
        </div>
        <div class="log-manager-filter">
            <label for="log-manager-dateTo">Date To</label>
            <div class="filter-container">
                <input type="text" id="log-manager-dateTo" placeholder="2015-01-01 00:00:00" pattern="\\d{4}-\\d{2}-\\d{2}\\s\\d{2}:\\d{2}:\\d{2}"/>
            </div>
        </div>
    </div>
</div>
`));
document.body.appendChild(logFilterTemplate);

let logTableTemplate = <HTMLScriptElement>document.createElement('script');
logTableTemplate.id = 'noxi-log-table-template';
logTableTemplate.type = 'text/template';
logTableTemplate.appendChild(document.createTextNode(`
<table class="log-manager-logs">
    <thead>
    <tr>
        <th class="nx-time">Time</th>
        <th class="nx-type">Type</th>
        <th class="nx-pname">Portal Name</th>
        <th class="nx-pteam">Portal Team</th>
        <th class="nx-agname">Player Name</th>
        <th class="nx-agteam">Player Team</th>
    </tr>
    </thead>
    <tbody>
    </tbody>
</table>
`));
document.body.appendChild(logTableTemplate);

let logRowTable = <HTMLScriptElement>document.createElement('script');
logRowTable.id = 'noxi-log-row-template';
logRowTable.type = 'text/template';
logRowTable.appendChild(document.createTextNode(`
<tr class="log-manager-row" style="display: none;">
    <td class="nx-time"></td>
    <td class="nx-type"></td>
    <td class="nx-pname">
        <a class="nx-plink"></a>
    </td>
    <td class="nx-pteam"></td>
    <td class="nx-agname"></td>
    <td class="nx-agteam"></td>
</tr>
`));
document.body.appendChild(logRowTable);

// END HTML Template
