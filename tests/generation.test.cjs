const { test } = require('node:test');
const assert = require('node:assert/strict');

const modulePromise = import('../generation.js');
const ctx = { name1: 'Player', name2: 'Character', powerUserSettings: { persona_description: '' } };

test('thoughts default off and examples never force thought output', async () => {
    const { buildPrompt, normalizeSettings } = await modulePromise;
    const options = normalizeSettings();
    const prompt = buildPrompt(ctx, 'Smile and thank her.', options, 'English');
    assert.equal(options.thoughts, 'off');
    assert.match(prompt, /Do not include inner thoughts/);
    assert.doesNotMatch(prompt, /```/);
    assert.match(prompt, /about 150 words/);
});

test('each thought mode and formatting option gives a distinct instruction', async () => {
    const { buildPrompt, normalizeSettings } = await modulePromise;
    for (const [format, expected] of Object.entries({ inline: /single backticks/, fenced: /triple-backtick code blocks/, italics: /single-asterisk italics/, plain: /without backticks/ })) {
        const prompt = buildPrompt(ctx, 'Consider the question.', normalizeSettings({ thoughts: 'include', thoughtFormat: format }), 'English');
        assert.match(prompt, expected);
        assert.match(prompt, /Include one brief in-character inner thought/);
    }
    assert.match(buildPrompt(ctx, 'Smile.', normalizeSettings({ thoughts: 'requested' }), 'English'), /only if the player explicitly asks/);
});

test('content, perspective, tense and style controls are honored in the request', async () => {
    const { buildPrompt, normalizeSettings } = await modulePromise;
    const prompt = buildPrompt(ctx, 'Wait.', normalizeSettings({ actions: false, dialogue: false, thoughts: 'include', sensory: false, emotions: false, perspective: 'third', tense: 'past', style: 'Keep it restrained.' }), 'Japanese');
    for (const rule of [/Do not add physical actions/, /Do not include spoken dialogue/, /Do not add atmospheric/, /Do not add emotional/, /Third person/, /past tense/, /Keep it restrained/, /in Japanese/]) assert.match(prompt, rule);
});

test('old preferences migrate and custom word targets stay within supported limits', async () => {
    const { normalizeSettings, WORD_TARGETS } = await modulePromise;
    assert.equal(normalizeSettings({ length: 'long', language: 'ru' }).words, 225);
    assert.equal(normalizeSettings({ language: 'ru' }).language, 'ru-ru');
    assert.equal(normalizeSettings({ words: 173 }).words, 173);
    assert.equal(normalizeSettings({ words: 5000 }).words, 1000);
    assert.equal(normalizeSettings({ words: -10 }).words, 25);
    for (const target of [50, 75, 100, 125, 150, 175, 200, 225, 250]) assert.ok(WORD_TARGETS.includes(target));
});

test('reasoning cleanup follows any selected native template and preserves RP Markdown', async () => {
    const { cleanDraft } = await modulePromise;
    const reply = '*I pause.*\n\n```\nAn in-character thought.\n```\n\n"Hello."';
    for (const [prefix, suffix] of [['<think>', '</think>'], ['<|channel>thought', '<channel|>'], ['[analysis]', '[/analysis]']]) {
        const native = {
            powerUserSettings: { reasoning: { prefix, suffix } },
            parseReasoningFromString: text => ({ content: text.slice(text.indexOf(suffix) + suffix.length) }),
        };
        assert.equal(cleanDraft(prefix + 'Private model reasoning.' + suffix + reply, native), reply);
        assert.throws(() => cleanDraft(prefix + 'unfinished', native), /unfinished reasoning/);
    }
    assert.equal(cleanDraft(reply, { powerUserSettings: {} }), reply);
});
