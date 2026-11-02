# Directed Reply

Draft your own roleplay reply from a short direction. Uses SillyTavern's current API connection and background generation, including the conversation, character context, World Info, and Author's Note as allowed by your existing configuration. Each generation uses your model connection and its normal costs.

## Use

1. Refresh SillyTavern after installing the extension. Open a chat and connect a model.
2. Click the pen nib immediately after the magic-wand menu beside the chat input.
3. Describe your intended action, dialogue, tone, or constraints in Russian, English, or another language. Choose the **Draft language** separately. The list mirrors SillyTavern’s UI languages, plus English (default) and Match conversation. Match conversation uses the language of the RP rather than your directions.
4. Click **Generate draft** or press Ctrl+Enter (Cmd+Enter on macOS).
5. Edit the preview or regenerate it. **Develop text already in the chat input** optionally includes your existing composer text as a starting draft.
6. Click **Use draft** to put the preview in the normal composer, then send it yourself. Existing composer text requires an explicit replacement click.

**Stop** discards the pending result and preserves your previous preview. Closing the panel preserves the current draft during this page session; changing chats clears it and cancels a pending request. Reloading the page clears private directions and previews.

## Writing controls

Actions and spoken dialogue are enabled by default. **Inner thoughts are off by default**, including when the previous conversation contains thoughts. Open **Writing controls** to choose:

- Actions and body language, using single-asterisk italics.
- Spoken dialogue, using double quotation marks.
- Inner thoughts: Off, Only when requested, or Include a brief thought.
- Thought format: single backticks (inline code), triple backticks (code block), italics, or plain narration.
- Sensory/setting detail and emotional reactions, independently.
- First or third person, present or past tense, or matching the player's recent messages.
- Additional style instructions, such as restraint, comedy, or avoiding new questions.

Backticks are Markdown presentation conventions, not a universal roleplay syntax. Triple backticks create a code block; single backticks create inline code. Neither means model reasoning. The selected convention applies only to your character's inner voice.

The preview is a plain-text Markdown editor. **Use draft** preserves its Markdown characters and internal line breaks. A model can disregard a writing control; review the preview before accepting it. Actions, dialogue, and thoughts are output forms, while tone, sensory detail, emotion, perspective, and tense shape their content. At least one output form must be allowed.

## Word targets and language

Choose individual targets from 25 to 500 words, with 25-word steps through 300, or **Custom** for any integer from 25 to 1000. The target is approximate; the model should finish naturally instead of padding the scene. SillyTavern's response-token limit can still truncate a long draft.

Writing controls, word target, style instructions, and output language are saved in your SillyTavern settings. Existing Short/Medium/Long settings migrate to 75/150/225 words. Directions and draft previews remain temporary. Word counts are less directly comparable for languages without space-separated words.

For example, with **English** selected, directions such as `Беру чашку, благодарю за чай, пробую и спрашиваю, что это за сорт` request an English in-character reply. The extension supplies the selected content and formatting rules and rejects responses that begin with recognized writing-brief headings. This catches the known planning-note failure; it cannot guarantee every model response follows the requested format or language.

Directions and previews are sent to the configured model for generation but are not added as chat messages by this extension. Presets and other extensions can still affect background generation. The model may occasionally write for the wrong speaker or disregard length; review the preview before using it.

## Installation

Requires **SillyTavern 1.19.0 or later** and a working model connection.

1. Open **Extensions → Install extension** in SillyTavern.
2. Paste `https://github.com/keshon/SillyTavern-DirectedReply`.
3. Choose the desired installation scope and install, then reload SillyTavern.

The repository root contains the manifest and runtime files. Installation needs no build step, npm dependencies, server plugin, or separate API key. Both current-user and all-users installation paths are supported. Update or uninstall through SillyTavern's extension manager.

If you used the early manually copied `directed-reply` folder, remove that old copy before installing from GitHub to avoid loading two copies. Saved preferences use the same settings key.

For local development, clone this repository directly into SillyTavern's `public/scripts/extensions/third-party/SillyTavern-DirectedReply` folder. Keep private chats, API keys, SillyTavern settings, and model files outside this repository.

## First-time setup: check these settings

1. **Connect a model.** Open **API Connections** (plug icon), choose the connection type and backend, enter the backend URL or credentials, and connect. Check that the model is shown as connected. Directed Reply uses this connection; it has no separate model or API key.

2. **Check whether you use Text Completion or Chat Completion.** The required formatting setup differs:
   - **Text Completion** (for example, a KoboldCpp connection): open **AI Response Formatting** (A icon). For an instruction-following model, enable **Instruct Mode** using the power button beside Instruct Template. Select the model's matching **Instruct Template** and **Context Template**. Follow the model author's instructions; the template is determined by the model, not just the backend name. For example, the Gemma 4 model used during development needs Gemma 4 templates. Do not apply that template to an unrelated model. Automatic template detection can help, but verify the selected names when you change models.
   - **Chat Completion**: use your connection's normal chat preset and Prompt Manager. SillyTavern's Text Completion Instruct Mode is not needed for this connection type.

