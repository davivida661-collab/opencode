import { DEFAULT_SYSTEM, loadConfig } from "./config"
import { resolveConfig, streamChat } from "./llm"
import type { Message } from "./types"
import { red } from "./ui"

export async function runAsk(prompt: string, model?: string, systemOverride?: string): Promise<number> {
  const system = systemOverride ?? loadConfig().system ?? DEFAULT_SYSTEM
  const messages: Message[] = [
    { role: "system", content: system },
    { role: "user", content: prompt },
  ]
  try {
    const cfg = resolveConfig(model)
    for await (const fragment of streamChat(cfg, messages)) {
      process.stdout.write(fragment)
    }
    process.stdout.write("\n")
    return 0
  } catch (error) {
    console.error(red(`lume: ${errorMessage(error)}`))
    return 1
  }
}

export async function readPipedStdin(): Promise<string> {
  if (process.stdin.isTTY) return ""
  const chunks: string[] = []
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(Buffer.from(chunk).toString("utf8"))
  }
  return chunks.join("")
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
