import { historyInfo, loadConfig } from "./config"
import { resolveConfig } from "./llm"
import { bold, cyan, dim, green, red, yellow } from "./ui"

export function runDoctor(): number {
  const cfg = resolveConfig()
  const config = loadConfig()
  const history = historyInfo()

  console.log(bold("lume doctor"))
  console.log(dim("─".repeat(40)))

  if (cfg.apiKey) {
    console.log(`${green("✓")} OPENAI_API_KEY is set (…${cfg.apiKey.slice(-4)})`)
  } else {
    console.log(`${red("✗")} OPENAI_API_KEY is not set`)
  }
  console.log(`${cyan("·")} endpoint: ${cfg.baseUrl}/chat/completions`)
  console.log(`${cyan("·")} model:    ${cfg.model}${config.model ? " (saved in config)" : Bun.env.LUME_MODEL ? " (from LUME_MODEL)" : " (default)"}`)
  console.log(`${cyan("·")} system:   ${config.system ? "custom (saved in config)" : "default"}`)
  console.log(`${cyan("·")} history:  ${history.exists ? `${history.messages} message${history.messages === 1 ? "" : "s"}, ${history.size} bytes` : "none yet"}`)

  if (!cfg.apiKey) {
    console.log()
    console.log(yellow("how to get started:"))
    console.log(`  1. grab an API key from your provider`)
    console.log(`  2. export OPENAI_API_KEY=sk-…`)
    console.log(`  3. run ${cyan("lume chat")}`)
    console.log()
    console.log(dim("other OpenAI-compatible providers work too: set LUME_BASE_URL"))
    console.log(dim("(e.g. Groq https://api.groq.com/openai/v1, OpenRouter https://openrouter.ai/api/v1)"))
    return 1
  }
  return 0
}
