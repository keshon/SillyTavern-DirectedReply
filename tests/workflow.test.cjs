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
    page.setDefaultTimeout(8000);
    t.after(() => page.close());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    t.after(() => assert.deepEqual(errors, []));
    await page.route('http://draft.test/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/script.js') {
            return route.fulfill({ contentType: 'text/javascript', body: 'export const isGenerating = () => window.busy;' });
        }
        if (path.endsWith('/style.css')) {
            return route.fulfill({ contentType: 'text/css', body: readFileSync(resolve(__dirname, '..', 'style.css'), 'utf8') });
        }
        if (path.endsWith('/index.js') || path.endsWith('/generation.js')) {
            return route.fulfill({ contentType: 'text/javascript', body: readFileSync(resolve(__dirname, '..', path.split('/').pop()), 'utf8') });
        }
        return route.fulfill({ contentType: 'text/html', body: `
            <meta charset="utf-8">
            <link rel="stylesheet" href="/style.css">
            <div id="extensions_settings2"></div>
            <select id="ui_language_select" hidden><option value="">Default</option><option value="en">English</option><option value="ru-ru">Русский (Russian)</option><option value="fr-fr">Français (French)</option><option value="ja-jp">日本語 (Japanese)</option></select><div id="send_form"><div id="leftSendForm"><div id="extensionsMenuButton">Magic wand</div></div><textarea id="send_textarea"></textarea></div>
            <script>
                window.$ = callback => callback();
                window.busy = false;
                window.calls = [];
                window.events = {};
                window.ctx = {
                    chatId: 'scene', characterId: 0, groupId: null,
                    name1: 'Player', name2: 'Character', onlineStatus: 'connected',
                    powerUserSettings: { persona_description: 'Reserved detective', reasoning: {prefix: '<|channel>thought', suffix: '<channel|>'} },
                    parseReasoningFromString: text => {
                        const {prefix,suffix} = window.ctx.powerUserSettings.reasoning;
                        const end = text.indexOf(suffix, prefix.length);
                        return text.startsWith(prefix) && end >= 0 ? {content:text.slice(end+suffix.length),reasoning:text.slice(prefix.length,end)} : {content:text,reasoning:''};
                    },
                    extensionSettings: JSON.parse(localStorage.getItem('test-settings') || '{}'),
                    saveSettingsDebounced: () => { window.settingsSaved = true; localStorage.setItem('test-settings', JSON.stringify(window.ctx.extensionSettings)); },
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
    assert.match(options.quietPrompt, /persona and scene already in context/);
    assert.doesNotMatch(options.quietPrompt, /Reserved detective/);
    assert.match(options.quietPrompt, /ONLY as the player persona named Player/);
    assert.equal(await page.locator('#send_textarea').inputValue(), '');
    await page.locator('#dr-preview').fill('My edited reply.');
    await page.locator('[data-dr="use"]').click();
    assert.equal(await page.locator('#send_textarea').inputValue(), 'My edited reply.');
    assert.equal(await page.evaluate(() => window.ctx.chat.length), 1);
});

test('placements share private state, save globally, and preserve an in-flight draft', async t => {
    const page = await fixture(t);
    await page.locator('#dr-direction').fill('Thank her.');
    await page.locator('[data-dr="generate"]').click();
    await page.locator('#dr-placement').selectOption('sidecar');
    assert.equal(await page.locator('#directed-reply-sidecar #directed-reply-panel').count(), 1);
    assert.equal(await page.evaluate(() => window.ctx.extensionSettings.directedReply.placement), 'sidecar');
    await page.evaluate(() => window.finish('*I smile.*\n\n"Thank you."'));
    await page.locator('[data-dr="use"]').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('[data-dr="use"]').disabled);
    await page.locator('#dr-placement').selectOption('workbench');
    assert.equal(await page.locator('#directed-reply-workbench').evaluate(el => el.open), true);
    assert.equal(await page.locator('#dr-direction').inputValue(), 'Thank her.');
    assert.equal(await page.locator('#dr-preview').inputValue(), '*I smile.*\n\n"Thank you."');
    await page.locator('#dr-preview').press('Escape');
    assert.equal(await page.locator('#directed-reply-workbench').evaluate(el => el.open), false);
    await page.locator('#dr-placement').selectOption('dock');
    await page.locator('#directed-reply-toggle').click();
    assert.equal(await page.locator('#send_form #directed-reply-panel').count(), 1);
    await page.locator('[data-dr="use"]').click();
    assert.equal(await page.locator('#send_textarea').inputValue(), '*I smile.*\n\n"Thank you."');
    assert.equal(await page.evaluate(() => window.calls.length), 1);
});

test('sidecar adapts to narrow screens and restores without losing the draft', async t => {
    const page = await fixture(t);
    await page.locator('#dr-placement').selectOption('sidecar');
    await generate(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector('#directed-reply-panel').dataset.placement === 'dock');
    assert.equal(await page.locator('#directed-reply-sidecar').isVisible(), false);
    assert.equal(await page.locator('#dr-preview').inputValue(), 'I glance at the door. "What key?"');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForFunction(() => document.querySelector('#directed-reply-panel').dataset.placement === 'sidecar');
    assert.equal(await page.locator('#directed-reply-sidecar').isVisible(), true);
    await page.locator('[data-dr="close"]').click();
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('dr-sidecar-open')), false);
});

test('placement is restored after reload and does not enter generation instructions', async t => {
    const page = await fixture(t);
    await page.locator('#dr-placement').selectOption('workbench');
    await page.locator('[data-dr="close"]').click();
    await page.reload();
    await page.locator('#directed-reply-toggle').click();
    assert.equal(await page.locator('#directed-reply-workbench').evaluate(el => el.open), true);
    await generate(page);
    assert.doesNotMatch(await page.evaluate(() => window.calls[0].quietPrompt), /workbench|sidecar|placement/i);
});

test('chat switch closes the workbench and clears private draft state', async t => {
    const page = await fixture(t);
    await generate(page);
    await page.locator('#dr-placement').selectOption('workbench');
    await page.evaluate(() => window.events['chat-changed']());
    assert.equal(await page.locator('#directed-reply-workbench').evaluate(el => el.open), false);
    await page.locator('#directed-reply-toggle').click();
    assert.equal(await page.locator('#dr-preview').inputValue(), '');
    assert.equal(await page.locator('#dr-direction').inputValue(), '');
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
    assert.match(prompt, /about 150 words/);
    assert.match(prompt, /First person/);
    assert.doesNotMatch(prompt, /Match the language, perspective/);
    await page.evaluate(() => window.finish('I take the cup. "Thank you."'));
    await page.waitForFunction(() => !document.querySelector('[data-dr="generate"]').disabled);
    assert.equal(await page.locator('#dr-preview').inputValue(), 'I take the cup. "Thank you."');
});

test('output language and length are independently selectable and saved', async t => {
    const page = await fixture(t);
    await page.locator('#dr-language').selectOption('ru-ru');
    await page.locator('#dr-length').selectOption('75');
    await generate(page, 'Я беру чашку.');
    const prompt = await page.evaluate(() => window.calls[0].quietPrompt);
    assert.match(prompt, /entire finished reply in Русский \(Russian\)/);
    assert.match(prompt, /about 75 words/);
    assert.equal(await page.evaluate(() => window.ctx.extensionSettings.directedReply.language), 'ru-ru');
    assert.equal(await page.evaluate(() => window.ctx.extensionSettings.directedReply.words), 75);
    assert.equal(await page.evaluate(() => window.settingsSaved), true);
    await page.locator('#dr-language').selectOption('chat');
    await page.locator('[data-dr="generate"]').click();
    assert.match(await page.evaluate(() => window.calls[1].quietPrompt), /not the language of these directions/);
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
    await page.locator('summary').click();
    await page.locator('#dr-thoughts').selectOption('include');
    await page.locator('#dr-thought-format').selectOption('fenced');
    const markdown = '*I rub my eyes, then offer a hesitant smile.*\n\n```\nAm I really safe here?\n```\n\n"Thank you for helping me."';
    await generate(page, '<|channel>thought\nFollow the requested format.\n<channel|>' + markdown);
    const prompt = await page.evaluate(() => window.calls[0].quietPrompt);
    assert.match(prompt, /Wrap action narration in single asterisks/);

    assert.doesNotMatch(prompt, /without asterisks/);
    assert.equal(await page.locator('#dr-preview').inputValue(), markdown);
    const edited = markdown.replace('hesitant smile', 'grateful smile');
    await page.locator('#dr-preview').fill(edited);
    await page.locator('[data-dr="use"]').click();
    assert.equal(await page.locator('#send_textarea').inputValue(), edited);
    assert.equal(await page.evaluate(() => window.ctx.chat.length), 1);
});

test('the draft icon stays immediately after the magic wand, including late creation', async t => {
    const page = await fixture(t);
    assert.equal(await page.locator('#extensionsMenuButton').evaluate(el => el.nextElementSibling.id), 'directed-reply-toggle');
    await page.evaluate(() => {
        document.querySelector('#extensionsMenuButton').remove();
        const wand = document.createElement('div');
        wand.id = 'extensionsMenuButton';
        wand.style.order = '4';
        document.querySelector('#leftSendForm').append(wand);
    });
    await page.waitForFunction(() => document.querySelector('#extensionsMenuButton').nextElementSibling?.id === 'directed-reply-toggle');
    assert.equal(await page.locator('#directed-reply-toggle').evaluate(el => getComputedStyle(el).order), '4');
});

test('language choices mirror the host and custom word counts reach the prompt', async t => {
    const page = await fixture(t);
    const host = await page.locator('#ui_language_select option').evaluateAll(options => options.map(x => x.value).filter(Boolean));
    const own = await page.locator('#dr-language option').evaluateAll(options => options.map(x => x.value));
    for (const language of host) assert.ok(own.includes(language));
    await page.locator('#dr-language').selectOption('ja-jp');
    await page.locator('#dr-length').selectOption('custom');
    await page.locator('#dr-custom-words').fill('173');
    await generate(page, 'A reply.');
    const prompt = await page.evaluate(() => window.calls[0].quietPrompt);
    assert.match(prompt, /日本語 \(Japanese\)/);
    assert.match(prompt, /about 173 words/);
    assert.equal(await page.evaluate(() => window.ctx.extensionSettings.directedReply.words), 173);
});

test('content controls reject empty output modes and keep thought format disabled when off', async t => {
    const page = await fixture(t);
    await page.locator('summary').click();
    assert.equal(await page.locator('#dr-thought-format').isDisabled(), true);
    await page.locator('[data-dr="actions"]').uncheck();
    await page.locator('[data-dr="dialogue"]').uncheck();
    await page.locator('#dr-direction').fill('Wait.');
    await page.locator('[data-dr="generate"]').click();
    assert.match(await page.locator('[data-dr="status"]').textContent(), /Allow actions/);
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    await page.locator('#dr-thoughts').selectOption('include');
    assert.equal(await page.locator('#dr-thought-format').isDisabled(), false);
    await page.locator('[data-dr="generate"]').click();
    assert.match(await page.evaluate(() => window.calls[0].quietPrompt), /Do not include spoken dialogue/);
    assert.equal(await page.locator('#dr-thoughts').isDisabled(), true);
    await page.evaluate(() => window.finish('`I should wait.`'));
    await page.waitForFunction(() => !document.querySelector('[data-dr="generate"]').disabled);
});

test('repeated requests contain one current brief, no previous previews, and no extra chat messages', async t => {
    const page = await fixture(t);
    for (let i = 0; i < 8; i++) await generate(page, `PREVIEW_NOT_SENT_${i}`);
    const calls = await page.evaluate(() => window.calls);
    assert.equal(calls.length, 8);
    for (const call of calls) {
        assert.equal(call.quietPrompt, calls[0].quietPrompt);
        assert.equal(call.quietPrompt.split('PLAYER DIRECTION:').length - 1, 1);
        assert.doesNotMatch(call.quietPrompt, /PREVIEW_NOT_SENT/);
    }
    assert.equal(await page.evaluate(() => window.ctx.chat.length), 1);
    assert.equal(await page.locator('#send_textarea').inputValue(), '');
});

test('default hints are general English text with native translation attributes', async t => {
    const page = await fixture(t);
    assert.equal(await page.locator('#dr-direction').getAttribute('placeholder'), 'Describe your next action, words, or tone—in any language.');
    assert.equal(await page.locator('#dr-direction').getAttribute('data-i18n'), '[placeholder]directedReply.directionHint');
    assert.equal(await page.locator('#dr-style').getAttribute('data-i18n'), '[placeholder]directedReply.styleHint');
    assert.equal(await page.locator('#dr-preview').getAttribute('data-i18n'), '[placeholder]directedReply.previewHint');
    assert.equal(await page.locator('#dr-language').inputValue(), 'en');
});
