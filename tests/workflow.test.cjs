const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { chromium } = require('playwright');

let browser;
before(async () => {
    browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
});
after(async () => { await browser?.close(); });

async function fixture(t, folder = 'directed-reply') {
    const page = await browser.newPage();
    t.after(() => page.close());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    t.after(() => assert.deepEqual(errors, []));
    await page.route('http://draft.test/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/script.js') {
            return route.fulfill({ contentType: 'text/javascript', body: 'export const isGenerating = () => window.busy;' });
        }
        if (path.endsWith('/index.js')) {
            return route.fulfill({ contentType: 'text/javascript', body: readFileSync(resolve(__dirname, '../index.js'), 'utf8') });
        }
        return route.fulfill({ contentType: 'text/html', body: `
            <div id="send_form"><div id="leftSendForm"></div><textarea id="send_textarea"></textarea></div>
            <script>
                window.$ = callback => callback();
                window.busy = false;
                window.calls = [];
                window.events = {};
                window.ctx = {
                    chatId: 'scene', characterId: 0, groupId: null,
                    name1: 'Player', name2: 'Character', onlineStatus: 'connected',
                    powerUserSettings: { persona_description: 'Reserved detective' },
                    extensionSettings: {},
                    saveSettingsDebounced: () => { window.settingsSaved = true; },
                    chat: [{ name: 'Character', mes: 'Where were you?', is_user: false }],
                    eventTypes: { CHAT_CHANGED: 'chat-changed' },
                    eventSource: { on: (type, handler) => window.events[type] = handler },
                    stopGeneration: () => { window.stopCalled = true; },
                    generateQuietPrompt: options => {
                        window.calls.push(options);
                        return new Promise((resolve, reject) => { window.finish = resolve; window.fail = reject; });
                    },
                };
                window.SillyTavern = { getContext: () => window.ctx };
            </script>
            <script type="module" src="/scripts/extensions/third-party/${folder}/index.js"></script>
        ` });
    });
    await page.goto('http://draft.test/');
    await page.locator('#directed-reply-toggle').click();
    return page;
}

async function generate(page, result = 'I glance at the door. "What key?"') {
    await page.locator('#dr-direction').fill('Hide suspicion and ask about the key.');
    await page.locator('[data-dr="generate"]').click();
    await page.evaluate(text => window.finish(text), result);
    await page.waitForFunction(() => !document.querySelector('[data-dr="generate"]').disabled);
}

test('private generation uses context, editable preview, and acceptance without sending', async t => {
    const page = await fixture(t);
    await generate(page);
    const options = await page.evaluate(() => window.calls[0]);
    assert.equal(options.quietToLoud, false);
    assert.equal(options.skipWIAN, false);
    assert.match(options.quietPrompt, /Reserved detective/);
    assert.match(options.quietPrompt, /ONLY as the player persona named Player/);
    assert.equal(await page.locator('#send_textarea').inputValue(), '');
    await page.locator('#dr-preview').fill('My edited reply.');
    await page.locator('[data-dr="use"]').click();
    assert.equal(await page.locator('#send_textarea').inputValue(), 'My edited reply.');
    assert.equal(await page.evaluate(() => window.ctx.chat.length), 1);
});

test('existing composer needs explicit replacement and can seed the draft', async t => {
    const page = await fixture(t);
    await page.locator('#send_textarea').fill('My existing text.');
    await page.locator('[data-dr="seed"]').check();
    await generate(page);
    assert.match(await page.evaluate(() => window.calls[0].quietPrompt), /My existing text/);
    await page.locator('[data-dr="use"]').click();
    assert.equal(await page.locator('#send_textarea').inputValue(), 'My existing text.');
    await page.locator('[data-dr="keep"]').click();
    assert.equal(await page.locator('#send_textarea').inputValue(), 'My existing text.');
    await page.locator('[data-dr="use"]').click();
    await page.locator('[data-dr="confirm"]').click();
    assert.match(await page.locator('#send_textarea').inputValue(), /What key/);
});

test('stop discards late results and keeps the previous draft', async t => {
    const page = await fixture(t);
    await generate(page, 'Previous draft.');
    await page.locator('[data-dr="generate"]').click();
    await page.locator('[data-dr="stop"]').click();
    await page.evaluate(() => window.finish('Cancelled result.'));
    await page.waitForFunction(() => !document.querySelector('[data-dr="generate"]').disabled);
    assert.equal(await page.locator('#dr-preview').inputValue(), 'Previous draft.');
    assert.equal(await page.evaluate(() => window.stopCalled), true);
});

