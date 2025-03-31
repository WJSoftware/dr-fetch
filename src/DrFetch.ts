import { aborted } from "util";
import type { BodyParserFn, CloneOptions, FetchFn, FetchFnInit, FetchFnUrl, FetchResult, StatusCode } from "./types.js";
import { hasHeader, setHeaders } from "./headers.js";

/**
 * List of patterns to match against the content-type response header.  If there's a match, the response is treated as 
 * JSON.
 */
const jsonTypes: (string | RegExp)[] = [
    /^application\/(\w+\+?)?json/,
];

/**
 * List of patterns to match against the content-type response header.  If there's a match, the response is treated as 
 * text.
 */
const textTypes: (string | RegExp)[] = [
    /^text\/.+/,
];

/**
 * Determines if the given object is a POJO.
 * @param obj Object under test.
 * @returns `true` if it is a POJO, or `false` otherwise.
 */
function isPojo(obj: unknown): obj is Record<string, any> {
    if (obj === null || typeof obj !== 'object') {
        return false;
    }
    const proto = Object.getPrototypeOf(obj);
    if (proto == null) {
        return true;
    }
    return proto === Object.prototype;
}

function jsonParser(response: Response) {
    return response.json();
}

function textParser(response: Response) {
    return response.text();
}

/**
 * # DrFetch
 * 
 * Class that wraps around the provided data-fetching function (or the standard `fetch` function) in order to provide 
 * full body typing.
 * 
 * ## How To Use
 * 
 * Create a new instance of this class to simplify fetching while being able to fully type the response body.  The 
 * process of typing the body can be done per HTTP status code.
 * 
 * @example
 * ```typescript
 * type ToDo = { id: number; text: string; }
 * type NotAuthBody = { loginUrl: string; }
 * 
 * const fetcher = new DrFetch()
 *     .for<200, ToDo[]>()
 *     .for<401, NotAuthBody>()
 *     ;
 * 
 * const response = await fetcher.go('api/todos');
 * // At this point, your editor's Intellisense will predict that response.body is either ToDo[] or NotAuthBody, and 
 * // TypeScript narrowing will work by either testing for response.ok or response.status:
 * if (response.status === 200 ) {
 *     // Do stuff with response.body, an array of ToDo objects.
 * }
 * else {
 *     // Redirect to the login page.
 *     window.location.href = response.body.loginUrl;
 * }
 * ```
 * 
 * ### Specifying the Same Type for Multiple Status Codes
 * 
 * This is done quite simply by specifying multiple status codes.
 * 
 * @example
 * ```typescript
 * const fetcher = new DrFetch()
 *     .for<200 | 201, { data: ToDo }>()
 *     ;
 * ```
 * 
 * You can also take advantage of the `OkStatusCode` and `NonOkStatusCode` types.  The former is all possible 2xx 
 * status codes; the latter is all other status codes.  There's also `ClientErrorStatusCode` for 4xx status codes, and 
 * `ServerErrorStatusCode` for 5xx errors.  Yes, `StatusCode` is one that comprehends all status codes.
 * 
 * @example
 * ```typescript
 * const fetcher = new DrFetch()
 *     .for<OkStatusCode, { data: ToDo }>()
 *     ;
 * ```
 * 
 * ## When to Create a New Fetcher
 * 
 * Create a new fetcher when your current one needs a different data-fetching function or a different set of custom 
 * processors.
 * 
 * A new fetcher object may be created by creating it from scratch using the class constructor, or by cloning an 
 * existing one using the parent's `clone` function.  When cloning, pass a new data-fetching function (if required) so 
 * the clone uses this one instead of the one of the parent fetcher.
 */
export class DrFetch<TStatusCode extends number = StatusCode, T = unknown, Abortable extends boolean = false> {
    #fetchFn: FetchFn;
    #customProcessors: [string | RegExp, (response: Response, stockParsers: { json: BodyParserFn<any>; text: BodyParserFn<string>; }) => Promise<any>][] = [];
    #fetchImpl: (url: FetchFnUrl, init?: FetchFnInit) => Promise<any>;
    #autoAbortMap: Map<string, AbortController> | undefined;

