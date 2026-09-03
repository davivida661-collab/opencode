# lume

An AI chat assistant that lives in your terminal. Zero dependencies, runs on [Bun](https://bun.sh), streams replies as they come in, remembers conversations, and works with any OpenAI-compatible provider.

```
$ lume chat --resume

lume> explain an AST in one paragraph

you  explain an AST in one paragraph

lume  An Abstract Syntax Tree (AST) is a tree representation of source code...
```

## Quick start

Requires Bun ≥ 1.1.

```sh
# 1. get an API key (see below) and make it available
export OPENAI_API_KEY=sk-...

# 2. sanity-check your setup
bun lume/src/index.ts doctor

# 3. chat
bun lume/src/index.ts chat
```

Optional: link it so `lume` works from anywhere.

```sh
cd lume
bun link
lume "hello!"
```

## Usage

| Command | Description |
| --- | --- |
| `lume <question>` | One-shot question, prints the answer, exits |
| `lume chat` | Interactive conversation |
| `lume chat --resume` | Resume the last conversation from disk |
| `lume doctor` | Check API key, endpoint, model and storage |
| `lume -m gpt-4.1-mini "..."` | Ask with a specific model |
| `echo "…" \| lume` | Pipe input as the question |

Slash commands inside chat: `/help`, `/model <name>`, `/system <text>`, `/system reset`, `/clear`, `/history`, `/resume`, `/exit`.

## Providers

lume talks to the OpenAI-compatible `POST /chat/completions` endpoint, so every
provider that clones that API works with one code path.

| Provider | `OPENAI_API_KEY` | `LUME_BASE_URL` | Notes |
| --- | --- | --- | --- |
| OpenAI | your key | *(unset)* | default, model e.g. `gpt-4o-mini` |
| Groq | your key | `https://api.groq.com/openai/v1` | fast, generous free tier, model e.g. `groq/llama-3.3-70b-versatile` |
| OpenRouter | your key | `https://openrouter.ai/api/v1` | one key, many models |
| Together | your key | `https://api.together.xyz/v1` | open models |
| Ollama (local) | any value | `http://localhost:11434/v1` | free, runs on your machine |

Set a default model with `LUME_MODEL`, or switch per session with `-m`/`/model`.
Change the persona with `-s "…"`/`/system`.

## Storage & privacy

- Settings (`model`, `system`) live in `~/.lume/config.json`.
- Conversation history lives in `~/.lume/history.jsonl`.
- Nothing is sent to any provider until you ask a question. `doctor` never prints
  your key, only whether it is set.
- `NO_COLOR=1` disables colored output; output is automatically plain when not a TTY.

## Development

```sh
bun run src/index.ts --help   # run without linking
bun test/smoke.ts             # exercises streaming + error paths against a fake server
```

Project layout:

```
src/index.ts    CLI entrypoint, argument parsing, help
src/ask.ts      one-shot questions (with piped stdin support)
src/chat.ts     interactive REPL and slash commands
src/llm.ts      OpenAI-compatible client with SSE streaming
src/config.ts   ~/.lume settings + JSONL history
src/ui.ts       tiny ANSI helpers
```
