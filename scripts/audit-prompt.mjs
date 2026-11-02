import { execFileSync } from 'node:child_process';
import { buildPrompt, normalizeSettings } from '../generation.js';

const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const compareRef = option('--compare-ref');
const tokenizerUrl = option('--tokenizer-url');
let previous;
if (compareRef) {
    const source = execFileSync('git', ['show', `${compareRef}:generation.js`], { encoding: 'utf8' });
    previous = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

const base = { name1: 'Player', name2: 'Character', powerUserSettings: { persona_description: '' } };
const cases = [
    { name: 'Default', options: {}, persona: '', direction: 'Smile and thank her.' },
    { name: 'Thoughts enabled', options: { thoughts: 'include', thoughtFormat: 'fenced' }, persona: '', direction: 'Smile and thank her.' },
    { name: 'Long persona', options: {}, persona: 'A reserved traveler who values honesty. '.repeat(100), direction: 'Smile and thank her.' },
];
const rows = [];
for (const sample of cases) {
    const ctx = { ...base, powerUserSettings: { persona_description: sample.persona } };
    for (const [version, module] of [['before', previous], ['current', { buildPrompt, normalizeSettings }]]) {
        if (!module) continue;
        const prompt = module.buildPrompt(ctx, sample.direction, module.normalizeSettings(sample.options), 'English');
        const row = { sample: sample.name, version, characters: prompt.length };
        if (tokenizerUrl) {
            const result = await fetch(tokenizerUrl, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, special: false }), signal: AbortSignal.timeout(15000),
            });
            if (!result.ok) throw new Error(`Tokenizer returned HTTP ${result.status}`);
            const data = await result.json();
            row.tokens = data.value ?? data.count;
            if (!Number.isFinite(row.tokens)) throw new Error('Tokenizer must return a numeric value or count');
        }
        rows.push(row);
    }
}
console.log(JSON.stringify({
    scope: 'Extension brief only, not the full SillyTavern request. Synthetic inputs; tokenizer calls do not generate replies.',
    tokenizerUrl: tokenizerUrl || null, rows,
}, null, 2));