    async #abortableFetch(url: FetchFnUrl, init?: FetchFnInit) {
        try {
            return await this.#simpleFetch(url, init);
        }
        catch (err: unknown) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                return {
                    aborted: true,
                    error: err
                };
            }
            throw err;
        }
    }

    async #simpleFetch(url: FetchFnUrl, init?: FetchFnInit) {
        const response = await this.#fetchFn(url, init);
        const body = await this.#readBody(response);
        return {
            aborted: false,
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            body
        } as T;
    }

    /**
     * Initializes a new instance of this class.
     * 
     * If you would like to set interception before or after fetching, simply write a custom function that has the same 
     * signature as the stock `fetch` function that does what is required before or after fetching, and pass it as the 
     * first argument when creating the new instance.
     * 
     * @example
     * ```typescript
     * import { setHeaders, type FetchFnUrl, type FetchFnInit } from "dr-fetch";
     * 
     * async function myCustomFetch(url: FetchFnUrl, init?: FetchFnInit) {
     *     // Code before fetching is the equivalent of pre-fetch interception.
     *     const myToken = getMyToken();
     *     init = init ?? { };
     *     setHeaders(init, {
     *         Authorization: `Bearer ${myToken}`,
     *         Accept: 'application/json',
     *     });
     *     const response = await fetch(url, init);
     *     // Code after obtaining the response is the equivalent of post-fetch interception.
     *     // Post-fetch interception is usually unneeded.  Use custom processors instead.
     *     ...
     *     return response;
     * }
     * 
     * // Create fetcher instance now, and usually you export it.
     * export default new DrFetch(myCustomFetch);
     * ```
     * 
     * If you need to do special processing of the body, don't do post-interception and instead use the `withProcessor` 
     * function to register a custom body processor.
     * @param fetchFn Optional data-fetching function to use instead of the stock `fetch` function.
     */
    constructor(fetchFn?: FetchFn) {
        this.#fetchFn = fetchFn ?? fetch.bind(globalThis.window || global);
        this.#fetchImpl = this.#simpleFetch.bind(this);
    }

    /**
     * Gets a Boolean value indicating whether this fetcher object is in abortable mode or not.
     * 
     * **NOTE**:  Once in abortable mode, the fetcher object cannot be reverted to non-abortable mode.
     */
    get isAbortable() {
        return !!this.#autoAbortMap;
    }

    /**
     * Clones this fetcher object by creating a new fetcher object with the same data-fetching function, custom 
     * body processors, and data typing unless specified otherwise via the options parameter.
     * @param options Optional options to control which features are cloned.
     * @returns A new fetcher object that complies with the supplied (or if not supplied, the default) options.
     */
    clone<TInherit extends boolean = true, CloneAbortable extends boolean = true>(
        options?: CloneOptions<TInherit, CloneAbortable>
    ) {
        const opts = {
            fetchFn: undefined,
            includeProcessors: true,
            preserveTyping: true,
            preserveAbortable: true,
            ...options
        };
        const newClone = new DrFetch(opts.fetchFn === false ? undefined : opts?.fetchFn ?? this.#fetchFn);
        if (opts.includeProcessors) {
            newClone.#customProcessors = [...this.#customProcessors];
        }
        if (opts.preserveAbortable && this.isAbortable) {
            newClone.abortable();
        }
        return newClone as DrFetch<TStatusCode, TInherit extends true ? T : unknown, CloneAbortable>;
    }

    /**
     * Adds a custom processor to the fetcher object.
     * 
     * The custom processor will be used if the value of the `"content-type"` header satisfies the given pattern.  The 
     * pattern can be a string or regular expression, and when a string is used, the processor will qualify if the 
     * pattern is found inside the `Content-Type` HTTP header's value.
     * @param pattern String or regular expression used to test the value of the `Content-Type` HTTP response header.
     * @param processorFn Custom processor function that is given the HTTP response object and the stock body processors, 
     * and is responsible to return the body.
     * @returns The current fetcher object to enable fluent syntax.
     */
    withProcessor(
        pattern: string | RegExp,
        processorFn: (response: Response, stockParsers: { json: BodyParserFn<any>; text: BodyParserFn<string>; }) => Promise<any>
    ) {
        this.#customProcessors.push([pattern, processorFn]);
        return this;
    }

    /**
     * Alters this fetcher's response type by associating the given body type to the given status code type, which can 
     * be a single status code, or multiple status codes.
     * @returns This fetcher object with its response type modified to include the body specification provided.
     */
    for<TStatus extends TStatusCode, TBody = {}>() {
        return this as DrFetch<TStatusCode, FetchResult<T, TStatus, TBody>, Abortable>;
    }

    #contentMatchesType(contentType: string, types: (string | RegExp) | (string | RegExp)[]) {
        if (!Array.isArray(types)) {
            types = [types];
        }
        for (let pattern of types) {
            if (typeof pattern === 'string') {
                if (contentType.includes(pattern)) {
                    return true;
                }
            }
            else {
                if (pattern.test(contentType)) {
                    return true;
                }
            }
        }
        return false;
    }

    async #readBody(response: Response) {
        if (!response.body) {
            return null;
        }
        const contentType = response.headers.get('content-type');
        if (!contentType) {
            throw new Error('The response carries no content type header.  Cannot determine how to parse.');
        }
        // Custom processors have the highest priority.
        if (this.#customProcessors.length) {
            for (let [pattern, processorFn] of this.#customProcessors) {
                if (this.#contentMatchesType(contentType, pattern)) {
                    return await processorFn(response, {
                        json: jsonParser,
                        text: textParser,
                    });
                }
            }
        }
        if (this.#contentMatchesType(contentType, jsonTypes)) {
            return await jsonParser(response);
        }
        else if (this.#contentMatchesType(contentType, textTypes)) {
            return await textParser(response);
        }
        throw new Error(`Could not determine how to process body of type "${contentType}".  Provide a custom processor by calling 'withProcessor()'.`);
    }

    abortable() {
        this.#fetchImpl = this.#abortableFetch.bind(this);
        this.#autoAbortMap ??= new Map<string, AbortController>();
        return this as DrFetch<TStatusCode, T, true>;
    }

    /**
     * Fetches the specified URL using the specified options and returns information contained within the HTTP response 
     * object.
     * @param url URL parameter for the data-fetching function.
     * @param init Options for the data-fetching function.
     * @returns A response object with the HTTP response's `ok`, `status`, `statusText` and `body` properties.
     */
    async fetch(url: FetchFnUrl, init?: FetchFnInit): Promise<(Abortable extends true ? {
        aborted: true;
        error: DOMException;
    } | T : T)> {
        if (!this.#autoAbortMap && init?.autoAbort) {
            throw new Error('Cannot use autoAbort if the fetcher is not in abortable mode.  Call "abortable()" first.');
        }
        const autoAbort = {
            key: (typeof init?.autoAbort === 'string' ? init.autoAbort : init?.autoAbort?.key) ?? '',
            delay: typeof init?.autoAbort === 'string' ? undefined : init?.autoAbort?.delay,
        };
        if (autoAbort.key) {
            this.#autoAbortMap?.get(autoAbort.key)?.abort();
            const ac = new AbortController();
            this.#autoAbortMap!.set(autoAbort.key, ac);
            init ??= {};
            init.signal = ac.signal;
            if (autoAbort.delay !== undefined) {
                const aborted = await new Promise<boolean>((rs) => {
                    setTimeout(() => rs(ac.signal.aborted), autoAbort.delay);
                });
                if (aborted) {
                    // @ts-expect-error TS2322: A runtime check is in place to ensure that the type is correct.
                    return {
                        aborted: true,
                        error: new DOMException('Aborted', 'AbortError')
                    };
                }
            }
        }
        return await this.#fetchImpl(url, init)
            .finally(() => this.#autoAbortMap?.delete(autoAbort.key));
    }

    #createInit(body: BodyInit | null | Record<string, any> | undefined, init?: FetchFnInit) {
        init ??= {};
        let headers: [string, string] | undefined;
        if (isPojo(body) || Array.isArray(body)) {
            body = JSON.stringify(body);
            headers = ['content-type', 'application/json'];
        }
        if (headers && !hasHeader(init.headers ?? {}, 'content-type')) {
            setHeaders(init, [headers]);
        }
        init.body = body;
        return init;
    }

    /**
     * Shortcut method to emit a GET HTTP request.
     * @param url URL for the fetch function call.
     * @returns A response object with the HTTP response's `ok`, `status`, `statusText` and `body` properties.
     */
    get(url: URL | string, init?: Omit<FetchFnInit, 'method' | 'body'>) {
        return this.fetch(url, { ...init, method: 'GET' });
    }

    /**
     * Shortcut method to emit a HEAD HTTP request.
     * @param url URL for the fetch function call.
     * @returns A response object with the HTTP response's `ok`, `status`, `statusText` and `body` properties.
     */
    head(url: URL | string, init?: Omit<FetchFnInit, 'method' | 'body'>) {
        return this.fetch(url, { ...init, method: 'HEAD' });
    }

    /**
     * Shortcut method to emit a POST HTTP request.
     * @param url URL for the fetch function call.
     * @param body The data to send as body.
     * 
     * If a POJO is passed, it will be stringified and the `Content-Type` header of the request will be set to 
     * `'application/json'`.  This is also true with arrays.
     * 
     * > **NOTE**:  You must make sure that the POJO or the array (and its elements) you pass as body are serializable.
     * 
     * Any other body type will not generate a `Content-Type` header and will be reliant on what the `fetch()` function 
     * does in those cases.
     * @returns A response object with the HTTP response's `ok`, `status`, `statusText` and `body` properties.
     */
    post(url: URL | string, body?: BodyInit | null | Record<string, any>, init?: Omit<FetchFnInit, 'method' | 'body'>) {
        const fullInit = this.#createInit(body, init);
        fullInit.method = 'POST';
        return this.fetch(url, fullInit);
    }

    /**
     * Shortcut method to emit a PATCH HTTP request.
     * @param url URL for the fetch function call.
     * @param body The data to send as body.
     * 
     * If a POJO is passed, it will be stringified and the `Content-Type` header of the request will be set to 
     * `'application/json'`.  This is also true with arrays.
     * 
     * > **NOTE**:  You must make sure that the POJO or the array (and its elements) you pass as body are serializable.
     * 
     * Any other body type will not generate a `Content-Type` header and will be reliant on what the `fetch()` function 
     * does in those cases.
     * @returns A response object with the HTTP response's `ok`, `status`, `statusText` and `body` properties.
     */
    patch(url: URL | string, body?: BodyInit | null | Record<string, any>, init?: Omit<FetchFnInit, 'method' | 'body'>) {
        const fullInit = this.#createInit(body, init);
        fullInit.method = 'PATCH';
        return this.fetch(url, fullInit);
    }

    /**
     * Shortcut method to emit a DELETE HTTP request.
     * @param url URL for the fetch function call.
     * @param body The data to send as body.
     * 
     * If a POJO is passed, it will be stringified and the `Content-Type` header of the request will be set to 
     * `'application/json'`.  This is also true with arrays.
     * 
     * > **NOTE**:  You must make sure that the POJO or the array (and its elements) you pass as body are serializable.
     * 
     * Any other body type will not generate a `Content-Type` header and will be reliant on what the `fetch()` function 
     * does in those cases.
     * @returns A response object with the HTTP response's `ok`, `status`, `statusText` and `body` properties.
     */
    delete(url: URL | string, body?: BodyInit | null | Record<string, any>, init?: Omit<FetchFnInit, 'method' | 'body'>) {
        const fullInit = this.#createInit(body, init);
        fullInit.method = 'DELETE';
        return this.fetch(url, fullInit);
    }

    /**
     * Shortcut method to emit a PUT HTTP request.
     * @param url URL for the fetch function call.
     * @param body The data to send as body.
     * 
     * If a POJO is passed, it will be stringified and the `Content-Type` header of the request will be set to 
     * `'application/json'`.  This is also true with arrays.
     * 
     * > **NOTE**:  You must make sure that the POJO or the array (and its elements) you pass as body are serializable.
     * 
     * Any other body type will not generate a `Content-Type` header and will be reliant on what the `fetch()` function 
     * does in those cases.
     * @returns A response object with the HTTP response's `ok`, `status`, `statusText` and `body` properties.
     */
    put(url: URL | string, body?: BodyInit | null | Record<string, any>, init?: Omit<FetchFnInit, 'method' | 'body'>) {
        const fullInit = this.#createInit(body, init);
        fullInit.method = 'PUT';
        return this.fetch(url, fullInit);
    }
}
