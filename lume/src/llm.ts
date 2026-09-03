import type { Message } from "./types"

export type ProviderConfig = {
  apiKey: string
  baseUrl: string
  model: string
}

const DEFAULT_MODEL = "gpt-4o-mini"

export function resolveConfig(modelOverride?: string): ProviderConfig {
  const apiKey = Bun.env.OPENAI_API_KEY ?? ""
  const baseUrl = (Bun.env.LUME_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "")
  const model = modelOverride ?? Bun.env.LUME_MODEL ?? DEFAULT_MODEL
  return { apiKey, baseUrl, model }
}

type ApiErrorBody = { error?: { message?: string } }

function readError(baseUrl: string, status: number, detail: string): string {
  const hints: Record<number, string> = {
    400: "bad request",
    401: "authentication failed — check your OPENAI_API_KEY",
    403: "forbidden — the API key may lack permission",
    404: "endpoint or model not found — try another model name",
    429: "rate limited or out of credits",
    500: "provider error",
    503: "provider unavailable",
  }
  const hint = hints[status] ?? `HTTP ${status}`
  const suffix = detail ? ` — ${detail}` : ""
  return `${hint} (${baseUrl})${suffix}`
}

/**
 * Streams assistant text for the given messages from an OpenAI-compatible
 * chat completions endpoint. Yields one text fragment per SSE chunk.
 * Falls back to reading a plain JSON response when the server ignores
 * `stream: true`.
 */
export async function* streamChat(cfg: ProviderConfig, messages: Message[]): AsyncGenerator<string> {
  if (!cfg.apiKey) throw new Error("no API key — set OPENAI_API_KEY (or run `lume doctor`)")
  const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({ model: cfg.model, messages, stream: true }),
  })
  if (!response.ok) {
    let detail = ""
    try {
      const body = (await response.json()) as ApiErrorBody
      detail = body.error?.message ?? ""
    } catch {
      // non-JSON error body; ignore
    }
    throw new Error(readError(cfg.baseUrl, response.status, detail))
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error(`empty response body from ${cfg.baseUrl}`)
  const decoder = new TextDecoder()
  const queue: string[] = []

  function feed(text: string) {
    for (const raw of text.split("\n")) {
      const line = raw.trim()
      if (!line.startsWith("data:")) continue
      const payload = line.slice(5).trim()
      if (payload === "[DONE]") continue
      const delta = parseDelta(payload)
      if (delta) queue.push(delta)
    }
  }

  let buffer = ""
  let jsonMode: boolean | null = null
  let full = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    if (jsonMode === null) jsonMode = !buffer.trimStart().startsWith("data:")
    if (jsonMode) {
      full += buffer
      buffer = ""
      continue
    }
    const chunks = buffer.split("\n")
    buffer = chunks.pop() ?? ""
    feed(chunks.join("\n"))
    for (const delta of queue) yield delta
    queue.length = 0
  }
  if (jsonMode === true) {
    const content = parsePlainContent(full)
    if (content) yield content
  } else {
    feed(buffer)
    for (const delta of queue) yield delta
  }
}

function parseDelta(payload: string): string | null {
  let data: unknown
  try {
    data = JSON.parse(payload)
  } catch {
    return null
  }
  if (typeof data !== "object" || data === null) return null
  const choice = (data as { choices?: unknown }).choices?.[0]
  if (typeof choice !== "object" || choice === null) return null
  const content = (choice as { delta?: { content?: unknown } }).delta?.content
  return typeof content === "string" ? content : null
}

function parsePlainContent(text: string): string | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof data !== "object" || data === null) return null
  const content = (data as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content
  return typeof content === "string" ? content : null
}
