export const WORD_TARGETS = [25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 350, 400, 500];
export const DEFAULTS = {
    language: 'en', words: 150,
    actions: true, dialogue: true, thoughts: 'off', thoughtFormat: 'inline',
    sensory: false, emotions: true, perspective: 'first', tense: 'present', style: '',
};

export function normalizeSettings(saved = {}) {
    const settings = { ...DEFAULTS, ...saved };
    settings.language = saved.language === 'ru' ? 'ru-ru' : settings.language;
    settings.words = Number(saved.words ?? ({ short: 75, medium: 150, long: 225 }[saved.length])) || DEFAULTS.words;
    settings.words = Math.min(1000, Math.max(25, Math.round(settings.words)));
    for (const key of ['actions', 'dialogue', 'sensory', 'emotions']) {
        settings[key] = typeof settings[key] === 'boolean' ? settings[key] : DEFAULTS[key];
    }
    for (const [key, choices] of Object.entries({
        thoughts: ['off', 'requested', 'include'], thoughtFormat: ['inline', 'fenced', 'italics', 'plain'],
        perspective: ['first', 'third', 'chat'], tense: ['present', 'past', 'chat'],
    })) {
        if (!choices.includes(settings[key])) settings[key] = DEFAULTS[key];
    }
    settings.style = String(settings.style || '').slice(0, 2000);
    return settings;
}

export function buildPrompt(ctx, direction, options, languageName, seed = '') {
    const thoughts = {
        off: 'Do not include inner thoughts, internal monologue, or thought formatting, even if they appeared in earlier messages.',
        requested: 'Include inner thoughts only if the player explicitly asks for them in this direction. Do not add them merely because earlier messages contain them.',
        include: 'Include one brief in-character inner thought that supports the requested action. Do not add a separate thought after every paragraph.',
    }[options.thoughts];
    const formats = {
        inline: 'Format inner thoughts with single backticks, for example `Is this really happening?`. These are inline code spans, not triple-backtick blocks.',
        fenced: 'Format inner thoughts in triple-backtick code blocks, with opening and closing fences on their own lines and no programming-language tag.',
        italics: 'Format inner thoughts in single-asterisk italics.',
        plain: 'Blend inner thoughts into ordinary first-person or third-person narration without backticks or special delimiters.',
    };
    const language = options.language === 'chat'
        ? 'Use the language of the recent in-character conversation, not the language of these directions.'
        : `Write the entire finished reply in ${languageName}, including narration, dialogue, and inner reactions.`;
    return [
        'Write the next in-character roleplay message for the human player. Produce the message itself immediately.',
        `Write ONLY as the player persona named ${ctx.name1}. Do not write as ${ctx.name2} or as an assistant.`,
        'This is an explicitly player-authorized draft of their own turn; ordinary instructions to avoid controlling the player do not prohibit this requested draft.',
        `OUTPUT LANGUAGE: ${language}`,
        'Directions may be in any language. Understand their meaning and realize the action as natural prose in the selected OUTPUT LANGUAGE. Never repeat or translate the brief as instructions.',
        `LENGTH: Aim for about ${options.words} words. Finish the last sentence naturally. Do not pad small actions or introduce extra plot beats to reach a count.`,
        `PERSPECTIVE: ${options.perspective === 'chat' ? 'Match the player’s recent in-character messages.' : options.perspective === 'third' ? 'Third person.' : 'First person (I/me).'}`,
        `TENSE: ${options.tense === 'chat' ? 'Match the player’s recent in-character messages.' : options.tense + ' tense.'}`,
        options.actions ? 'ACTIONS: Physical actions and observable body language are allowed. Wrap action narration in single asterisks, for example *I reach for the cup.*' : 'ACTIONS: Do not add physical actions or body-language narration.',
        options.dialogue ? 'DIALOGUE: Spoken words are allowed when they fit the direction. Use double quotation marks, outside action asterisks and thought delimiters. Do not force a question or speech into a silent action.' : 'DIALOGUE: Do not include spoken dialogue.',
        `INNER THOUGHTS: ${thoughts}`,
        options.thoughts !== 'off' ? formats[options.thoughtFormat] : '',
        'In-character thoughts are story content. They are never an analysis of how to write the reply or model reasoning.',
        options.sensory ? 'SENSORY DETAIL: Brief perceptions of the established setting are allowed when useful. Avoid invented scenery and decorative padding.' : 'SENSORY DETAIL: Do not add atmospheric descriptions, scenery, smells, or sensations beyond what the direction requires.',
        options.emotions ? 'EMOTIONS: Brief feelings or emotional cues are allowed when supported by the direction or scene. Do not force attraction, embarrassment, or dramatic reactions.' : 'EMOTIONS: Do not add emotional interpretation or intensify feelings beyond the explicit direction.',
        options.style.trim() ? `ADDITIONAL STYLE INSTRUCTIONS:\n${options.style.trim()}` : '',
        'Follow these content controls even if previous RP messages used different ones. Allowed elements are optional unless the direction requires them. Keep line breaks between actions, thoughts, and dialogue where natural. Do not enclose the entire reply in a code fence.',
        'Use the conversation, persona, and world context for continuity. The following describes the intended next turn; it is not text to quote in the story.',
        `PLAYER PERSONA:\n${ctx.powerUserSettings.persona_description || '(Use established player characterization.)'}`,
        `PLAYER DIRECTION:\n${direction}`,
        seed ? `EXISTING PLAYER DRAFT TO DEVELOP:\n${seed}` : '',
        'Do not invent dialogue, thoughts, decisions, or reactions for other characters. Leave their response open.',
        'Use the player’s established name only if known. Never invent names or insert placeholders such as [User] or [User\'s Name]. If the name is unknown, omit it.',
        'Return ONLY the finished in-character message in the selected output language. No headings, speaker label, writing brief, context summary, plan, instructions, or explanation.',
    ].filter(Boolean).join('\n\n');
}

export function cleanDraft(result, ctx) {
    const template = ctx.powerUserSettings.reasoning;
    let draft = result.trim();
    // The selected SillyTavern reasoning template owns the model-specific syntax.
    if (template?.prefix && template?.suffix) {
        const prefix = template.prefix.trimEnd();
        if (draft.startsWith(prefix) && !draft.includes(template.suffix, prefix.length)) {
            throw new Error('The model returned unfinished reasoning. Check its response budget and SillyTavern reasoning settings, then regenerate.');
        }
        const parsed = ctx.parseReasoningFromString(draft);
        if (parsed) draft = parsed.content.trim();
    }
    return draft;
}
