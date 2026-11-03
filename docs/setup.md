# Model setup and troubleshooting

[← Directed Reply](../README.md)


1. **Connect a model.** Open **API Connections** (plug icon), choose the connection type and backend, enter the backend URL or credentials, and connect. Check that the model is shown as connected. Directed Reply uses this connection; it has no separate model or API key.

2. **Check whether you use Text Completion or Chat Completion.** The required formatting setup differs:
   - **Text Completion** (for example, a KoboldCpp connection): open **AI Response Formatting** (A icon). For an instruction-following model, enable **Instruct Mode** using the power button beside Instruct Template. Select the model's matching **Instruct Template** and **Context Template**. Follow the model author's instructions; the template is determined by the model, not just the backend name. For example, the Gemma 4 model used during development needs Gemma 4 templates. Do not apply that template to an unrelated model. Automatic template detection can help, but verify the selected names when you change models.
   - **Chat Completion**: use your connection's normal chat preset and Prompt Manager. SillyTavern's Text Completion Instruct Mode is not needed for this connection type.

3. **Check reasoning parsing if the model returns reasoning in its text.** Open **AI Response Formatting → Reasoning**, expand **Reasoning Formatting**, and select the reasoning template that matches your model's actual output delimiters. Enable **Auto-Parse**. The Prefix and Suffix must both be correct. For example, a model emitting Gemma 4 thought-channel markers needs the Gemma 4 reasoning preset; a model using another syntax needs its own matching preset. Auto-Expand can remain off if you prefer model reasoning collapsed. These are native SillyTavern settings and also affect normal character replies. In-character thought backticks in Directed Reply are a separate writing preference.

4. **Set your player persona.** Open **Persona Management** and give the active persona a real name and a short description if you want the draft to use them. A default name such as User, or a placeholder already present in the conversation, gives the model less reliable identity information. Review the character card, World Info, and Author's Note as well; they are part of the generation context and can influence its style.

5. **Check the response budget.** In **AI Response Configuration** (sliders icon), make sure **Response (tokens)** is large enough for your chosen word target. Words and tokens are different units; a 300-word request can need substantially more than 300 tokens, especially outside English. If a reply ends mid-sentence, increase the output-token limit or request fewer words. If the backend reports a reasoning-budget limit, review that backend's reasoning settings separately. The extension's word target does not increase either budget automatically.

6. **Choose the draft's writing preferences.** Open Directed Reply using the pen nib after the magic wand. Choose **Draft language** and **Word target**. Open **Writing controls** to allow the content you want. Inner thoughts default to Off. Choose Only when requested or Include a brief thought if you want them, then select their Markdown format. At least one of actions, dialogue, or inner thoughts must be allowed.

7. **Run a small test.** Start with about 100–150 words and a direction such as `Беру чашку, благодарю за чай и спрашиваю, что это за сорт`, with English selected. Click **Generate draft**. Check that the preview contains an English in-character message, follows the selected writing controls, and has no model reasoning or template markers. Edit it if necessary, click **Place in chat**, and send it through the normal composer when ready. Generation and acceptance do not automatically send a chat message.

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

