# dr-fetch

This is not just one more wrapper for `fetch()`:  This package promotes the idea of using customized data-fetching 
functions, which is the most maintainable option, and adds features no other wrapper provides to date.

This package:

+ Uses the modern, standardized `fetch` function.
+ Does **not** throw on non-OK HTTP responses.
+ **Can fully type all possible HTTP responses depending on the HTTP status code, even non-standard ones like 499.**
+ **Supports abortable HTTP requests; no boilerplate.**
+ **Can auto-abort HTTP requests in favor of newer request versions, with optional delaying (debouncing).**
+ Works in any runtime that implements `fetch()` (browsers, NodeJS, etc.).
+ Is probably the tiniest fetch wrapper you'll ever need:  **342 LOC** including typing (`npx cloc .\src --exclude-dir=tests`).

## Does a Non-OK Status Code Warrant an Error?

The short story is:

1. Wrappers like `axios` or `ky` do `if (!response.ok) throw ...`, which forces code to `try..catch`.  This is a code 
smell:  `try..catch` is being used as a branching mechanism.
2. The performance drop is huge.  [See this benchmark](https://jsperf.app/dogeco).  Over 40% loss.

[The issue of fetch wrappers explained in more detail](https://webjose.hashnode.dev/the-ugly-truth-all-popular-fetch-wrappers-do-it-wrong)

## Quickstart

1. Install the package.
2. Create your custom fetch function, usually including logic to inject an authorization header/token.
3. Create a fetcher object.
4. Optionally add body processors.
5. Use the fetcher for every HTTP request needed.

### Installation

```bash
npm i dr-fetch
```

### Create a Custom Fetch Function

This is optional and only needed if you need to do something before or after fetching.  By far the most common task to 
do is to add the `authorization` header and the `accept` header to every call.

```typescript
// myFetch.ts
import { obtainToken } from "./magical-auth-stuff.js";
import { setHeaders, type FetchFnUrl, type FetchFnInit } from "dr-fetch";

export function myFetch(url: FetchFnUrl, init?: FetchFnInit) {
    const token = obtainToken();
    // Make sure there's an object where headers can be added:
    init ??= {};
    setHeaders(init, { Accept: 'application/json', Authorization: `Bearer ${token}`});
    return fetch(url, init);
}
```

Think of this custom function as the place where you do interceptions (if you are familiar with this term from `axios`).

### Create Fetcher Object

```typescript
// fetcher.ts
import { DrFetch } from "dr-fetch";
import { myFetch } from "./myFetch.js";

export default new DrFetch(myFetch);
// If you don't need a custom fetch function, just do:
export default new DrFetch();
```

### Adding a Custom Body Processor

This step is also optional.

One can say that the `DrFetch` class comes with 2 basic body processors:

1. JSON processor when the value of the `content-type` response header is `application/json` or similar 
(`application/problem+json`, for instance).
2. Text processor when the value of the `content-type` response header is `text/<something>`, such as `text/plain` or 
`text/csv`.

If your API sends a content type not covered by any of the above two cases, use `DrFetch.withProcessor()` to add a 
custom processor for the content type you are expecting.  The class allows for fluent syntax, so you can chain calls:

```typescript
// fetcher.ts
...

export default new DrFetch(myFetch)
    .withProcessor('desired/contentType', async (response, stockParsers) => {
        // Do what you must with the provided response object.  Whatever you return is carried in the `body`
        // property of the final DrFetch.fetch()'s response object.
        return finalBody;
    });
    ;
```

> [!NOTE]
> The matching pattern can be a string, a regular expression, or an array of either.  If this is not sufficient, pass 
> a predicate function with signature `(response: Response, contentType: string) => boolean`.

Now the fetcher object is ready for use.

### Using the Fetcher Object

This is the fun part where we can enumerate the various shapes of the body depending on the HTTP status code:

```typescript
import type { MyData } from "./my-types.js";
import fetcher from "./fetcher.js";

const response = await fetcher
    .for<200, MyData[]>()
    .for<401, { loginUrl: string; }>()
    .fetch('/api/mydata/?active=true')
    ;
```

The object stored in the `response` variable will contain the following properties:

+ `aborted`:  Will be `false` (since **v0.8.0**)
+ `ok`:  Same as `Response.ok`.
+ `status`:  Same as `Response.status`.
+ `statusText`:  Same as `Response.statusText`.
+ `body`:  The HTTP response body, already parsed and typed according to the specification:  `MyData[]` if the status 
code was `200`, or `{ loginUrl: string; }` if the status code was `401`.

Your editor's Intellisense should be able to properly and accurately tell you all this:

```typescript
if (response.status === 200) { // In this example, doing response.ok in the IF narrows the type just as well.
    // Say, display the data somehow/somewhere.  In Svelte, we would set a store, perhaps?
    myDataStore.set(response.body);
}
else {
    // TypeScript/Intellisense will tell you that the only other option is for the status code to be 401:
    window.location.href = response.body.loginUrl;
}
```

## Typing For Non-Standard Status Codes

> Since **v0.8.0**

This library currently supports, out of the box, the OK status codes, client error status codes and server error status 
codes that the MDN website lists, and are therefore considered standardized.

If you need to type a response based on any other status code not currently supported, just do something like this:

```typescript
import { DrFetch, type StatusCode } from "dr-fetch";

type MyStatusCode = StatusCode | 499;
export default new DrFetch<MyStatusCode>();
```

You will now be able to use non-standardized status code `499` to type the response body with `DrFetch.for<>()`.

## Abortable HTTP Requests

> Since **v0.8.0**

To create abortable HTTP requests, as per the standard, use an `AbortController`.  The following is how you would have 
to write your code *without* `dr-fetch`:

```typescript
const ac = new AbortController();
let aborted = false;
let response: Response;

try {
    response = await fetch('/url', { signal: ac.signal });
}
catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
        aborted = true;
    }
    // Other stuff for non-aborted scenarios.
}
if (!aborted) {
    const body = await response.json();
    ...
}
```

In contrast, using an abortable fetcher from `dr-fetch`, you reduce your code to:

```typescript
// abortable-fetcher.ts
import { DrFetch } from "dr-fetch";

export const abortableFetcher = new DrFetch()
    .abortable();
```

```typescript
// some-component.ts
import { abortableFetcher } from "./abortable-fetcher.js";

const ac = new AbortController();

const response = await abortableFetcher
    .for<200, MyData[]>(),
    .for<400, ValidationError[]>()
    .get('/url', { signal: ac.signal });
if (!response.aborted) {
    ...
}
```

In short:  All boilerplate is gone.  Your only job is to create the abort controller, pass the signal and after 
awaiting for the response, you check the value of the `aborted` property.

TypeScript and Intellisense will be fully accurate:  If `response.aborted` is true, then the `response.error` property 
is available; otherwise the usual `ok`, `status`, `statusText` and `body` properties will be the ones available.

For full details and feedback on this feature, see [this discussion](https://github.com/WJSoftware/dr-fetch/discussions/25).

> [!IMPORTANT]
> Calling `DrFetch.abortable()` permanently changes the fetcher object's configuration.

## Smarter Uses

It is smart to create just one fetcher, configure it, then use it for every fetch call.  Because generally speaking, 
different URL's will carry a different body type, the fetcher object should be kept free of `for<>()` calls.  But what 
if your API is standardized so all status `400` bodies look the same?  Then configure that type:

```typescript
// root-fetcher.ts
import { DrFetch } from "dr-fetch";
import { myFetch } from "./my-fetch.js";
import type { BadRequestBody } from "my-types.js";

export default new DrFetch(myFetch)
    .withProcessor(...) // Optional processors
    .withProcessor(...)
    .for<400, BadRequestBody>()
    ;
```

You can now consume this root fetcher object and it will be pre-typed for the `400` status code.

### About Abortable Fetchers

> Since **v0.8.0**

If your project has a need for abortable and non-abortable fetcher objects, the smarter option would be to create and 
export 2 fetcher objects, instead of one root fetcher:

```typescript
// root-fetchers.ts
import { DrFetch } from "dr-fetch";
import { myFetch } from "./my-fetch.js";
import type { BadRequestBody } from "my-types.js";

export const rootFetcher new DrFetch(myFetch)
    .withProcessor(...) // Optional processors
    .withProcessor(...)
    .for<400, BadRequestBody>()
    ;

export const abortableRootFetcher = rootFetcher.clone().abortable();
```

We clone it because `abortable()` has permanent side effects on the object's state.  Cloning can also help with other 
scenarios, as explained next.

### Specializing the Root Fetcher

What if we needed a custom processor for just one particular URL?  It makes no sense to add it to the root fetcher, and 
maybe it is even harmful to do so.  In cases like this one, clone the fetcher.

Cloning a fetcher produces a new fetcher with the same data-fetching function, the same body processors, the same 
support for abortable HTTP requests and the same body typings, **unless** we specify we want something different, like 
not cloning the body types, or specifying a new data-fetching function.

```typescript
import rootFetcher from "./root-fetcher.js";
import type { FetchFnUrl, FetchFnInit } from "dr-fetch";

function specialFetch(url: FetchFnUrl, init?: FetchFnInit) {
    ...
}

// Same data-fetching function, body processors, abortable support and body typing.
const specialFetcher = rootFetcher.clone();
// Same data-fetching function, abortable support and body processors; no body typing.
const specialFetcher = rootFetcher.clone({ preserveTyping: false });
// Same everything; different data-fetching function.
const specialFetcher = rootFetcher.clone({ fetchFn: specialFetch });
// Same everything; no custom body processors.
const specialFetcher = rootFetcher.clone({ includeProcessors: false });
// Identical processors, abortable support and body typing; stock fetch().
const specialFetcher = rootFetcher.clone({ fetchFn: false });
// Identical processors, body typing and fetch function; no abortable support (the default when constructing).
const specialFetcher = rootFetcher.clone({ preserveAbortable: false });
```

> [!IMPORTANT]
> `preserveTyping` is a TypeScript trick and cannot be a variable of type `boolean`.  Its value doesn't matter in 
> runtime because types are not a runtime thing, and TypeScript depends on knowing if the value is `true` or `false`.
> 
> On the other hand, `preserveAbortable` (since **v0.9.0**) is a hybrid:  It uses the same TypeScript trick, but its 
> value does matter in runtime because an abortable fetcher object has different inner state than a stock fetcher 
> object.  In this sense, supporting a variable would be ideal, but there's just no way to properly reconcile the 
> TypeScript side with a variable of type `boolean`.  Therefore, try to always use constant values.

## Auto-Abortable HTTP Requests

> Since **v0.9.0**

An HTTP request can automatically abort whenever a new version of the HTTP request is executed.  This is useful in 
cases like server-sided autocomplete components, where an HTTP request is made every time a user stops typing in the 
search textbox.  As soon as a new HTTP request is made, the previous has no value.  With `dr-fetch`, this chore is 
fully automated.

To illustrate, this is how it would be done "by hand", as if auto-abortable wasn't a feature:

```typescript
import { abortableRootFetcher } from './root-fetchers.js';
import type { SimpleItem } from './my-types.js';

let ac: AbortController;

async function fetchAutocompleteList(searchTerm: string) {
    ac?.abort();
    ac = new AbortController();
    const response = await abortableRootFetcher
        .for<200, SimpleItem[]>()
        .get(`/my/data?s=${searchTerm}`, { signal: ac.signal });
    if (!response.aborted) {
        ...
    }
}
```

While this is not too bad, it can actually be like this:

```typescript
import { abortableRootFetcher } from './root-fetchers.js';
import type { SimpleItem } from './my-types.js';

async function fetchAutocompleteList(searchTerm: string) {
    const response = await abortableRootFetcher
        .for<200, SimpleItem[]>()
        .get(`/my/data?s=${searchTerm}`, { autoAbort: 'my-key' });
    if (!response.aborted) {
        ...
    }
}
```

> [!NOTE]
> The key can be a string, a number or a unique symbol.  Keys are not shared between fetcher instances, and cloning 
> does not clone any existing keys.

`DrFetch` instances create and keep track of abort controllers by key.  All one must do is provide a key when starting 
the HTTP request.  Furthermore, the abort controllers are disposed as soon as the HTTP request resolves or rejects.

### Delaying an Auto-Abortable HTTP Request

Aborting the HTTP request (the call to `fetch()`) is usually not the only thing that front-end developers do in cases 
like the autocomplete component.  Developers usually also debounce the action of executing the HTTP request for a short 
period of time (around 500 milliseconds).

You can do this very easily as well with `dr-fetch`.  There is no need to program the debouncing externally.

This is the previous example, with a delay specified:

```typescript
import { abortableRootFetcher } from './root-fetchers.js';
import type { SimpleItem } from './my-types.js';

async function fetchAutocompleteList(searchTerm: string) {
    const response = await abortableRootFetcher
        .for<200, SimpleItem[]>()
        .get(`/my/data?s=${searchTerm}`, { autoAbort: { key: 'my-key', delay: 500 }});
    if (!response.aborted) {
        ...
    }
}
```

By using the object form of `autoAbort`, one can specify the desired delay, in milliseconds.

## Shortcut Functions

> Since **v0.3.0**

`DrFetch` objects now provide the shortcut functions `get`, `head`, `post`, `patch`, `put` and `delete`.  Except for 
`get` and `head`, all these accept a body parameter.  When this body is a POJO or an array, the body is stringified 
and, if no explicit `Content-Type` header is set, the `Content-Type` header is given the value `application/json`.  If 
a body of any other type is given (that the `fetch()` function accepts, such as `FormData`), no headers are explicitly 
added and therefore it is up to what `fetch()` (or the custom data-fetching function you provide) does in these cases.

```typescript
import type { Todo } from "./myTypes.js";

const newTodo = { text: 'I am new.  Insert me!' };
const response = await fetcher
    .for<200, { success: true; entity: Todo; }>()
    .for<400, { errors: string[]; }>()
    .post('/api/todos', newTodo);

const newTodos = [{ text: 'I am new.  Insert me!' }, { text: 'Me too!' }];
const response = await fetcher
    .for<200, { success: true; entities: Todo[]; }>()
    .for<400, { errors: string[]; }>()
    .post('/api/todos', newTodos);
```

As stated, your custom fetch can be used to further customize the request because these shortcut functions will, in the 
end, call it.

### Parameters

> Since **v0.8.0**

The `get` and `head` shortcut functions' parameters are:

`(url: URL | string, init?: RequestInit)`

The other shortcut functions' parameters are:

`(url: URL | string, body?: BodyInit | null | Record<string, any>, init?: RequestInit)`

Just note that `init` won't accept the `method` or `body` properties (the above is a simplification).

## setHeaders and makeIterableHeaders

> Since **v0.4.0**

These are two helper functions that assist you in writing custom data-fetching functions.

If you haven't realized, the `init` parameter in `fetch()` can have the headers specified in 3 different formats:

+ As a `Headers` object (an instance of the `Headers` class)
+ As a POJO object, where the property key is the header name, and the property value is the header value
+ As an array of tuples of type `[string, string]`, where the first element is the header name, and the second one is 
its value

To further complicate this, the POJO object also accepts an array of strings as property values for headers that accept 
multiple values.

So writing a formal custom fetch **without** `setHeaders()` looks like this:

```typescript
import type { FetchFnUrl, FetchFnInit } from "dr-fetch";

export function myFetch(URL: FetchFnUrl, init?: FetchFnInit) {
    const acceptHdrKey = 'Accept';
    const acceptHdrValue = 'application/json';
    init ??= {};
    init.headers ??= new Headers();
    if (Array.isArray(init.headers)) {
        // Tuples, so push a tuple per desired header:
        init.headers.push([acceptHdrKey, acceptHdrValue]);
    }
    else if (init.headers instanceof Headers) {
        init.headers.set(acceptHdrKey, acceptHdrValue);
    }
    else {
        // POJO object, so add headers as properties of an object:
        init.headers[acceptHdrKey] = acceptHdrValue;
    }
    return fetch(url, init);
}
```

This would also get more complex if you account for multi-value headers.  The bottom line is:  This is complex.

Now the same thing, using `setHeaders()`:

```typescript
import type { FetchFnUrl, FetchFnInit } from "dr-fetch";

export function myFetch(URL: FetchFnUrl, init?: FetchFnInit) {
    init ??= {};
    setHeaders(init, [['Accept', 'application/json']]);
    // OR:
    setHeaders(init, new Map([['Accept', ['application/json', 'application/xml']]]));
    // OR:
    setHeaders(init, { 'Accept': ['application/json', 'application/xml'] });
    // OR:
    setHeaders(init, new Headers([['Accept', 'application/json']]));
    return fetch(url, init);
}
```
> [!NOTE]
> With `setHeaders()`, you can add headers to 'init' with a map, an array of tuples, a `Headers` instance or a POJO 
> object.

The difference is indeed pretty shocking:  One line of code and you are done.  Also note that adding arrays of values 
doesn't increase the complexity of the code:  It's still one line.

### makeIterableHeaders

This function is the magic trick that powers the `setHeaders` function, and is very handy for troubleshooting or unit 
testing because it can take a collection of HTTP header specifications in the form of a map, a `Headers` object, a POJO 
object or an array of tuples and return an iterator object that iterates through the definitions in the same way:  A 
list of tuples.

```typescript
const myHeaders1 = new Headers();
myHeaders1.set('Accept', 'application/json');
myHeaders1.set('Authorization', 'Bearer x');

const myHeaders2 = new Map();
myHeaders2.set('Accept', 'application/json');
myHeaders2.set('Authorization', 'Bearer x');

const myHeaders3 = {
    'Accept': 'application/json',
    'Authorization': 'Bearer x'
};

const myHeaders4 = [
    ['Accept', 'application/json'],
    ['Authorization', 'Bearer x'],
];

// The output of all these is identical.
console.log([...makeIterableHeaders(myHeaders1)]);
console.log([...makeIterableHeaders(myHeaders2)]);
console.log([...makeIterableHeaders(myHeaders3)]);
console.log([...makeIterableHeaders(myHeaders4)]);
```

This function is a **generator function**, so what returns is an iterator object.  The two most helpful ways of using 
it are in `for..of` statements and spreading:

```typescript
for (let [key, value] of makeIterableHeaders(myHeaders)) { ... }

// In unit-testing, perhaps:
expect([...makeIterableHeaders(myHeaders)].length).to.equal(2);
```

## hasHeader and getHeader

These are two helper functions that do exactly what the names imply:  `hasHeader` checks for the existence of a 
particular HTTP header; `getHeader` obtains the value of a particular HTTP header.

These functions perform a sequential search with the help of `makeIterableHeaders`.

> [!NOTE]
> Try not to use `getHeader` to determine the existence of a header **without** having the following in mind:  The 
> function returns `undefined` if the value is not found, but it could return `undefined` if the header is found *and* 
> its value is `undefined`.

## Usage Without TypeScript (JavaScript Projects)

Why are you a weird fellow/gal?  Anyway, prejudice aside, body typing will mean nothing to you, so forget about `for()` 
and anything else regarding types.  Do your custom data-fetching function, add your custom body processors and fetch 
away using `.fetch()`, `.get()`, `head()`, `.post()`, `.put()`, `.patch()` or `.delete()`.

## Plug-ins?  Fancy Stuff?

Indeed, we can have fancy stuff.  As demonstration, this section will show you how one can add download progress with 
a simple class, the `fetch-api-progress` NPM package and a custom body processor.

[Live demo in the Svelte REPL](https://svelte.dev/playground/ddeedfb44ab74727ac40df320c552b92)

> [!NOTE]
> If you wanted to, `fetch-api-progress` also supports upload progress.  As of **v0.9.0** of this library, however, is 
> not too simple to integrate.  Soon, the ability to pass custom options to the core `fetch()` function will be a 
> feature and will solve this integration scenario quite elegantly.  Stay tuned.

```ts
import { trackResponseProgress } from "fetch-api-progress";

export class DownloadProgress {
    progress = $state(0);
    response;

    constructor(response: Response) {
        this.response = response;
        trackResponseProgress(response, (p) => {
            this.progress = p.lengthComputable ? p.loaded / p.total : 0;
        });
    }
}
```

The above class is a simple Svelte v5 class that exposes a reactive `progress` property.  Feel free to create 
equivalent classes/wrappers for your favorite frameworks.

The `response` property can be used to access the original response object, to, for instance, get the actual data.

### How To Use

Create a custom processor for the content type that will be received, for example, `video/mp4` for MP4 video files.

```ts
// downloader.ts
import { DownloadProgress } from "./DownloadProgress.svelte.js";

export default new DrFetch(/* custom fetch function here, if needed */)
    .withProcessor('video/mp4', (r) => Promise.resolve(new DownloadProgress(r)))
    ;
```

The Svelte component would use this fetcher object.  The response from `fetcher.fetch()` (or `fetcher.get()`) will 
carry the class instance in the `body` property.

```svelte
<script lang="ts">
    import { DownloadProgress } from "./DownloadProgress.svelte.js";
    import downloader from "./downloader.js";

    let download = $state<DownloadProgress>();

    async function startDownload() {
        download = (await downloader
            .for<200, DownloadProgress>()
            .get('https://example.com/my-video.mp4')
        )
        .body;
    }
</script>

<button type="button" onclick={startDownload}>
    Start Download
</button>
<progress value={download?.progress ?? 0}></progress>
```

When the button is clicked, the download is started.  The custom processor simply creates the new instance of the 
`DownloadProgress` class.  Svelte's reactivity system takes care of the rest, effectively bringing the progress element 
to life as the download progresses.

### I want fancier!

Ok, more features are incoming, but if you feel you definitely need more, remember that `DrFetch` is a class.  You can 
always extend it as per JavaScript's own rules.
