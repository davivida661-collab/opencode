import { runAsk } from "../src/ask"
import { streamChat } from "../src/llm"
import type { ProviderConfig } from "../src/llm"

async function collect(cfg: { apiKey: string; baseUrl: string; model: string }): Promise<string> {
  let text = ""
  for await (const fragment of streamChat(cfg, [{ role: "user", content: "hello" }])) {
    text += fragment
  }
  return text
}

// 1. Streaming success path (fake SSE server)
const okServer = Bun.serve({
  port: 0,
  fetch: () =>
    new Response(
      [
        'data: {"choices":[{"delta":{"content":"Hello "}}]}',
        "",
        'data: {"choices":[{"delta":{"content":"from the fake model."}}]}',
        "",
        "data: [DONE]",
        "",
      ].join("\n"),
      { headers: { "content-type": "text/event-stream" } },
    ),
})

const ok = await collect({ apiKey: "test-key", baseUrl: `http://127.0.0.1:${okServer.port}`, model: "test-model" })
okServer.stop(true)
if (ok !== "Hello from the fake model.") {
  console.error(`✗ streaming: got ${JSON.stringify(ok)}`)
  process.exit(1)
}

// 2. Auth error path (401 with JSON error body)
const authServer = Bun.serve({
  port: 0,
  fetch: () =>
    new Response(JSON.stringify({ error: { message: "Incorrect API key provided" } }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
})

let authError = ""
try {
  await collect({ apiKey: "wrong", baseUrl: `http://127.0.0.1:${authServer.port}`, model: "test-model" })
} catch (error) {
  authError = error instanceof Error ? error.message : String(error)
}
authServer.stop(true)
if (!authError.includes("authentication failed")) {
  console.error(`✗ auth error: got ${JSON.stringify(authError)}`)
  process.exit(1)
}

// 3. End-to-end ask path (env-driven config), incl. the chat module import
await import("../src/chat")
const askServer = Bun.serve({
  port: 0,
  fetch: () =>
    new Response('data: {"choices":[{"delta":{"content":"pong"}}]}\n\ndata: [DONE]\n\n', {
      headers: { "content-type": "text/event-stream" },
    }),
})
const askCfg: ProviderConfig = { apiKey: "test-key", baseUrl: `http://127.0.0.1:${askServer.port}`, model: "test-model" }
const prevKey = Bun.env.OPENAI_API_KEY
const prevBase = Bun.env.LUME_BASE_URL
Bun.env.OPENAI_API_KEY = askCfg.apiKey
Bun.env.LUME_BASE_URL = askCfg.baseUrl
const askCode = await runAsk("ping")
Bun.env.OPENAI_API_KEY = prevKey
Bun.env.LUME_BASE_URL = prevBase
askServer.stop(true)
if (askCode !== 0) {
  console.error(`✗ runAsk exited ${askCode}`)
  process.exit(1)
}

// 4. Missing key fails fast without any network call
let missingKeyError = ""
try {
  await collect({ apiKey: "", baseUrl: "http://127.0.0.1:1", model: "test-model" })
} catch (error) {
  missingKeyError = error instanceof Error ? error.message : String(error)
}
if (!missingKeyError.includes("OPENAI_API_KEY")) {
  console.error(`✗ missing key: got ${JSON.stringify(missingKeyError)}`)
  process.exit(1)
}

console.log(`✓ smoke passed (streaming, auth error, ask path, missing key)`)
