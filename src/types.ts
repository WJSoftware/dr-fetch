/**
 * List of all possible OK status codes (2xx).
 */
export type OkStatusCode = 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226;

/**
 * List of all possible client-sided error status codes (4xx).
 */
export type ClientErrorStatusCode = 400 | 401 | 403 | 404 | 405 | 406 | 407 | 408 | 409 | 410 | 411 | 412 | 413 | 414 |
    415 | 416 | 417 | 418 | 421 | 422 | 423 | 424 | 425 | 426 | 428 | 429 | 431 | 451;

/**
 * List of all possible server-sided error status codes (5xx).
 */
export type ServerErrorStatusCode = 500 | 501 | 502 | 503 | 504 | 505 | 506 | 507 | 508 | 510 | 511;

/**
 * List of all possible status codes (2xx + 4xx + 5xx).
 */
export type StatusCode = OkStatusCode | ClientErrorStatusCode | ServerErrorStatusCode;

/**
 * List of all possible non-OK status codes (4xx + 5xx).
 */
export type NonOkStatusCode = Exclude<StatusCode, OkStatusCode>;

/**
 * Type that represents a fetch response's body parser function.
 */
export type BodyParserFn<T> = (response: Response) => Promise<T>;

/**
 * Type that builds a single status code's response.
 */
type CoreFetchResult<TStatus extends number, TBody> = {
    aborted: false;
    ok: TStatus extends OkStatusCode ? true : false;
    status: TStatus;
    statusText: string;
} & (TBody extends undefined ? {} : {
    body: TBody
});

/**
 * Type that builds DrFetch's final result object's type.
 */
export type FetchResult<T, TStatus extends number, TBody = undefined> =
    (
        unknown extends T ?
        CoreFetchResult<TStatus, TBody> :
        T | CoreFetchResult<TStatus, TBody>
    ) extends infer R ? R : never;

/**
 * Type of the stock fetch function.
 */
export type FetchFn = typeof fetch;

/**
 * Type of the fetch function's URL parameter.
 */
export type FetchFnUrl = Parameters<FetchFn>[0];

/**
 * Possible types of keys accepted by the `autoAbort` option.
 */
export type AutoAbortKey = string | symbol | number;

/**
 * Type of the fetch function's init parameter.
 */
export type FetchFnInit = Parameters<FetchFn>[1] & {
    /**
     * Specifies the options for auto-aborting the HTTP request.
     * 
     * If a string is provided, it will be used as the key for the abort signal; provide an object to specify further 
     * options.
     */
    autoAbort?: AutoAbortKey | {
        /**
         * The key used to identify the abort signal.
         */
        key: AutoAbortKey;
        /**
         * The amount of time (in milliseconds) to wait before emitting the request. If not specified, then no delay 
         * is applied.
         */
        delay?: number;
    };
};

/**
 * Fetcher cloning options.
 */
export type CloneOptions<BodyTyping extends boolean | undefined, Abortable extends boolean | undefined> = {
    /**
     * Determines whether to preserve the body typing of the original fetcher.  The default is `true`.
     */
    preserveTyping?: BodyTyping;
    /**
     * Defines which data-fetching function the clone will use.
     * 
     * Pass `false` if you want the clone to use the standard `fetch()` function, or leave it `undefined` to inherit 
     * the fetch function of the parent.
     */
    fetchFn?: FetchFn | false;
    /**
     * Determines if body processors are included in the clone.  The default is `true`.
     */
    includeProcessors?: boolean;
    /**
     * Defines whether to preserve the abortable state of the original fetcher.  The default is `true`.
     */
    preserveAbortable?: Abortable;
};

/**
 * Defines the possible data types that can be used to install custom body processors.
 */
export type ProcessorPattern = string | RegExp | (string | RegExp)[] | ((response: Response, contentType: string) => boolean);
