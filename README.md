# dr-fetch

This is one more package for fetching.  The difference with other packages is that this one does it right.

This package:

+ Uses the modern, standardized `fetch` function.
+ Does **not** throw on non-OK HTTP responses.
+ **Allows to fully type all possible HTTP responses depending on the HTTP status code.**

## Does a Non-OK Status Code Warrant an Error?

No.  Non-OK status codes may communicate things like validation errors, which usually requires that the application 
*informs* the user about which piece of data is wrong.  Why should this logic be inside a `catch` block?  The fact is,
`try..catch` would be there as a replacement of branching (using  `if` or `switch`).  This is a very smelly code smell.

The second reason is that in most runtimes, unwinding the call stack is costly.  Why should we pay a price in 
performance just to include the code smell of using `try..catch` as a branching statement?  There is no reason to do 
such thing.

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

### Create Custom Fetch Function

This is optional and only needed if you need to do something before or after fetching.  By far the most common task to 
do is to add the `authorization` header and the `accept` header to every call.

```typescript
// myFetch.ts
import { obtainToken } from './magical-auth-stuff.js';
import { setHeaders } from 'dr-fetch';

export function myFetch(url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
    const token = obtainToken();
    // Make sure there's an object where headers can be added:
    init ??= {};
    // With setHeaders(), you can add headers to 'init' with a map, an array of tuples, a Headers 
    // object or a POJO object.
    setHeaders(init, { 'Accept': 'application/json', 'Authorization': `Bearer ${token}`});
    // Finally, do fetch.
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

> **NOTE**: The content type can also be matched passing a regular expression instead of a string.

Now the fetcher object is ready for use.

### Using the Fetcher Object

This is the fun part where we can enumerate the various shapes of the body depending on the HTTP status code:

```typescript
import type { MyData } from "./my-datatypes.js";
import fetcher from './fetcher.js';

const response = await fetcher
    .for<200, MyData[]>()
    .for<401, { loginUrl: string; }>()
    .fetch('/api/mydata/?active=true')
    ;
```

The object stored in the `response` variable will contain the following properties:

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

## Smarter Uses

It is smart to create just one fetcher, configure it, then use it for every fetch call.  Because generally speaking, 
different URL's will carry a different body type, the fetcher object should be kept free of `for<>()` calls.  However, 
what if your API is standardized so all status `400` bodies look the same?  Then configure that type:

```typescript
// root-fetcher.ts
import { DrFetch } from "dr-fetch";
import { myFetch } from "./my-fetch.js";
import type { BadRequestBody } from "my-datatypes.js";

export default new DrFetch(myFetch)
    .withProcessor(...) // Optional processors
    .withProcessor(...)
    .for<400, BadRequestBody>()
    ;
```

You can now consume this root fetcher object and it will be pre-typed for the `400` status code.

### Specializing the Root Fetcher

Ok, nice, but what if we needed a custom processor for just one particular URL?  It makes no sense to add it to the 
root fetcher, and maybe it is even harmful to do so.  In that case, clone the fetcher.

Cloning a fetcher produces a new fetcher with the same data-fetching function, the same body processors and the same 
body typings, **unless** we specify we want something different, like not cloning the body types, or specifying a new 
data-fetching function.

```typescript
import rootFetcher from "./root-fetcher.js";

function specialFetch(url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
    ...
}

const localFetcher = rootFetcher.clone(true); // Same data-fetching function, body processors and body typing.
const localFetcher = rootFetcher.clone(false); // Same data-fetching function and body processors.  No body typing.
const localFetcher = rootFetcher.clone(true, { fetchFn: specialFetch }); // Different data-fetching function.
const localFetcher = rootFetcher.clone(true, { includeProcessors: false }); // No custom body processors.
const localFetcher = rootFetcher.clone(true, { fetchFn: false }); // Identical processors and body typing, stock fetch().
```

> **IMPORTANT**:  The first parameter to the `clone` function cannot be a variable.  It is just used as a TypeScript 
> trick to reset the body typing.  The value itself means nothing in runtime because types are not a runtime thing.

## Shortcut Functions

> Since **v0.3.0**

`DrFetch` objects now provide the shortcut functions `get`, `head`, `post`, `patch`, `put` and `delete`.  Except for 
`get` and `head`, all these accept a body parameter.  When this body is a POJO or an array, the body is stringified and 
the `Content-Type` header is given the value `application/json`.  If a body of any other type is given (that the 
`fetch()` function accepts, such as `FormData`), no headers are explicitly specified and therefore it is up to what 
`fetch()` (or the custom data-fetching function you provide) does in these cases.

```typescript
import type { Todo } from './myTypes.js';

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

