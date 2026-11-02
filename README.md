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

## Development checks

The extension uses the current SillyTavern model connection, prompt builder, context, and reasoning parser. It does not choose a model, change global templates, or embed a model-specific chat format or reasoning delimiter.

For an instruct model connected through Text Completion, enable Instruct Mode and choose templates matching that model. Chat Completion connections use their own prompt builder. Configure **AI Response Formatting → Reasoning → Auto-Parse** and the correct reasoning template when your model returns reasoning in the text. This native setting handles normal character responses too. The extension uses the same selected reasoning format to remove complete model-reasoning blocks and rejects unfinished ones while retaining the previous preview; it preserves in-character thought Markdown.

When switching models, review both chat/instruct formatting and reasoning formatting. A truncated response or a backend's reasoning-budget warning is a generation-budget issue, not an in-character thought, and formatting cleanup cannot recover missing prose. For the Gemma 4 model used during development, the matching chat/context and reasoning presets are named Gemma 4; those names are configuration examples, not extension requirements.

Run `npm install`, `npx playwright install chromium`, and `npm test` inside this extension folder. Alternatively, set `CHROME_PATH` to an installed Chrome executable before running the tests. These browser tests simulate model responses to check preview acceptance, replacement protection, cancellation, chat changes, failures, and private generation; they do not assess model writing quality.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
