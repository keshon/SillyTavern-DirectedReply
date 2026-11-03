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

test('placeholder locale packs use the native manifest and cover all hint keys', () => {
    const root = resolve(__dirname, '..');
    const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
    const html = readFileSync(resolve(root, 'index.js'), 'utf8');
    const keys = ['directionHint', 'styleHint', 'previewHint'].map(key => `directedReply.${key}`);
    for (const [locale, file] of Object.entries(manifest.i18n)) {
        const pack = JSON.parse(readFileSync(resolve(root, file), 'utf8'));
        for (const key of keys) {
            assert.equal(typeof pack[key], 'string', `${locale} is missing ${key}`);
            assert.ok(pack[key].length);
            assert.ok(html.includes(`[placeholder]${key}`));
        }
    }
    assert.equal(Object.keys(manifest.i18n).length, 16);
    assert.doesNotMatch(html, /placeholder="Можно по-русски/);
});