## setHeaders and makeIterableHeaders

> Since **v0.4.0**

These are two helper functions that assist you in writing custom data-fetching functions.

If you haven't realized, the `init` paramter in `fetch()` can have the headers specified in 3 different formats:

+ As a `Headers` object (an instance of the `Headers` class)
+ As a POJO object, where the property key is the header name, and the property value is the header value
+ As an array of tuples of type `[string, string]`, where the first element is the header name, and the second one is 
its value

To further complicate this, the POJO object also accepts an array of strings as property values for headers that accept 
multiple values.

So writing a formal custom fetch **without** `setHeaders()` looks like this:

```typescript
export function myFetch(URL: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
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

This would also get more complex if you account for multi-value headers.  Now the same thing, using `setHeaders()`:

```typescript
export function myFetch(URL: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
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

The difference is indeed pretty shocking.  Also note that adding arrays of values doesn't increase the complexity of 
the code.

### makeIterableHeaders

This function is the magic trick that powers the `setHeaders` function, and is very handy for troubleshooting or unit 
testing because it can take a collection of HTTP header specifications in the form of a map, a Headers object, a POJO 
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

// The output of these is identical.
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

## Usage Without TypeScript (JavaScript Projects)

Why are you a weird fellow/gal?  Anyway, prejudice aside, body typing will mean nothing to you, so forget about `for()` 
and anything else regarding types.  Do your custom data-fetching function, add your custom body processors and fetch 
away using `.fetch()`, `.get()`, `head()`, `.post()`, `.put()`, `.patch()` or `.delete()`.

## Plug-ins?  Fancy Stuff?

Indeed, we can have fancy stuff.  As demonstration, this section will show you how one can add download progress with 
a simple class and a custom body processor.

The following is a class for **Svelte v5**.  It contains a reactive `progress` property that is updated as download 
progresses.

> [!NOTE]
> You should have no problems translating this to Vue, SolidJS or even Angular since all these are signal-powered.
> For React, you'll have to get rid of the signals part and perhaps make it callback-powered.

```ts
export class DownloadProgress {
    progress = $state(0);

    constructor(response: Response) {
        this.#downloadResponse(response);
    }

    async #downloadResponse(response: Response) {
        const totalSize = +(response.headers.get('content-length') ?? 0);
        let receivedSize = 0;
        const bodyReader = response.body!.getReader();
        while (bodyReader) {
            const { done, value } = await bodyReader.read();
            if (done) {
                break;
            }
            receivedSize += value.length;
            this.progress = (receivedSize / totalSize);
        }
    }
}
```

The class is actually discarding the contents of the downloaded file.  Make sure you modify it to save the data.  This 
example merely cares about illustrating the mechanism of how you can post-process HTTP responses.

### How To Use

Create a custom processor for the content type that will be received, for example, `video/mp4` for MP4 video files.

```ts
// downloader.ts
import { DownloadProgress } from './DownloadProgress.svelte.js';

export default new DrFetch(/* custom fetch function here, if needed */)
    .withProcessor('video/mp4', (r) => Promise.resolve(new DownloadProgress(r)))
    ;
```

The Svelte component would use this fetcher object.  The response from `fetcher.fetch()` (or `fetcher.get()`) will 
carry the class instance in the `body` property.

```svelte
<script lang="ts">
    import { DownloadProgress } from './DownloadProgress.svelte.js';
    import downloader from './downloader.js';

	let download = $state<Download>();

	async function startDownload() {
		download = (await downloader
            .for<200, DownloadProgress>()
            .get('https://example.com/my-video.mp4'))
            .body
            ;
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
