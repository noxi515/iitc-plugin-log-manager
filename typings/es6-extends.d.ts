interface DBDatabase extends IDBDatabase {
    name: string;
    objectStoreNames: DOMStringList;
    onabort: (ev: Event) => any;
    onerror: (ev: Event) => any;
    version: string;
    close(): void;
    createObjectStore<T>(name: string, optionalParameters?: any): DBObjectStore<T>;
    deleteObjectStore(name: string): void;
    transaction(storeNames: any, mode?: string): DBTransaction;
    addEventListener(type: "abort", listener: (ev: Event) => any, useCapture?: boolean): void;
    addEventListener(type: "error", listener: (ev: ErrorEvent) => any, useCapture?: boolean): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, useCapture?: boolean): void;
}

interface DBObjectStore<T> extends IDBObjectStore {
    indexNames: DOMStringList;
    keyPath: string;
    name: string;
    transaction: DBTransaction;
    add(value: any, key?: any): IDBRequest;
    clear(): IDBRequest;
    count(key?: any): IDBRequest;
    createIndex(name: string, keyPath: string|Array<string>, optionalParameters?: any): IDBIndex;
    delete(key: any): IDBRequest;
    deleteIndex(indexName: string): void;
    get(key: any): IDBRequest;
    index(name: string): DBIndex<T>;
    openCursor(range?: any, direction?: string): IDBRequest;
    put(value: any, key?: any): IDBRequest;
}

interface DBIndex<T> extends IDBIndex {
    keyPath: string;
    name: string;
    objectStore: DBObjectStore<T>;
    unique: boolean;
    count(key?: any): IDBRequest;
    get(key: any): IDBRequest;
    getKey(key: any): IDBRequest;
    openCursor(range?: IDBKeyRange, direction?: string): IDBRequest;
    openKeyCursor(range?: IDBKeyRange, direction?: string): IDBRequest;
    mozGetAll(key?: any, count?: number): IDBRequest;
}

interface DBTransaction extends IDBTransaction {
    db: DBDatabase;
    error: DOMError;
    mode: string;
    onabort: (ev: Event) => any;
    oncomplete: (ev: Event) => any;
    onerror: (ev: Event) => any;
    abort(): void;
    objectStore<T>(name: string): DBObjectStore<T>;
    READ_ONLY: string;
    READ_WRITE: string;
    VERSION_CHANGE: string;
    addEventListener(type: "abort", listener: (ev: Event) => any, useCapture?: boolean): void;
    addEventListener(type: "complete", listener: (ev: Event) => any, useCapture?: boolean): void;
    addEventListener(type: "error", listener: (ev: ErrorEvent) => any, useCapture?: boolean): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, useCapture?: boolean): void;
}

interface DBCursor<T> extends IDBCursor {
    direction: string;
    key: any;
    primaryKey: any;
    source: any;
    advance(count: number): void;
    continue(key?: any): void;
    delete(): IDBRequest;
    update(value: any): IDBRequest;
    NEXT: string;
    NEXT_NO_DUPLICATE: string;
    PREV: string;
    PREV_NO_DUPLICATE: string;
    value: T;
}