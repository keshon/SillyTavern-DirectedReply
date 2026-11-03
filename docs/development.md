# Development

[← Directed Reply](../README.md)

Clone this repository into SillyTavern’s `public/scripts/extensions/third-party/SillyTavern-DirectedReply` directory for local development. Keep chats, credentials, SillyTavern settings, and model files outside this repository.


### Context and performance

Each draft builds one request-local instruction string. The extension does not register persistent prompt injections, append directions or rejected previews to the chat, or store previous briefs for reuse. Only the selected writing settings enter the brief; language and length option lists stay in the UI. SillyTavern supplies chat, persona, character data, and active lore through its normal prompt builder. The extension does not repeat the persona description in its brief.

This does not make a draft an isolated small-context request: World Info and Author's Note remain enabled. Recursive lore activation, long history, model reasoning, output length, and backend prompt-cache reuse can all affect latency. The browser's chat snapshots are local stale-draft checks, not extra text sent to the model. Clearing the backend's KV cache is not injection cleanup and can require more prompt processing.

The context audit reduced a synthetic default brief from 545 to 228 tokens using the development backend's tokenizer with special tokens disabled. These counts exclude the rest of the SillyTavern request and vary by tokenizer, direction, and style instructions. This is a measured input-size reduction, not a measured end-to-end speedup. Previous draft previews and unsent composer text are not included in the extension's brief.

To inspect brief size without generating a reply, run `npm run audit:prompt`. For a comparison against an earlier commit and exact counts from a compatible tokenizer, use:

```sh
npm run audit:prompt -- --compare-ref f72cab2 --tokenizer-url http://127.0.0.1:5001/api/extra/tokencount
```

The optional URL must be a tokenizer endpoint accepting `{ "prompt": "..." }` and returning a numeric `value` or `count`. The script uses synthetic text and makes no generation requests. It does not tokenize or transmit private chats. No extra tokenizer request is made in the normal drafting workflow. Tests guard the default instruction size and verify repeated requests contain one current brief with no previous previews or extra chat messages.

For timing investigations, compare backend prompt-processing time, output-generation time, and token counts across controlled runs of the same chat. One slow request does not establish a leak. See [KoboldCpp's prompt-cache documentation](https://github.com/LostRuins/koboldcpp/wiki#what-is-contextshift).

The extension uses the current SillyTavern model connection, prompt builder, context, and reasoning parser. It does not choose a model, change global templates, or embed a model-specific chat format or reasoning delimiter.

For an instruct model connected through Text Completion, enable Instruct Mode and choose templates matching that model. Chat Completion connections use their own prompt builder. Configure **AI Response Formatting → Reasoning → Auto-Parse** and the correct reasoning template when your model returns reasoning in the text. This native setting handles normal character responses too. The extension uses the same selected reasoning format to remove complete model-reasoning blocks and rejects unfinished ones while retaining the previous preview; it preserves in-character thought Markdown.

When switching models, review both chat/instruct formatting and reasoning formatting. A truncated response or a backend's reasoning-budget warning is a generation-budget issue, not an in-character thought, and formatting cleanup cannot recover missing prose. For the Gemma 4 model used during development, the matching chat/context and reasoning presets are named Gemma 4; those names are configuration examples, not extension requirements.

Run `npm install`, `npx playwright install chromium`, and `npm test` inside this extension folder. Alternatively, set `CHROME_PATH` to an installed Chrome executable before running the tests. These browser tests simulate model responses to check preview acceptance, replacement protection, cancellation, chat changes, failures, and private generation; they do not assess model writing quality.


## Saved-setting compatibility

Legacy Short/Medium/Long targets migrate to 75/150/225 words. The early manually copied `directed-reply` folder and the GitHub installation share the same `directedReply` settings key. Remove the manual copy before installing from GitHub to avoid duplicate buttons.
