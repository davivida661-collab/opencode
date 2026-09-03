import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { Message } from "./types"

export const DEFAULT_SYSTEM = "You are Lume, a helpful AI assistant running in the user's terminal. Be concise, clear, and honest. Use code blocks when code helps."

export type Config = {
  model?: string
  system?: string
}

const dir = join(homedir(), ".lume")
const configPath = join(dir, "config.json")
const historyPath = join(dir, "history.jsonl")

function ensureDir() {
  mkdirSync(dir, { recursive: true })
}

export function loadConfig(): Config {
  if (!existsSync(configPath)) return {}
  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as Config
  } catch {
    return {}
  }
}

export function saveConfig(config: Config) {
  ensureDir()
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n")
}

export function systemPrompt(config: Config): string {
  return config.system ?? DEFAULT_SYSTEM
}

export function readHistory(max = 30): Message[] {
  if (!existsSync(historyPath)) return []
  const lines = readFileSync(historyPath, "utf8").split("\n").filter(Boolean).slice(-max)
  const messages: Message[] = []
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as Message
      if (parsed.role === "user" || parsed.role === "assistant") messages.push(parsed)
    } catch {
      // skip malformed lines written by older versions or interrupted writes
    }
  }
  return messages
}

export function appendHistory(messages: Message[]) {
  ensureDir()
  appendFileSync(historyPath, messages.map((m) => JSON.stringify(m)).join("\n") + "\n")
}

export function clearHistory() {
  ensureDir()
  writeFileSync(historyPath, "")
}

export function historyInfo(): { exists: boolean; size: number; messages: number } {
  if (!existsSync(historyPath)) return { exists: false, size: 0, messages: 0 }
  const raw = readFileSync(historyPath, "utf8")
  return { exists: true, size: raw.length, messages: raw.split("\n").filter(Boolean).length }
}
