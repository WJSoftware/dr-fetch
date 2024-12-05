import { expect } from 'chai';
import { describe, test } from 'mocha';
import { makeIterableHeaders, setHeaders } from '../setHeaders.js';

describe('setHeaders', () => {
    test("Should throw an error whenever the 'init' argument is undefined.", () => {
        // Act.
        // @ts-expect-error Undefined is an invalid argument for 'init'.
        const act = () => setHeaders(undefined, {});

        // Assert.
        expect(act).to.throw;
    });
    [
        {
            init: { headers: new Headers() },
            destinationType: 'a Headers instance',
        },
        {
            init: { headers: {} },
            destinationType: 'POJO',
        },
        {
            init: { headers: [] },
            destinationType: 'an array of tuples',
        },
    ].flatMap(d => {
        const headersMap1 = new Map();
        headersMap1.set('Accept', 'application/json');
        const headersMap2 = new Map();
        headersMap2.set('Accept', 'application/json');
        headersMap2.set('Authorization', 'Bearer let-me-in');
        const headers1 = new Headers();
        headers1.set('Accept', 'application/json');
        const headers2 = new Headers();
        headers2.set('Accept', 'application/json');
        headers2.set('Authorization', 'Bearer let-me-in');
        return [
            {
                headers: [
                    ['Accept', 'application/json'],
                ] satisfies [string, string][],
                headersType: 'an array of tuples',
                text: '1 header',
                headerCount: 1,
            },
            {
                headers: [
                    ['Accept', 'application/json'],
                    ['Authorization', 'Bearer let-me-in'],
                ] as [string, string][],
                headersType: 'an array of tuples',
                text: '2 headers',
                headerCount: 2,
            },
            {
                headers: {
                    'Accept': 'application/json'
                } as Record<string, string>,
                headersType: 'a POJO',
                text: '1 header',
                headerCount: 1,
            },
            {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': 'Bearer let-me-in',
                } satisfies Record<string, string>,
                headersType: 'a POJO',
                text: '2 headers',
                headerCount: 2,
            },
            {
                headers: headers1,
                headersType: 'a Headers object',
                text: '1 header',
                headerCount: 1,
            },
            {
                headers: headers2,
                headersType: 'a Headers object',
                text: '2 headers',
                headerCount: 2,
            },
            {
                headers: headersMap1,
                headersType: 'a Map object',
                text: '1 header',
                headerCount: 1,
            },
            {
                headers: headersMap2,
                headersType: 'a Map object',
                text: '2 headers',
                headerCount: 2,
            },
        ].map(s => ({
            ...d,
            ...s,
        }));
    }).forEach(tc => {
        test(`Should add the specified ${tc.text} to the 'init' object when specified as ${tc.headersType} and stored in ${tc.destinationType}.`, () => {
            // Arrange.
            // Clean up the destination.  Needed because of how the test cases are set up with flatMap().
            if (Array.isArray(tc.init.headers)) {
                tc.init.headers.length = 0;
            }
            else if (tc.init.headers instanceof Headers) {
                for (let key of [...tc.init.headers.keys()]) {
                    tc.init.headers.delete(key);
                }
            }
            else {
                tc.init.headers = {};
            }

            // Act.
            setHeaders(tc.init, tc.headers);

            // Assert.
            const resultingHeaders = [...makeIterableHeaders(tc.init.headers)];
            expect(resultingHeaders.length).to.equal(tc.headerCount);
        });
    });
    const headerKey = 'Accept';
    const headerValues = [
        'application/json',
        'applicaiton/xml',
    ];
    [
        {
            source: new Map<string, ReadonlyArray<string>>([[headerKey, headerValues]]),
            sourceText: 'a Map object',
        },
        {
            source: {
                [headerKey]: headerValues
            },
            sourceText: 'a POJO object',
        },
    ].flatMap(s => [
        {
            destination: new Headers(),
            text: 'a Headers object',
        },
        {
            destination: {} satisfies Record<string, ReadonlyArray<string>>,
            text: 'a POJO object',
        },
        {
            destination: [] satisfies [string, string][],
            text: 'an array of tuples',
        },
    ].map(d => ({ ...s, ...d }))).forEach(tc => {
        test(`Should combine multiple values of the same header from ${tc.sourceText} when the destination is ${tc.text}.`, () => {
            // Arrange.
            const init = {
                headers: tc.destination,
            };

            // Act.
            setHeaders(init, tc.source);

            // Assert.
            const resultingHeaders = [...makeIterableHeaders(init.headers)];
            expect(resultingHeaders.length).to.equal(1);
            expect(resultingHeaders[0][1]).to.equal(headerValues.join(', '));
        });
    });
});