test('chat switch clears private state and discards an in-flight result', async t => {
    const page = await fixture(t);
    await page.locator('#dr-direction').fill('Ask about the key.');
    await page.locator('[data-dr="generate"]').click();
    await page.evaluate(() => {
        window.ctx.chatId = 'another-scene';
        window.events['chat-changed']();
        window.finish('Wrong chat result.');
    });
    await page.locator('#directed-reply-toggle').click();
    assert.equal(await page.locator('#dr-preview').inputValue(), '');
    assert.equal(await page.locator('#dr-direction').inputValue(), '');
    assert.equal(await page.locator('[data-dr="use"]').isDisabled(), true);
});

test('edited history or persona invalidates a draft', async t => {
    const page = await fixture(t);
    await generate(page);
    await page.evaluate(() => window.ctx.chat[0].mes = 'A different situation.');
    await page.locator('[data-dr="use"]').click();
    assert.equal(await page.locator('#send_textarea').inputValue(), '');
    assert.match(await page.locator('[data-dr="status"]').textContent(), /changed/);
});

test('conversation changes during generation discard the pending result', async t => {
    const page = await fixture(t);
    await page.locator('#dr-direction').fill('Ask about the key.');
    await page.locator('[data-dr="generate"]').click();
    await page.evaluate(() => {
        window.ctx.chat.push({ name: 'Player', mes: 'I leave.', is_user: true });
        window.finish('A reply to the previous scene.');
    });
    await page.waitForFunction(() => !document.querySelector('[data-dr="generate"]').disabled);
    assert.equal(await page.locator('#dr-preview').inputValue(), '');
    assert.match(await page.locator('[data-dr="status"]').textContent(), /changed during generation/);
});

test('group member selection during quiet generation does not invalidate the group draft', async t => {
    const page = await fixture(t);
    await page.evaluate(() => window.ctx.groupId = 'group');
    await page.locator('#dr-direction').fill('Ask about the key.');
    await page.locator('[data-dr="generate"]').click();
    await page.evaluate(() => {
        window.ctx.characterId = 2;
        window.finish('I ask the group about the key.');
    });
    await page.waitForFunction(() => !document.querySelector('[data-dr="generate"]').disabled);
    await page.locator('[data-dr="use"]').click();
    assert.equal(await page.locator('#send_textarea').inputValue(), 'I ask the group about the key.');
});

test('concurrent generation, disconnected API, empty brief and missing chat are rejected', async t => {
    const page = await fixture(t);
    await page.locator('[data-dr="generate"]').click();
    assert.match(await page.locator('[data-dr="status"]').textContent(), /Describe/);
    await page.locator('#dr-direction').fill('Ask about the key.');
    await page.evaluate(() => window.busy = true);
    await page.locator('[data-dr="generate"]').click();
    assert.match(await page.locator('[data-dr="status"]').textContent(), /current generation/);
    await page.evaluate(() => { window.busy = false; window.ctx.onlineStatus = 'no_connection'; });
    await page.locator('[data-dr="generate"]').click();
    assert.match(await page.locator('[data-dr="status"]').textContent(), /Connect/);
    await page.evaluate(() => { window.ctx.onlineStatus = 'connected'; window.ctx.chatId = undefined; });
    await page.locator('[data-dr="generate"]').click();
    assert.match(await page.locator('[data-dr="status"]').textContent(), /Open a character/);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
});

test('model failures and empty responses preserve a usable previous preview', async t => {
    const page = await fixture(t);
    await generate(page, 'Previous draft.');
    await page.locator('[data-dr="generate"]').click();
    await page.evaluate(() => window.fail(new Error('Backend unavailable')));
    await page.waitForFunction(() => !document.querySelector('[data-dr="generate"]').disabled);
    assert.match(await page.locator('[data-dr="status"]').textContent(), /Backend unavailable/);
    await page.locator('[data-dr="generate"]').click();
    await page.evaluate(() => window.finish(''));
    await page.waitForFunction(() => !document.querySelector('[data-dr="generate"]').disabled);
    assert.match(await page.locator('[data-dr="status"]').textContent(), /No draft/);
    assert.equal(await page.locator('#dr-preview').inputValue(), 'Previous draft.');
});

test('Ctrl+Enter generates once and model markup remains plain text', async t => {
    const page = await fixture(t);
    await page.locator('#dr-direction').fill('Ask about the key.');
    await page.locator('#dr-direction').press('Control+Enter');
    await page.evaluate(() => window.finish('<img src=x onerror="window.injected=true">'));
    await page.waitForFunction(() => !document.querySelector('[data-dr="generate"]').disabled);
    assert.equal(await page.evaluate(() => window.calls.length), 1);
    assert.equal(await page.evaluate(() => window.injected), undefined);
    assert.match(await page.locator('#dr-preview').inputValue(), /<img/);
});

