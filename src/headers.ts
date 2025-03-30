import type { FetchFnInit } from "./types.js";

/**
 * Defines all the possible data constructs that can be used to set HTTP headers in an 'init' configuration object.
 */
export type HeaderInput =
    Map<string, string | ReadonlyArray<string>> |
    [string, string][] |
    Record<string, string | ReadonlyArray<string>> |
    Headers;

function* headerTuplesGenerator(headers: [string, string][]) {
    yield* headers;
}

function headerMapGenerator(headers: Map<string, string | ReadonlyArray<string>>) {
    return headers.entries();
}

function* headersPojoGenerator(headers: Record<string, string | ReadonlyArray<string>>) {
    yield* Object.entries(headers);
}

function headersClassGenerator(headers: Headers) {
    return headers.entries();
}

/**
 * Creates an iterator object that can be used to examine the contents of the provided headers source.
 * 
 * Useful for troubleshooting or unit testing, and used internally by `setHeaders` because it reduces the many possible 
 * ways to specify headers into to one:  Tuples.  Because it is an iterator, it can:
 * 
 * + Be used in `for..of` statements
 * + Be spread using the spread (`...`) operator in arrays and parameters
 * + Be used in other generators via `yield*`
 * + Be destructured (array destructuring)
 * @param headers The source of the headers to enumerate.
 * @returns An iterator object that will enumerate every header contained in the source in the form of a tuple 
 * `[header, value]`.
 * @example
 * ```typescript
 * const myHeaders1 = new Headers();
 * myHeaders1.set('Accept', 'application/json');
 * myHeaders1.set('Authorization', 'Bearer x');
 * 
 * const myHeaders2 = new Map();
 * myHeaders2.set('Accept', 'application/json');
 * myHeaders2.set('Authorization', 'Bearer x');
 * 
 * const myHeaders3 = {
 *     'Accept': 'application/json',
 *     'Authorization': 'Bearer x'
 * };
 * 
 * // The output of these is identical.
 * console.log([...makeIterableHeaders(myHeaders1)]);
 * console.log([...makeIterableHeaders(myHeaders2)]);
 * console.log([...makeIterableHeaders(myHeaders3)]);
 * ```
 */
export function makeIterableHeaders(headers: HeaderInput) {
    const iterator = Array.isArray(headers) ?
        headerTuplesGenerator(headers) :
        headers instanceof Map ?
            headerMapGenerator(headers) :
            headers instanceof Headers ?
                headersClassGenerator(headers) :
                headersPojoGenerator(headers)
        ;
    return {
        [Symbol.iterator]() {
            return {
                next() {
                    return iterator.next()
                }
            };
        }
    };
}

function setTupleHeaders(headers: [string, string][], newHeaders: HeaderInput) {
    for (let [key, value] of makeIterableHeaders(newHeaders)) {
        headers.push([key, Array.isArray(value) ? value.join(', ') : value as string]);
    }
}

function setHeadersInHeadersInstance(headers: Headers, newHeaders: HeaderInput) {
    for (let [key, value] of makeIterableHeaders(newHeaders)) {
        if (Array.isArray(value)) {
            for (let v of value) {
                headers.append(key, v);
            }
        }
        else {
            headers.set(key, value as string);
        }
    }
}

function setPojoHeaders(headers: Record<string, string>, newHeaders: HeaderInput) {
    for (let [key, value] of makeIterableHeaders(newHeaders)) {
        headers[key] = Array.isArray(value) ? value.join(', ') : value as string;
    }
}

/**
 * Sets the provided HTTP headers into the `init.headers` property of the given `init` object.
 * 
 * The function sets headers, and doesn't append values to existing headers.  The only exception is when the new 
 * headers are specified with a POJO or Map object, where the value can be an array of strings.  In these cases, the 
 * array of values are combined and this combination becomes the value of the header.
 * @param init The `init` object that will receive the specified headers.
 * @param headers The collection of headers to include in the `init` object.
 */
export function setHeaders(init: Exclude<FetchFnInit, undefined>, headers: HeaderInput) {
    if (!init) {
        throw new Error("The 'init' argument cannot be undefined.");
    }
    init.headers ??= new Headers();
    if (Array.isArray(init.headers)) {
        setTupleHeaders(init.headers, headers);
    }
    else if (init.headers instanceof Headers) {
        setHeadersInHeadersInstance(init.headers, headers);
    }
    else {
        setPojoHeaders(init.headers, headers);
    }
}

/**
 * Tests the given collection of headers to see if the specified header is present.
 * @param headers The headers to check.
 * @param header The sought header.  The search is case-insensitive.
 * @returns `true` if the header is present in the headers, or `false` otherwise.
 */
export function hasHeader(headers: HeaderInput, header: string) {
    const lcHeader = header.toLowerCase();
    for (let [key] of makeIterableHeaders(headers)) {
        if (key.toLowerCase() === lcHeader) {
            return true;
        }
    }
    return false;
}

/**
 * Gets the value of the specified header from the given collection of headers.
 * @param headers The headers to check.
 * @param header The sought header.  The search is case-insensitive.
 * @returns The value of the header, or `undefined` if the header is not present in the headers.
 */
export function getHeader(headers: HeaderInput, header: string) {
    const lcHeader = header.toLowerCase();
    for (let [key, value] of makeIterableHeaders(headers)) {
        if (key.toLowerCase() === lcHeader) {
            return value;
        }
    }
    return undefined;
}
