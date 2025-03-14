import type { FetchResult, StatusCode } from "./types.js";

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
 * parsers.
 * 
 * A new fetcher object may be created by creating it from scratch using the class constructor, or by cloning an 
 * existing one using the parent's `clone` function.  When cloning, pass a new data-fetching function (if required) so 
 * the clone uses this one instead of the one of the parent fetcher.
 */
export class DrFetch<T = unknown> {
    #fetchFn: typeof fetch;
    #customParsers: [string | RegExp, (response: Response) => Promise<any>][] = [];

    /**
     * Initializes a new instance of this class.
     * 
     * If you would like to set interception before or after fetching, simply write a custom function that has the same 
     * signature as the stock `fetch` function that does what is required before or after fetching, and pass it as the 
     * first argument when creating the new instance.
     * 
     * @example
     * ```typescript
     * async function myCustomFetch(url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
     *     // Code before fetching is the equivalent of pre-fetch interception.
     *     const myToken = getMyToken();
     *     // WARNING: Naive implementation:  It assumes that headers are always given as a POJO object, but fetch() 
     *     // accepts other forms.  BEWARE.
     *     init = init ?? { headers: {} };
     *     init.headers['Authorization'] = `Bearer ${myToken}`;
     *     const response = await fetch(url, init);
     *     // Code after obtaining the response is the equivalent of post-fetch interception.
     *     ...
     *     return response;
     * }
     * 
     * // Create the class now.
     * const fetcher = new DrFetch(myCustomFetch);
     * ```
     * 
     * If you need to do special parsing of the body, don't do post-interception and instead use the `withParser` 
     * function to register a custom body parser.
     * @param fetchFn Optional data-fetching function to use instead of the stock `fetch` function.
     */
    constructor(fetchFn?: typeof fetch) {
        this.#fetchFn = fetchFn ?? fetch.bind(globalThis.window || global);
    }

    /**
     * Clones this fetcher object by creating a new fetcher object with the same data-fetching function, custom 
     * parsers, and data typing unless specified otherwise via the options parameter.
     * @param inheritTyping Determines if the clone inherits the parent's typings.
     * @param options Optional options to control which features are cloned.
     * @returns A new fetcher object that complies with the supplied (or if not supplied, the default) options.
     */
    clone<TInherit extends boolean>(inheritTyping: TInherit, options?: {
        /**
         * Data-fetching function for the clone.  Pass `false` if you want the clone to use the standard `fetch()` 
         * function.
         */
        fetchFn?: typeof fetch | false;
        /**
         * Determines if parsers are included in the clone.  The default is `true`.
         */
        includeParsers?: boolean;
    }): TInherit extends true ? DrFetch<T> : DrFetch {
        const newClone = new DrFetch(options?.fetchFn === false ? undefined : options?.fetchFn ?? this.#fetchFn);
        if (options?.includeParsers ?? true) {
            newClone.#customParsers = [...this.#customParsers];
        }
        return newClone as DrFetch<T>;
    }

    /**
     * Adds a custom parser to the fetcher object.
     * 
     * The custom parser will be used if the value of the `"content-type"` header satisfies the given pattern.  The 
     * pattern can be a string or regular expression, and when a string is used, the parser will qualify if the pattern 
     * is found inside the HTTP header's value.
     * @param pattern String or regular expression used to test the value of the `"content-type"` HTTP response header.
     * @param parserFn Custom parser function that is give the HTTP response object and is responsible to return the 
     * body.
     * @returns The current fetcher object to enable fluent syntax.
     */
    withParser(pattern: string | RegExp, parserFn: (response: Response) => Promise<any>) {
        this.#customParsers.push([pattern, parserFn]);
        return this;
    }

    /**
     * Alters this fetcher's response type by associating the given body type to the given status code type, which can 
     * be a single status code, or multiple status codes.
     * @returns This parser object with its response type modified to include the body specification provided.
     */
    for<TStatus extends StatusCode, TBody = {}>(): DrFetch<FetchResult<T, TStatus, TBody>> {
        return this as DrFetch<FetchResult<T, TStatus, TBody>>;
    }

    // notFor<TStatus extends StatusCode>(status: TStatus)

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
        // Custom parsers have the highest priority.
        if (this.#customParsers.length) {
            for (let [pattern, parserFn] of this.#customParsers) {
                if (this.#contentMatchesType(contentType, pattern)) {
                    return await parserFn(response);
                }
            }
        }
        if (this.#contentMatchesType(contentType, jsonTypes)) {
            return await response.json();
        }
        else if (this.#contentMatchesType(contentType, textTypes)) {
            return await response.text();
        }
        throw new Error(`Could not determine how to parse body of type "${contentType}".  Provide a custom parser by calling 'withParser()'.`);
    }

    /**
     * Fetches the specified URL using the specified options and returns information contained within the HTTP response 
     * object.
     * @param url URL paramter for the data-fetching function.
     * @param init Options for the data-fetching function.
     * @returns A response object with the HTTP response's `ok`, `status`, `statusText` and `body` properties.
     */
    async fetch(url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
        const response = await this.#fetchFn(url, init);
        const body = await this.#readBody(response);
        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            body
        } as T;
    }

    #processBody(body: BodyInit | null | Record<string, any> | undefined) {
        let headers: Record<string, string> = {};
        if (isPojo(body) || Array.isArray(body)) {
            body = JSON.stringify(body);
            headers['content-type'] = 'application/json';
        }
        return [body as BodyInit | null, headers] as const;
    }

    /**
     * Shortcut method to emit a GET HTTP request.
     * @param url URL for the fetch function call.
     * @returns A response object with the HTTP response's `ok`, `status`, `statusText` and `body` properties.
     */
    get(url: URL | string) {
        return this.fetch(url, { method: 'GET' });
    }

    /**
     * Shortcut method to emit a HEAD HTTP request.
     * @param url URL for the fetch function call.
     * @returns A response object with the HTTP response's `ok`, `status`, `statusText` and `body` properties.
     */
    head(url: URL | string) {
        return this.fetch(url, { method: 'HEAD' });
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
    post(url: URL | string, body?: BodyInit | null | Record<string, any>) {
        const [pBody, headers] = this.#processBody(body);
        return this.fetch(url, { method: 'POST', body: pBody, headers });
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
    patch(url: URL | string, body?: BodyInit | null | Record<string, any>) {
        const [pBody, headers] = this.#processBody(body);
        return this.fetch(url, { method: 'PATCH', body: pBody, headers });
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
    delete(url: URL | string, body?: BodyInit | null | Record<string, any>) {
        const [pBody, headers] = this.#processBody(body);
        return this.fetch(url, { method: 'DELETE', body: pBody, headers });
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
    put(url: URL | string, body?: BodyInit | null | Record<string, any>) {
        const [pBody, headers] = this.#processBody(body);
        return this.fetch(url, { method: 'PUT', body: pBody, headers });
    }
}
