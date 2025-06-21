import { expect } from 'chai';
import { describe, test } from 'mocha';

describe('index', () => {
    test("Should only export the exact expected list of objects.", async () => {
        // Arrange.
        const expectedExports = [
            'DrFetch',
            'makeIterableHeaders',
            'setHeaders',
            'getHeader',
            'hasHeader',
            'StatusCodes',
        ];

        // Act.
        const module = await import('../src/index.js');
        for (const name of expectedExports) {
            expect(module, `Expected object '${name}' is not exported.`).to.have.property(name);
        }
        for (const name of Object.keys(module)) {
            expect(expectedExports, `Unexpected object '${name}' is exported.`).to.include(name);
        }
    });
});