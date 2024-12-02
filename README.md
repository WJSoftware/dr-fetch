# dr-fetch

This is one more package for fetching.  The difference with other packages is that this one does it right.

This package:

+ Uses the modern, standardized `fetch` function.
+ Does **not** throw on non-OK HTTP responses.
+ Allows to fully type all possible HTTP responses depending on the HTTP status code.

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
4. Optionally add body parsers.
5. Use the fetcher for every HTTP request needed.

### Installation

```bash
npm i dr-fetch
```

### Create Custom Fetch Function

This is optional and only needed if you need to do something before or after fetching.  By far the most common task to 
do is to add an authorization header to every call.

```typescript
// myFetch.ts
import { obtainToken } from './magical-auth-stuff.js';

export function myFetch(url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
    const token = obtainToken();
    // Add token to request headers.  Not shown because it depends on whether init was given, whether init.headers is
    // a POJO or not, etc.  TypeScript will guide you through the possibilities.
    // Finally, do fetch.
    return fetch(url, init);
}
```

Think of this custom function as the place where you do interceptions (if you are familiar with this term from `axios`).

### Create Fetcher Object

```typescript
import { DrFetch } from "dr-fetch";
import { myFetch } from "./myFetch.js";

const fetcher = new DrFetch(myFetch);
// If you don't need a custom fetch function, just do:
const fetcher = new DrFetch();
```

### Adding a Custom Body Parser

One can say that the `DrFetch` class comes with 2 basic body parsers:

1. JSON parser when the the value of the `coontent-type` response header is `application/json` or similar 
(`application/problem+json`, for instance).
2. Text parser when the value of the `content-type` response header is `text/<something>`, such as `text/plain` or 
`text/csv`.

If your API sends a content type not included in any of the above two cases, use `DrFetch.withParser()` to add a custom 
parser for the content type you are expecting.  The class allows for fluent syntax, so you can chain calls:

```typescript
const fetcher = new DrFetch(myFetch)
    .withParser('custom/contentType', async (response) => {
        // Do what you must with the provided response object.  In the end, you must return the parsed body.
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
    .withParser(...) // Optional parsers
    .withParser(...)
    .for<400, BadRequestBody>()
    ;
```

You can now consume this root fetcher object and it will be pre-typed for the `400` status code.

### Specializing the Root Parser

Ok, nice, but what if we needed a custom parser for just one particular URL?  It makes no sense to add it to the root 
fetcher, and maybe it is even harmful to do so.  In that case, clone the fetcher.

Cloning a fetcher produces a new fetcher with the same data-fetching function, the same body parsers and the same body 
typings, **unless** we specify we want something different, like not cloning the body types, or specifying a new 
data-fetching function.

```typescript
import rootFecher from "./root-fetcher.js";

function specialFetch(url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
    ...
}

const localFetcher = rootFetcher.clone(true); // Same data-fetching function, body parsers and body typing.
const localFetcher = rootFetcher.clone(false); // Same data-fetching function and body parsers.  No body typing.
const localFetcher = rootFetcher.clone(true, { fetchFn: specialFetch }); // Different data-fetching function.
const localFetcher = rootFetcher.clone(true, { includeParsers: false }); // No custom body parsers.
```

> **IMPORTANT**:  The first parameter to the `clone` function cannot be a variable.  It is just used as a TypeScript 
> trick to reset the body typing.  The value itself means nothing in runtime because types are not a runtime thing.

## Usage Without TypeScript (JavaScript Projects)

Why are you a weird fellow/gal?  Anyway, prejudice aside, body typing will mean nothing to you, so forget about `for()` 
and anything else regarding types.  Do your custom data-fetching function, add your custom body parsers and that's it.
