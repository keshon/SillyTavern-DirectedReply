import { isGenerating } from '../../../../script.js';

const context = () => SillyTavern.getContext();
const LENGTHS = {
    short: '60–100 words',
    medium: '100–180 words',
    long: '180–260 words',
};

function chatSnapshot() {
    const ctx = context();
    return JSON.stringify([
        ctx.groupId, ctx.groupId ? null : ctx.characterId, ctx.chatId, ctx.name1,
        ctx.powerUserSettings.persona_description,
        ctx.chat.map(({ name, is_user, is_system, mes }) => [name, is_user, is_system, mes]),
    ]);
}

function buildPrompt(direction, length, language, seed) {
    const ctx = context();
    const outputLanguage = language === 'chat'
        ? 'Use the language of the recent in-character conversation. Do not infer it from the language of the directions.'
        : `Write the entire finished reply in ${language === 'ru' ? 'Russian' : 'English'}, including narration, dialogue, and inner reactions.`;
    return [
        'Write the next in-character roleplay message for the human player. Produce the message itself immediately.',
        `Write ONLY as the player persona named ${ctx.name1}. Do not write as ${ctx.name2} or as an assistant.`,
        'OUTPUT LANGUAGE: ' + outputLanguage,
        'The player may give directions in Russian, English, or another language. Understand their meaning and realize it as natural prose in the selected OUTPUT LANGUAGE. Do not translate or repeat the directions as a list, and do not explain the translation.',
        'STYLE: First-person, present-tense roleplay. Blend concrete actions, small sensory details, and brief inner reactions into flowing prose.',
        'FORMATTING: Wrap actions, physical reactions, and sensory narration in single asterisks: *I reach for the cup.* Put in-character inner thoughts in plain triple-backtick fenced blocks on separate lines, without a programming-language tag. Write spoken dialogue in double quotation marks, outside the action asterisks and thought blocks. Preserve line breaks between these elements. Do not wrap the entire reply in a code fence or add section headings.',
        'In-character thoughts are part of the story, not planning or model reasoning. Include a brief thought only when it fits the scene; do not fill the reply with an analysis of the writing instructions.',
        'Let the scene determine the emotion. Do not add embarrassment, attraction, dramatic reactions, questions, or extra plot beats unless the direction or established context supports them. If the player requests only an action, dialogue is optional.',
        `LENGTH: approximately ${LENGTHS[length] || LENGTHS.medium}. Use natural paragraphs, not a fixed paragraph count. For a small action, stay near the lower end instead of padding it out.`,
        'Example of the desired English prose and formatting (illustration only; do not copy its names, events, or dialogue into this scene):\n*I accept the cup with both hands, smiling at Nao.*\n"Thank you. That smells wonderful."\n*The warmth settles into my fingers. I take a careful sip, and a small, pleased sound escapes before I can help it.*\n```\nSo much for trying to look composed.\n```\n"That is really good. What blend is it?"\n*I lower the cup, still enjoying the fragrant steam as I wait for her answer.*\nEnd of style example. If another output language is selected, use that language instead.',
        'Use the actual conversation and world context for continuity. Treat the following as writing instructions, never as text to include in the reply.',
        `Player persona description:\n${ctx.powerUserSettings.persona_description || '(Use the established player characterization.)'}`,
        `What the player wants to do or say:\n${direction}`,
        seed ? `Existing player draft to develop while following the direction:\n${seed}` : '',
        'Expand the intended action into concrete dialogue, actions, and sensory details without adding major decisions or changing the player’s intent.',
        'Do not invent dialogue, thoughts, decisions, or reactions for other characters. Leave their response open.',
        'Use the player’s established name only if it is known from the persona or conversation. Never invent a name or insert placeholders such as [User\'s Name]; if the name is unknown, omit it and let the player add it.',
        'Begin directly with the player’s first-person action or spoken words. Return ONLY the finished in-character message in the selected output language. Do not output a writing brief, context summary, character profile, plan, analysis, section labels, speaker label, introduction, or quotation marks around the entire message.',
    ].filter(Boolean).join('\n\n');
}

