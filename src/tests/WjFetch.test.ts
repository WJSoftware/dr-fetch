import { expect } from "chai";
import { describe, test } from "mocha";
import { fake } from 'sinon';
import { WjFetch } from "../WjFetch.js";

describe('WjFetch', () => {
    describe('clone()', () => {
        [
            {
                newFetchFn: false,
                includeParsers: false,
                text: 'the same data-fetching function and no parsers',
            },
            {
                newFetchFn: true,
                includeParsers: false,
                text: 'a new data-fetching function and no parsers',
            },
            {
                newFetchFn: false,
                includeParsers: true,
                text: 'the same data-fetching function and identical parsers',
            },
            {
                newFetchFn: true,
                includeParsers: true,
                text: 'a new data-fetching function and identical parsers',
            },
        ].forEach(tc => {
            test(`Should create a new fetcher object with ${tc.text}.`, async () => {
                // Arrange.
                const contentType = 'text/plain';
                const origFetchFn = fake.resolves(new Response('Hi!', { headers: { 'content-type': contentType } }));
                const customParserFn = fake();
                const origFetcher = new WjFetch(origFetchFn);
                origFetcher.withParser(contentType, customParserFn);
                const newFetchFn = fake.resolves(new Response('Hi!', { headers: { 'content-type': contentType } }));

                // Act.
                const cloned = origFetcher.clone(true, { fetchFn: tc.newFetchFn ? newFetchFn : undefined, includeParsers: tc.includeParsers });

                // Assert.
                await cloned.fetch('x');
                expect(newFetchFn.called).to.equal(tc.newFetchFn);
                expect(customParserFn.called).to.equal(tc.includeParsers);
            });
        });
    });
    describe('fetch()', () => {
        test("Should call the stock fetch() function when the fetcher is built without a custom one.", async () => {
            // Arrange.
            const origFetch = globalThis.fetch;
            const fakeFetch = fake.resolves(new Response(null));
            globalThis.fetch = fakeFetch;
            const fetcher = new WjFetch();

            // Act.
            try {
                await fetcher.fetch('x');
            }
            finally {
                globalThis.fetch = origFetch;
            }

            // Assert.
            expect(fakeFetch.called).to.be.true;
        });
        test("Should call the provided data-fetching function.", async () => {
            // Arrange.
            const fakeFetch = fake.resolves(new Response(null));
            const fetcher = new WjFetch(fakeFetch);

            // Act.
            await fetcher.fetch('x');

            // Assert.
            expect(fakeFetch.called).to.be.true;
        });
        [
            {
                contentType: 'application/json',
                body: {
                    a: 'hello',
                },
            },
            {
                contentType: 'application/ld+json',
                body: {
                    a: 'hello',
                    b: true,
                }
            },
            {
                contentType: 'application/problem+json',
                body: {
                    a: 'hello',
                    b: true,
                    c: {
                        h: 123,
                    },
                }
            },
            {
                contentType: 'text/plain',
                body: "Plain.",
            },
            {
                contentType: 'text/csv',
                body: "a,b,c\n1,2,3",
            },
        ].map(x => ({
            contentType: x.contentType,
            body: typeof x.body === 'string' ? x.body : JSON.stringify(x.body),
            testBody: x.body,
        })).forEach(tc => {
            test(`Should parse the body using the stock body parsers when content type is "${tc.contentType}".`, async () => {
                // Arrange.
                const fetchFn = fake.resolves(new Response(tc.body, { headers: { 'content-type': tc.contentType } }));
                const fetcher = new WjFetch(fetchFn);

                // Act.
                const result = await fetcher.for<200, string | object>().fetch('x');

                // Assert.
                if (typeof tc.testBody === 'object') {
                    expect(result.body).to.deep.equal(tc.testBody);
                }
                else {
                    expect(result.body).to.equal(tc.testBody);
                }
            });
        });
        test("Should return 'null' as body whenever the response carries no body.", async () => {
            // Arrange.
            const fetchFn = fake.resolves(new Response());
            const fetcher = new WjFetch(fetchFn);

            // Act.
            const response = await fetcher.for<200, string>().fetch('x');

            // Assert.
            expect(response.body).to.be.null;
        });
        test("Should throw whenever the response carries no content-type header.", async () => {
            // Arrange.
            const response = new Response('x');
            response.headers.delete('content-type');
            const fetchFn = fake.resolves(response);
            const fetcher = new WjFetch(fetchFn);
            let didThrow = false;

            // Act.
            try {
                await fetcher.for<200, string>().fetch('x');
            }
            catch {
                didThrow = true;
            }

            // Assert.
            expect(didThrow).to.be.true;
        });
        test("Should throw an error if the content type is unknown by the built-in parsers and custom parsers.", async () => {
            // Arrange.
            const fetchFn = fake.resolves(new Response('x', { headers: { 'content-type': 'application/xml' }}));
            const fetcher = new WjFetch(fetchFn);
            let didThrow = false;

            // Act.
            try {
                await fetcher.fetch('x');
            }
            catch {
                didThrow = true;
            }

            // Assert.
            expect(didThrow).to.be.true;
        });
        [
            {
                pattern: 'xml',
                patternType: 'string',
                contentTypes: [
                    'application/xml',
                    'application/custom+xml',
                    'text/xml',
                    'xml',
                    'text/xml; encoding: utf-8'
                ],
            },
            {
                pattern: /^application\/([\w+-]*)xml/,
                patternType: 'regular expression',
                contentTypes: [
                    'application/xml',
                    'application/custom+xml',
                    'application/custom+xml; encoding: utf-8',
                    'application/hyper-xml',
                ],
            },
        ].flatMap(x => {
            const expanded = [];
            for (let ct of x.contentTypes) {
                expanded.push({
                    pattern: x.pattern,
                    patternType: x.patternType,
                    contentType: ct
                });
            }
            return expanded;
        }).forEach(tc => {
            test(`Should use the provided custom parser with ${tc.patternType} pattern "${tc.pattern.toString()}" for content type "${tc.contentType}".`, async () => {
                // Arrange.
                const parserFn = fake();
                const fetchFn = fake.resolves(new Response('x', { headers: { 'content-type': tc.contentType }}));
                const fetcher = new WjFetch(fetchFn);
                fetcher.withParser(tc.pattern, parserFn);

                // Act.
                await fetcher.fetch('x');

                // Assert.
                expect(parserFn.calledOnce).to.be.true;
            });
        })
    });
});
