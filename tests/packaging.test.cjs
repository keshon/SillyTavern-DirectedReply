const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

test('repository root contains a valid installable SillyTavern manifest and runtime assets', () => {
    const root = resolve(__dirname, '..');
    const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    for (const field of ['display_name', 'author', 'version', 'minimum_client_version', 'homePage']) {
        assert.equal(typeof manifest[field], 'string');
        assert.ok(manifest[field].length);
    }
    assert.equal(manifest.version, pkg.version);
    assert.equal(manifest.auto_update, true);
    for (const file of [manifest.js, manifest.css, 'README.md', 'LICENSE']) {
        assert.ok(existsSync(resolve(root, file)), `Missing root asset: ${file}`);
    }
    assert.equal(pkg.dependencies, undefined, 'The installed extension must not require an npm build or install');
});
