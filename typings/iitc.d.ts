///<reference path="./jquery.d.ts" />

declare interface IITCWindow extends Window {

    // boot.js
    iitcLoaded: boolean;

    // dialog.jsx
    dialog(options: IITCDialogOptions): void;


    // hooks.js
    runHooks(event: string, data: any): void;
    pluginCreateHook(event: string) : void;
    addHook(event: string, callback: any): void;
    removeHook(event: string, callback: any): void;

    // portal_info.js
    getPortalLevel(d: any): number;
    getTotalPortalEnergy(d: any): number;
    getPortalEnergy(d: any): number;
    getCurrentPortalEnergy(d: any): number;

    // smartphone.js
    useAndroidPanes(): boolean;
}

declare interface IITCDialogOptions {
    id: string;
    text?: string;
    html?: string|JQuery;
    title?: string;
    modal?: boolean;
    dialogClass?: string;
    draggable?: boolean;
    width?: number|string;
    height?: number|string;

    closeCallback?: () => void;
    collapseCallback?: () => void;
    expandCallback?: () => void;
    collapseExpandCallback?: (collapsing: boolean) => void;
    focusCallback?: () => void;
    blurCallback?: () => void;
}