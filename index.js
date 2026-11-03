import { isGenerating } from '../../../../script.js';
import { buildPrompt, cleanDraft, DEFAULTS, normalizeSettings, WORD_TARGETS } from './generation.js';

const context = () => SillyTavern.getContext();
function chatSnapshot() {
    const ctx = context();
    return JSON.stringify([
        ctx.groupId, ctx.groupId ? null : ctx.characterId, ctx.chatId, ctx.name1,
        ctx.powerUserSettings.persona_description,
        ctx.chat.map(({ name, is_user, is_system, mes }) => [name, is_user, is_system, mes]),
    ]);
}

function initialize() {
    if (document.querySelector('#directed-reply-toggle')) return;
    const anchor = document.querySelector('#leftSendForm');
    const composer = document.querySelector('#send_textarea');
    const sendForm = document.querySelector('#send_form');
    if (!anchor || !composer || !sendForm) return;

    const toggle = document.createElement('button');
    toggle.id = 'directed-reply-toggle';
    toggle.type = 'button';
    toggle.className = 'menu_button fa-solid fa-pen-nib';
    toggle.title = 'Draft your reply with AI';
    toggle.setAttribute('aria-label', 'Draft your reply with AI');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'directed-reply-panel');
    function placeToggle() {
        const wand = document.querySelector('#extensionsMenuButton');
        if (wand) {
            // Match the host's flex order; DOM adjacency alone can still render first.
            toggle.style.order = getComputedStyle(wand).order;
            if (wand.nextElementSibling !== toggle) wand.after(toggle);
        } else if (toggle.parentElement !== anchor) {
            anchor.append(toggle);
        }
    }
    placeToggle();
    // The built-in extensions button may be created after third-party scripts load.
    const placementObserver = new MutationObserver(placeToggle);
    placementObserver.observe(anchor, { childList: true });

    const panel = document.createElement('section');
    panel.id = 'directed-reply-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Directed Reply');
    panel.innerHTML = `
        <div class="dr-heading"><strong>Draft your reply</strong><button type="button" class="menu_button" data-dr="close" aria-label="Close draft panel">✕</button></div>
        <label for="dr-direction">What do you want to do or say?</label>
        <textarea id="dr-direction" class="text_pole" rows="3" placeholder="Describe your next action, words, or tone—in any language." data-i18n="[placeholder]directedReply.directionHint"></textarea>
        <div class="dr-options">
            <label for="dr-language">Draft language <select id="dr-language" class="text_pole"><option value="en">English</option><option value="ru-ru">Русский</option><option value="chat">Match conversation</option></select></label>
            <label for="dr-length">Word target <select id="dr-length" class="text_pole"></select></label>
            <label data-dr="custom-words" hidden for="dr-custom-words">Words <input id="dr-custom-words" type="number" min="25" max="1000" step="1" class="text_pole" value="150"></label>
            <label><input type="checkbox" data-dr="seed"> Develop text already in the chat input</label>
        </div>
        <details class="dr-writing"><summary>Writing controls</summary>
            <div class="dr-options dr-content">
                <label><input type="checkbox" data-dr="actions"> Actions / body language</label>
                <label><input type="checkbox" data-dr="dialogue"> Spoken dialogue</label>
                <label><input type="checkbox" data-dr="sensory"> Sensory / setting detail</label>
                <label><input type="checkbox" data-dr="emotions"> Emotional reactions</label>
            </div>
            <div class="dr-options">
                <label for="dr-thoughts">Inner thoughts <select id="dr-thoughts"><option value="off">Off</option><option value="requested">Only when requested</option><option value="include">Include a brief thought</option></select></label>
                <label for="dr-thought-format">Thought format <select id="dr-thought-format"><option value="inline">Single backticks (inline code)</option><option value="fenced">Triple backticks (code block)</option><option value="italics">Italics</option><option value="plain">Plain narration</option></select></label>
                <label for="dr-perspective">Perspective <select id="dr-perspective"><option value="first">First person</option><option value="third">Third person</option><option value="chat">Match player</option></select></label>
                <label for="dr-tense">Tense <select id="dr-tense"><option value="present">Present</option><option value="past">Past</option><option value="chat">Match player</option></select></label>
            </div>
            <label for="dr-style">Additional style instructions</label>
            <textarea id="dr-style" class="text_pole" rows="2" maxlength="2000" placeholder="Optional tone, style, or details to avoid." data-i18n="[placeholder]directedReply.styleHint"></textarea>
            <p>Inner thoughts belong to your character. Model reasoning is handled by SillyTavern’s reasoning settings. Backticks are a display convention, not a universal RP syntax.</p>
        </details>
        <div class="dr-actions"><button type="button" class="menu_button" data-dr="generate">Generate draft</button><button type="button" class="menu_button" data-dr="stop" hidden>Stop</button></div>
        <p data-dr="status" role="status" aria-live="polite">Private directions and previews stay outside the chat. Ctrl+Enter generates a draft.</p>
        <label for="dr-preview">Your draft · edit before using</label>
        <p class="dr-hint">Markdown and line breaks are kept. Actions use *asterisks*, dialogue uses "quotes", and thoughts follow your selected format.</p>
        <textarea id="dr-preview" class="text_pole" rows="6" placeholder="Your draft will appear here. Edit it before using it." data-i18n="[placeholder]directedReply.previewHint"></textarea>
        <div class="dr-actions"><button type="button" class="menu_button" data-dr="use" disabled>Use draft</button><span class="dr-hint">Places the draft in the chat input for you to send.</span></div>
        <div data-dr="replace" hidden><p>Your chat input already contains text. Replace it with this draft?</p><div class="dr-actions"><button type="button" class="menu_button" data-dr="confirm">Replace input</button><button type="button" class="menu_button" data-dr="keep">Keep existing input</button></div></div>
    `;
    sendForm.prepend(panel);

    const find = name => panel.querySelector(`[data-dr="${name}"]`);
    const direction = panel.querySelector('#dr-direction');
    const length = panel.querySelector('#dr-length');
    const language = panel.querySelector('#dr-language');
    const preview = panel.querySelector('#dr-preview');
    const settings = normalizeSettings(context().extensionSettings.directedReply);
    context().extensionSettings.directedReply = settings;
    const customWords = panel.querySelector('#dr-custom-words');
    const controls = {
        thoughts: panel.querySelector('#dr-thoughts'), thoughtFormat: panel.querySelector('#dr-thought-format'),
        perspective: panel.querySelector('#dr-perspective'), tense: panel.querySelector('#dr-tense'),
        style: panel.querySelector('#dr-style'),
        actions: find('actions'), dialogue: find('dialogue'), sensory: find('sensory'), emotions: find('emotions'),
    };
    for (const words of WORD_TARGETS) length.add(new Option(`About ${words} words`, String(words)));
    length.add(new Option('Custom…', 'custom'));
    length.value = WORD_TARGETS.includes(settings.words) ? String(settings.words) : 'custom';
    customWords.value = String(settings.words);
    // Use the same live language options as SillyTavern, including future additions.
    const languages = new Map([['en', 'English']]);
    for (const option of document.querySelectorAll('#ui_language_select option')) {
        if (option.value) languages.set(option.value, option.textContent.trim());
    }
    language.replaceChildren(new Option('Match conversation', 'chat'));
    for (const [code, name] of languages) language.add(new Option(name, code));
    language.value = languages.has(settings.language) || settings.language === 'chat' ? settings.language : DEFAULTS.language;
    settings.language = language.value;
    for (const [key, control] of Object.entries(controls)) {
        if (control.type === 'checkbox') control.checked = settings[key];
        else control.value = settings[key];
    }
    function readOptions() {
        const options = { ...settings, language: language.value, words: Number(length.value === 'custom' ? customWords.value : length.value) };
        for (const [key, control] of Object.entries(controls)) options[key] = control.type === 'checkbox' ? control.checked : control.value;
        return options;
    }
    function updateControlState() {
        find('custom-words').hidden = length.value !== 'custom';
        controls.thoughtFormat.disabled = Boolean(request) || controls.thoughts.value === 'off';
    }
    for (const control of [length, customWords, language, ...Object.values(controls)]) {
        control.addEventListener('change', () => {
            Object.assign(settings, normalizeSettings(readOptions()));
            context().saveSettingsDebounced();
            updateControlState();
        });
    }
    let request = null;
    let draftSnapshot = null;
    let session = 0;
    let replacementInput = null;

    function status(message) {
        find('status').textContent = message;
    }

    function render() {
        const busy = Boolean(request);
        find('generate').disabled = busy;
        find('generate').textContent = preview.value.trim() ? 'Regenerate draft' : 'Generate draft';
        find('stop').hidden = !busy;
        find('stop').disabled = Boolean(request?.cancelled);
        find('use').disabled = busy || !draftSnapshot || !preview.value.trim();
        direction.disabled = busy;
        length.disabled = busy;
        language.disabled = busy;
        customWords.disabled = busy;
        for (const control of Object.values(controls)) control.disabled = busy;
        updateControlState();
        find('seed').disabled = busy;
        preview.disabled = busy;
        panel.setAttribute('aria-busy', String(busy));
    }

    function setOpen(open) {
        panel.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        if (open) direction.focus();
    }

    function cancel() {
        if (!request || request.cancelled) return;
        request.cancelled = true;
        context().stopGeneration();
        status('Stopping generation…');
        render();
    }

    async function generate() {
        if (request) return;
        const ctx = context();
        if (!ctx.chatId || (!ctx.groupId && ctx.characterId == null)) {
            status('Open a character or group chat first.');
            return;
        }
        if (ctx.onlineStatus === 'no_connection') {
            status('Connect to a model in SillyTavern first.');
            return;
        }
        if (isGenerating()) {
            status('Wait for the current generation to finish.');
            return;
        }
        if (!direction.value.trim()) {
            status('Describe what you want your character to do or say.');
            direction.focus();
            return;
        }
        const options = readOptions();
        if (!Number.isInteger(options.words) || options.words < 25 || options.words > 1000) {
            status('Choose a word target from 25 to 1000.');
            customWords.focus();
            return;
        }
        if (!options.actions && !options.dialogue && options.thoughts === 'off') {
            status('Allow actions, dialogue, or inner thoughts before generating.');
            return;
        }
        const active = { session, snapshot: chatSnapshot(), cancelled: false };
        request = active;
        find('replace').hidden = true;
        render();
        status('Writing your reply…');
        try {
            const result = await ctx.generateQuietPrompt({
                quietPrompt: buildPrompt(ctx, direction.value.trim(), options, languages.get(language.value), find('seed').checked ? composer.value : ''),
                quietToLoud: false,
                skipWIAN: false,
            });
            if (active.session !== session) return;
            if (active.cancelled) {
                status('Generation stopped. Your previous draft is preserved.');
                return;
            }
            if (active.snapshot !== chatSnapshot()) {
                status('The conversation changed during generation. Generate a new draft for the current scene.');
                return;
            }
            if (typeof result !== 'string' || !result.trim()) {
                status('No draft returned. Check the connection or model response and try again.');
                return;
            }
            const draft = cleanDraft(result, ctx);
            if (!draft) {
                status('The model returned reasoning without a finished reply. Your previous draft is preserved; try regenerating.');
                return;
            }
            if (/^\s*(?:#{1,6}\s*)?\[?(?:PRIVATE[ _]WRITING[ _]BRIEF|PLAYER[ _]CHARACTER|WRITING[ _]BRIEF)\b/i.test(draft)) {
                status('The model returned planning notes instead of a reply. Your previous draft is preserved; try regenerating.');
                return;
            }
            preview.value = draft;
            draftSnapshot = active.snapshot;
            status('Review or edit your draft, then use it when ready.');
        } catch (error) {
            if (active.session === session) {
                status(active.cancelled ? 'Generation stopped. Your previous draft is preserved.' : `Could not generate a draft: ${error.message || error}`);
            }
        } finally {
            if (request === active) request = null;
            render();
        }
    }

    function applyDraft(replace = false) {
        if (request || !draftSnapshot || !preview.value.trim()) return;
        if (draftSnapshot !== chatSnapshot()) {
            find('replace').hidden = true;
            status('The conversation or persona changed. Generate a fresh draft before using it.');
            return;
        }
        if (isGenerating()) {
            status('Wait for the current generation to finish before using the draft.');
            return;
        }
        if (composer.value.trim() && composer.value !== preview.value.trim()) {
            if (!replace || composer.value !== replacementInput) {
                replacementInput = composer.value;
                find('replace').hidden = false;
                return;
            }
        }
        composer.value = preview.value.trim();
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        find('replace').hidden = true;
        setOpen(false);
        status('Draft placed in the chat input.');
        composer.focus();
    }

    toggle.addEventListener('click', () => setOpen(panel.hidden));
    find('close').addEventListener('click', () => setOpen(false));
    find('generate').addEventListener('click', generate);
    find('stop').addEventListener('click', cancel);
    find('use').addEventListener('click', () => applyDraft());
    find('confirm').addEventListener('click', () => applyDraft(true));
    find('keep').addEventListener('click', () => { find('replace').hidden = true; });
    preview.addEventListener('input', () => {
        find('replace').hidden = true;
        render();
    });
    direction.addEventListener('keydown', event => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            generate();
        }
    });
    panel.addEventListener('keydown', event => {
        // Keep typing and Enter inside this panel away from chat hotkeys.
        event.stopPropagation();
        if (event.key === 'Escape') setOpen(false);
    });

    const ctx = context();
    ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, () => {
        session++;
        cancel();
        direction.value = '';
        preview.value = '';
        draftSnapshot = null;
        find('replace').hidden = true;
        setOpen(false);
        status('Describe your next move to draft a reply.');
        render();
    });
    render();
}

$(initialize);