test('Russian directions default to English prose with a word target', async t => {
    const page = await fixture(t);
    await page.locator('#dr-direction').fill('Беру чашку, благодарю за чай и спрашиваю, что это за сорт.');
    await page.locator('[data-dr="generate"]').click();
    const prompt = await page.evaluate(() => window.calls[0].quietPrompt);
    assert.match(prompt, /entire finished reply in English/);
    assert.match(prompt, /Беру чашку/);
    assert.match(prompt, /100–180 words/);
    assert.match(prompt, /First-person, present-tense/);
    assert.doesNotMatch(prompt, /Match the language, perspective/);
    await page.evaluate(() => window.finish('I take the cup. "Thank you."'));
    await page.waitForFunction(() => !document.querySelector('[data-dr="generate"]').disabled);
    assert.equal(await page.locator('#dr-preview').inputValue(), 'I take the cup. "Thank you."');
});

test('output language and length are independently selectable and saved', async t => {
    const page = await fixture(t);
    await page.locator('#dr-language').selectOption('ru');
    await page.locator('#dr-length').selectOption('short');
    await generate(page, 'Я беру чашку.');
    const prompt = await page.evaluate(() => window.calls[0].quietPrompt);
    assert.match(prompt, /entire finished reply in Russian/);
    assert.match(prompt, /60–100 words/);
    assert.deepEqual(await page.evaluate(() => window.ctx.extensionSettings.directedReply), { language: 'ru', length: 'short' });
    assert.equal(await page.evaluate(() => window.settingsSaved), true);
    await page.locator('#dr-language').selectOption('chat');
    await page.locator('[data-dr="generate"]').click();
    assert.match(await page.evaluate(() => window.calls[1].quietPrompt), /Do not infer it from the language of the directions/);
    await page.evaluate(() => window.finish('Another reply.'));
    await page.waitForFunction(() => !document.querySelector('[data-dr="generate"]').disabled);
});

test('planning-note responses are rejected without replacing the previous draft', async t => {
    const page = await fixture(t);
    await generate(page, 'A usable draft.');
    await page.locator('[data-dr="generate"]').click();
    await page.evaluate(() => window.finish('[PRIVATE_WRITING_BRIEF]\nContext: The player wakes up.'));
    await page.waitForFunction(() => !document.querySelector('[data-dr="generate"]').disabled);
    assert.equal(await page.locator('#dr-preview').inputValue(), 'A usable draft.');
    assert.match(await page.locator('[data-dr="status"]').textContent(), /planning notes/);
});

test('Gemma thought channels are removed while preserving the actual reply', async t => {
    const page = await fixture(t);
    await generate(page, '<|channel>thought\nPlan the scene in English.\n<channel|>I rub my eyes. "Where am I?"');
    assert.equal(await page.locator('#dr-preview').inputValue(), 'I rub my eyes. "Where am I?"');
    await page.locator('[data-dr="generate"]').click();
    await page.evaluate(() => window.finish('<|channel>thought\nUnfinished planning'));
    await page.waitForFunction(() => !document.querySelector('[data-dr="generate"]').disabled);
    assert.match(await page.locator('[data-dr="status"]').textContent(), /unfinished reasoning/);
    assert.equal(await page.locator('#dr-preview').inputValue(), 'I rub my eyes. "Where am I?"');
});

test('Markdown survives reasoning cleanup, preview editing, and composer acceptance', async t => {
    const page = await fixture(t, 'SillyTavern-DirectedReply');
    const markdown = '*I rub my eyes, then offer a hesitant smile.*\n\n```\nAm I really safe here?\n```\n\n"Thank you for helping me."';
    await generate(page, '<|channel>thought\nFollow the requested format.\n<channel|>' + markdown);
    const prompt = await page.evaluate(() => window.calls[0].quietPrompt);
    assert.match(prompt, /Wrap actions, physical reactions, and sensory narration in single asterisks/);
    assert.match(prompt, /plain triple-backtick fenced blocks/);
    assert.doesNotMatch(prompt, /without asterisks/);
    assert.equal(await page.locator('#dr-preview').inputValue(), markdown);
    const edited = markdown.replace('hesitant smile', 'grateful smile');
    await page.locator('#dr-preview').fill(edited);
    await page.locator('[data-dr="use"]').click();
    assert.equal(await page.locator('#send_textarea').inputValue(), edited);
    assert.equal(await page.evaluate(() => window.ctx.chat.length), 1);
});