3. **Check reasoning parsing if the model returns reasoning in its text.** Open **AI Response Formatting → Reasoning**, expand **Reasoning Formatting**, and select the reasoning template that matches your model's actual output delimiters. Enable **Auto-Parse**. The Prefix and Suffix must both be correct. For example, a model emitting Gemma 4 thought-channel markers needs the Gemma 4 reasoning preset; a model using another syntax needs its own matching preset. Auto-Expand can remain off if you prefer model reasoning collapsed. These are native SillyTavern settings and also affect normal character replies. In-character thought backticks in Directed Reply are a separate writing preference.

4. **Set your player persona.** Open **Persona Management** and give the active persona a real name and a short description if you want the draft to use them. A default name such as User, or a placeholder already present in the conversation, gives the model less reliable identity information. Review the character card, World Info, and Author's Note as well; they are part of the generation context and can influence its style.

5. **Check the response budget.** In **AI Response Configuration** (sliders icon), make sure **Response (tokens)** is large enough for your chosen word target. Words and tokens are different units; a 300-word request can need substantially more than 300 tokens, especially outside English. If a reply ends mid-sentence, increase the output-token limit or request fewer words. If the backend reports a reasoning-budget limit, review that backend's reasoning settings separately. The extension's word target does not increase either budget automatically.

6. **Choose the draft's writing preferences.** Open Directed Reply using the pen nib after the magic wand. Choose **Draft language** and **Word target**. Open **Writing controls** to allow the content you want. Inner thoughts default to Off. Choose Only when requested or Include a brief thought if you want them, then select their Markdown format. At least one of actions, dialogue, or inner thoughts must be allowed.

7. **Run a small test.** Start with about 100–150 words and a direction such as `Беру чашку, благодарю за чай и спрашиваю, что это за сорт`, with English selected. Click **Generate draft**. Check that the preview contains an English in-character message, follows the selected writing controls, and has no model reasoning or template markers. Edit it if necessary, click **Use draft**, and send it through the normal composer when ready. Generation and acceptance do not automatically send a chat message.

After changing models, repeat the connection, formatting, reasoning, and budget checks. The extension does not change those global settings for you.

### If something looks wrong

| Symptom | What to check |
| --- | --- |
| Writing advice, prompt continuation, or a character profile instead of a reply | On Text Completion, verify Instruct Mode and the model's matching templates. Check for conflicting instructions in the preset, character card, or Author's Note. |
| Reasoning tags, analysis, or a reasoning-budget message in the reply | Verify Auto-Parse and the selected native reasoning format. Check the backend's reasoning budget. Parsing cannot restore text omitted by a budget limit. |
| A previous message still contains reasoning tags after changing settings | Native parsing applies to new or updated messages. Reopen that message in SillyTavern's editor and confirm it to let the configured parser reprocess it. Review the result. |
| The reply stops mid-sentence | Check Response (tokens) and the backend's output limit; reduce the word target or raise the appropriate limit. |
| Inner thoughts appear too often | Set Inner thoughts to Off. Check additional style instructions for conflicts. A model may still disregard the request; review the preview. |
| Wrong output language | Select a specific Draft language. Match conversation follows the RP history, which may be multilingual. The direction's language does not determine the selected output language. |
| Placeholder names | Check the active player persona and existing chat history; edit the draft before sending. |
| Two draft buttons or stale extension behavior | Remove the early manually copied extension if it is still installed beside the GitHub copy, update through the extension manager, and reload. |

Writing preferences are saved per SillyTavern user and restored after restarting. The current direction and preview are temporary; the Writing controls section starts collapsed after a page reload.

References: [SillyTavern Instruct Mode](https://docs.sillytavern.app/usage/core-concepts/instructmode/), [Advanced Formatting](https://docs.sillytavern.app/usage/core-concepts/advancedformatting/).

## Development checks

### Context and performance

Each draft builds one request-local instruction string. The extension does not register persistent prompt injections, append directions or rejected previews to the chat, or store previous briefs for reuse. Only the selected writing settings enter the brief; language and length option lists stay in the UI. SillyTavern supplies chat, persona, character data, and active lore through its normal prompt builder. The extension does not repeat the persona description in its brief.

This does not make a draft an isolated small-context request: World Info and Author's Note remain enabled. Recursive lore activation, long history, model reasoning, output length, and backend prompt-cache reuse can all affect latency. The browser's chat snapshots are local stale-draft checks, not extra text sent to the model. Clearing the backend's KV cache is not injection cleanup and can require more prompt processing.

The context audit reduced a synthetic default brief from 545 to 228 tokens using the development backend's tokenizer with special tokens disabled. These counts exclude the rest of the SillyTavern request and vary by tokenizer, direction, style instructions, and optional composer seed. This is a measured input-size reduction, not a measured end-to-end speedup. Previous generations are not retained in later briefs unless you deliberately put text in the composer and select the seed option.

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

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