function cleanDraft(result) {
    // Gemma 4 can return channel-delimited reasoning even with thinking disabled.
    // Remove only explicitly delimited thought blocks; never guess at prose boundaries.
    const draft = result.replace(/<\|channel>thought\b[\s\S]*?<channel\|>/g, '').trim();
    if (draft.includes('<|channel>thought')) {
        throw new Error('The model returned unfinished reasoning instead of a finished reply. Try regenerating.');
    }
    return draft;
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
    anchor.append(toggle);

    const panel = document.createElement('section');
    panel.id = 'directed-reply-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Directed Reply');
    panel.innerHTML = `
        <div class="dr-heading"><strong>Draft your reply</strong><button type="button" class="menu_button" data-dr="close" aria-label="Close draft panel">✕</button></div>
        <label for="dr-direction">What do you want to do or say?</label>
        <textarea id="dr-direction" class="text_pole" rows="3" placeholder="Можно по-русски: беру чашку, благодарю за чай, пробую и спрашиваю, что это за сорт."></textarea>
        <div class="dr-options">
            <label for="dr-language">Draft language <select id="dr-language" class="text_pole"><option value="en">English</option><option value="ru">Русский</option><option value="chat">Match conversation</option></select></label>
            <label for="dr-length">Length <select id="dr-length" class="text_pole"><option value="short">Short · 60–100 words</option><option value="medium" selected>Medium · 100–180 words</option><option value="long">Long · 180–260 words</option></select></label>
            <label><input type="checkbox" data-dr="seed"> Develop text already in the chat input</label>
        </div>
        <div class="dr-actions"><button type="button" class="menu_button" data-dr="generate">Generate draft</button><button type="button" class="menu_button" data-dr="stop" hidden>Stop</button></div>
        <p data-dr="status" role="status" aria-live="polite">Private directions and previews stay outside the chat. Ctrl+Enter generates a draft.</p>
        <label for="dr-preview">Your draft · edit before using</label>
        <p class="dr-hint">Markdown is kept: *actions*, triple-backtick thought blocks, and "dialogue".</p>
        <textarea id="dr-preview" class="text_pole" rows="6" placeholder="Your generated reply will appear here."></textarea>
        <div class="dr-actions"><button type="button" class="menu_button" data-dr="use" disabled>Use draft</button><span class="dr-hint">Places the draft in the chat input for you to send.</span></div>
        <div data-dr="replace" hidden><p>Your chat input already contains text. Replace it with this draft?</p><div class="dr-actions"><button type="button" class="menu_button" data-dr="confirm">Replace input</button><button type="button" class="menu_button" data-dr="keep">Keep existing input</button></div></div>
    `;
    sendForm.prepend(panel);

    const find = name => panel.querySelector(`[data-dr="${name}"]`);
    const direction = panel.querySelector('#dr-direction');
    const length = panel.querySelector('#dr-length');
    const language = panel.querySelector('#dr-language');
    const preview = panel.querySelector('#dr-preview');
    const settings = context().extensionSettings.directedReply ||= {};
    if (Object.hasOwn(LENGTHS, settings.length)) length.value = settings.length;
    if (['en', 'ru', 'chat'].includes(settings.language)) language.value = settings.language;
    for (const select of [length, language]) {
        select.addEventListener('change', () => {
            settings.length = length.value;
            settings.language = language.value;
            context().saveSettingsDebounced();
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
        const active = { session, snapshot: chatSnapshot(), cancelled: false };
        request = active;
        find('replace').hidden = true;
        render();
        status('Writing your reply…');
        try {
            const result = await ctx.generateQuietPrompt({
                quietPrompt: buildPrompt(direction.value.trim(), length.value, language.value, find('seed').checked ? composer.value : ''),
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
            const draft = cleanDraft(result);
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
