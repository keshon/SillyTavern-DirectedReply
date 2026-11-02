# Directed Reply

Draft your own roleplay reply from a short direction. Uses SillyTavern's current API connection and background generation, including the conversation, character context, World Info, and Author's Note as allowed by your existing configuration. Each generation uses your model connection and its normal costs.

## Use

1. Refresh SillyTavern after installing the extension. Open a chat and connect a model.
2. Click the pen nib next to the chat input.
3. Describe your intended action, dialogue, tone, or constraints in Russian, English, or another language. Choose the **Draft language** separately: English (default), Russian, or Match conversation. Match conversation uses the language of the RP, rather than your directions.
4. Click **Generate draft** or press Ctrl+Enter (Cmd+Enter on macOS).
5. Edit the preview or regenerate it. **Develop text already in the chat input** optionally includes your existing composer text as a starting draft.
6. Click **Use draft** to put the preview in the normal composer, then send it yourself. Existing composer text requires an explicit replacement click.

**Stop** discards the pending result and preserves your previous preview. Closing the panel preserves the current draft during this page session; changing chats clears it and cancels a pending request. Reloading the page clears private directions and previews.

The default style is first-person, present-tense roleplay with `*actions*`, plain triple-backtick blocks for in-character thoughts, and `"dialogue"`. The preview is a plain-text editor: it displays the Markdown characters so you can edit them. **Use draft** preserves those characters and internal line breaks in the composer. SillyTavern renders them after sending.

Example reply:

````text
*I accept the cup with both hands, offering a grateful smile.*
"Thank you. That smells wonderful."

```
Something warm to hold. That helps more than I expected.
```

*I take a careful sip and glance up again.*
"What blend is it?"
````

Thought fences do not have a `rust` or other programming-language tag. They represent the player character's inner voice; model reasoning is removed separately. The prompt requests this format, while the preview-to-composer transfer preserves the returned Markdown. A model can still ignore formatting instructions, so review it before accepting.

Length options are approximate word targets: Short (60–100), Medium (100–180, default), and Long (180–260). Length and output-language preferences are saved in your SillyTavern settings. The language selector takes precedence over the language of your directions.

For example, with **English** selected, directions such as `Беру чашку, благодарю за чай, пробую и спрашиваю, что это за сорт` request an English in-character reply. The extension supplies a short prose example to guide the style and rejects responses that begin with recognized writing-brief headings. This catches the known planning-note failure; it cannot guarantee every model response follows the requested format or language.

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

For an instruct model connected through Text Completion, enable SillyTavern's Instruct Mode and choose templates that match the model. For Gemma 4, select **Gemma 4** as both the Context Template and Instruct Template in AI Response Formatting. With Instruct Mode off, background generation can continue the instructions instead of starting the requested reply. The extension also removes complete Gemma 4 thought-channel blocks and rejects unfinished ones while retaining the previous preview.

Run `npm install`, `npx playwright install chromium`, and `npm test` inside this extension folder. Alternatively, set `CHROME_PATH` to an installed Chrome executable before running the tests. These browser tests simulate model responses to check preview acceptance, replacement protection, cancellation, chat changes, failures, and private generation; they do not assess model writing quality.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
