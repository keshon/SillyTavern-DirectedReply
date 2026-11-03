export const WORD_TARGETS = [25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 350, 400, 500];
export const DEFAULTS = {
    placement: 'dock',
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
        placement: ['dock', 'sidecar', 'workbench'],
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
        off: 'Do not include inner thoughts.',
        requested: 'Include inner thoughts only if the player explicitly asks for them.',
        include: 'Include one brief in-character inner thought.',
    }[options.thoughts];
    const formats = {
        inline: 'Use single backticks for thoughts.',
        fenced: 'Use triple-backtick code blocks for thoughts, fences on separate lines, no language tag.',
        italics: 'Use single-asterisk italics for thoughts.',
        plain: 'Write thoughts as plain narration without backticks.',
    };
    const language = options.language === 'chat'
        ? 'Use the language of the recent in-character conversation, not the language of these directions.'
        : `Write the entire finished reply in ${languageName}, regardless of the direction’s language.`;
    return [
        `Draft the player-authorized next RP turn. Write ONLY as the player persona named ${ctx.name1}, using the persona and scene already in context.`,
        `OUTPUT LANGUAGE: ${language}`,
        `LENGTH: Aim for about ${options.words} words; finish naturally, without padding or new plot beats.`,
        `PERSPECTIVE: ${options.perspective === 'chat' ? 'Match the player’s recent in-character messages.' : options.perspective === 'third' ? 'Third person.' : 'First person (I/me).'}`,
        `TENSE: ${options.tense === 'chat' ? 'Match the player’s recent in-character messages.' : options.tense + ' tense.'}`,
        options.actions ? 'ACTIONS: Optional. Wrap action narration in single asterisks.' : 'ACTIONS: Do not add physical actions.',
        options.dialogue ? 'DIALOGUE: Optional. Use double quotation marks outside action/thought formatting.' : 'DIALOGUE: Do not include spoken dialogue.',
        `INNER THOUGHTS: ${thoughts}`,
        options.thoughts !== 'off' ? formats[options.thoughtFormat] : '',
        options.sensory ? 'SENSORY DETAIL: Brief established perceptions allowed.' : 'SENSORY DETAIL: Do not add atmospheric detail beyond the direction.',
        options.emotions ? 'EMOTIONS: Brief supported cues allowed; do not invent or intensify feelings.' : 'EMOTIONS: Do not add emotional interpretation.',
        options.style.trim() ? `ADDITIONAL STYLE INSTRUCTIONS:\n${options.style.trim()}` : '',
        'These controls override prior writing conventions. Keep natural line breaks. Do not fence the entire reply.',
        `PLAYER DIRECTION:\n${direction}`,
        seed ? `EXISTING PLAYER DRAFT TO DEVELOP:\n${seed}` : '',
        'Do not control other characters. Do not invent player names or placeholders.',
        'Return only the finished RP message: no labels, planning, model reasoning, translated brief, or explanation.',
    ].filter(Boolean).join('\n\n');
}

export function cleanDraft(result, ctx) {
    const template = ctx.powerUserSettings.reasoning;
    let draft = result.trim();
    // The selected SillyTavern reasoning template owns the model-specific syntax.
    if (template?.prefix && template?.suffix) {
        // Some backends emit an empty control frame without its channel label.
        // Derive its boundaries from the selected template, not a model-name table.
        const openingToken = template.prefix.match(/^<[^>\r\n]+>/)?.[0];
        if (openingToken && template.prefix !== openingToken && draft.startsWith(openingToken)) {
            const remainder = draft.slice(openingToken.length).trimStart();
            if (remainder.startsWith(template.suffix)) draft = remainder.slice(template.suffix.length).trimStart();
        }
        const prefix = template.prefix.trimEnd();
        if (draft.startsWith(prefix) && !draft.includes(template.suffix, prefix.length)) {
            throw new Error('The model returned unfinished reasoning. Check its response budget and SillyTavern reasoning settings, then regenerate.');
        }
        const parsed = ctx.parseReasoningFromString(draft);
        if (parsed) draft = parsed.content.trim();
    }
    return draft;
}
