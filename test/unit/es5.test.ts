import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { parse } from 'acorn';
import { full } from 'acorn-walk';
import { DiagramBudgetExceededError } from '../../src/ordering/shared-diagram.js';

/**
 * The library is published as ES5, so that bundles which must stay ES5
 * (like the ES5 build of Dexie.js) can include it without transpiling it.
 */
const ES2015_NODE_TYPES = new Set([
    'ArrowFunctionExpression',
    'ClassDeclaration',
    'ClassExpression',
    'TemplateLiteral',
    'TaggedTemplateExpression',
    'SpreadElement',
    'RestElement',
    'ForOfStatement',
    'ObjectPattern',
    'ArrayPattern',
    'AssignmentPattern',
    'AwaitExpression',
    'YieldExpression',
    'MetaProperty'
]);

function jsFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return jsFiles(file);
        }
        return file.endsWith('.js') ? [file] : [];
    });
}

describe('es5.test.ts', () => {
    // compiled to dist/cjs/test/unit
    const cjsDir = path.join(__dirname, '..', '..', 'src');
    const esmDir = path.join(__dirname, '..', '..', '..', 'esm', 'src');

    it('the CommonJS build should only contain ES5 syntax', () => {
        const files = jsFiles(cjsDir);
        assert.ok(files.length > 0);
        files.forEach(file => {
            try {
                parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 5 });
            } catch (err) {
                throw new Error(path.relative(cjsDir, file) + ' is not ES5: ' + (err as Error).message);
            }
        });
    });
    it('the ES module build should only contain ES5 syntax besides import and export', () => {
        const files = jsFiles(esmDir);
        assert.ok(files.length > 0);
        files.forEach(file => {
            const ast = parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 2015, sourceType: 'module', locations: true });
            full(ast, (node: any) => {
                const isES2015 = ES2015_NODE_TYPES.has(node.type) ||
                    (node.type === 'VariableDeclaration' && node.kind !== 'var') ||
                    (node.type === 'Property' && (node.shorthand || node.method || node.computed)) ||
                    ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') && (node.generator || node.async));
                if (isES2015) {
                    throw new Error(path.relative(esmDir, file) + ':' + node.loc.start.line + ' is not ES5: ' + node.type);
                }
            });
        });
    });
    it('the packed BDD modules should contain no compiler helpers', () => {
        /**
         * They are bundled at runtime (for example by event-reduce-js).
         * Top-level helpers like __values() cannot be tree-shaken by bundlers.
         */
        const files = jsFiles(path.join(esmDir, 'packed'));
        assert.ok(files.length > 0);
        files.forEach(file => {
            const helpers = fs.readFileSync(file, 'utf8').match(/var __[a-zA-Z]+ =/g);
            assert.strictEqual(helpers, null, path.relative(esmDir, file) + ' contains ' + helpers);
        });
    });
    it('the ES module build should be importable as an ES module', () => {
        /**
         * Compiled with the ES5 target and no module option, TypeScript
         * outputs CommonJS, which fails in the "type": "module" folder.
         */
        const output = execFileSync(process.execPath, [
            '--input-type=module',
            '-e',
            'const m = await import(' + JSON.stringify('file://' + path.join(esmDir, 'index.js')) + ');' +
            'console.log(typeof m.resolveWithPackedBdd + typeof m.packedBddFromBase64String);'
        ]).toString().trim();
        assert.strictEqual(output, 'functionfunction');
    });
    it('the CommonJS build should be requireable', () => {
        const m = require(path.join(cjsDir, 'index.es5.js'));
        assert.strictEqual(typeof m.resolveWithPackedBdd, 'function');
        assert.strictEqual(typeof m.packedBddFromBase64String, 'function');
    });
    it('instanceof should work on the errors of the library', () => {
        const error = new DiagramBudgetExceededError();
        assert.ok(error instanceof DiagramBudgetExceededError);
        assert.ok(error instanceof Error);
        assert.strictEqual(error.name, 'DiagramBudgetExceededError');
    });
});
