import { createInterface } from "node:readline/promises"
import { DEFAULT_SYSTEM, appendHistory, clearHistory, loadConfig, readHistory, saveConfig } from "./config"
import { resolveConfig, streamChat } from "./llm"
import type { Message } from "./types"
import { cyan, dim, green, red, yellow } from "./ui"

const HELP = `commands:
  /help                 show this help
  /model <name>         switch model (e.g. gpt-4o-mini, gpt-4.1-mini, groq/llama-3.3-70b)
  /model                show the current model
  /system <text>        set a new system prompt for the rest of the session
  /system reset         restore the default system prompt
  /clear                start a fresh conversation (history file is wiped)
  /history              show the last messages of this conversation
  /resume               load the previous conversation from disk
  /quit, /exit          leave (Ctrl-D works too)`

export type ChatOptions = {
  resume: boolean
  model?: string
  system?: string
}

export async function runChat(opts: ChatOptions): Promise<number> {
  let config = loadConfig()
  let model = opts.model ?? config.model
  let system = opts.system ?? config.system ?? DEFAULT_SYSTEM
  let convo: Message[] = []

  if (opts.resume) {
    convo = readHistory()
    if (convo.at(-1)?.role === "assistant") convo.pop()
    if (convo.length > 0) console.log(dim(`resumed ${convo.length} previous message${convo.length === 1 ? "" : "s"}`))
    else console.log(dim("no previous conversation found"))
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  rl.setPrompt(`${cyan("lume")}${green("> ")} `)
  rl.prompt()

  for await (const raw of rl) {
    const line = raw.trim()
    if (line === "") {
      rl.prompt()
      continue
    }
    if (line.startsWith("/")) {
      handleCommand(line)
      rl.prompt()
      continue
    }

    const userMessage: Message = { role: "user", content: line }
    convo.push(userMessage)
    console.log(`\n${cyan("you")}  ${line}`)

    const answer = await completeTurn(system, convo)
    if (answer === null) {
      convo.pop()
      console.log(dim("(turn failed — type again to retry)"))
    } else {
      appendHistory([userMessage, { role: "assistant", content: answer }])
    }
    rl.prompt()
  }
  console.log()
  return 0

  function handleCommand(line: string) {
    const [command, ...rest] = line.slice(1).split(/\s+/)
    const arg = rest.join(" ")
    switch (command) {
      case "help":
        console.log(HELP)
        break
      case "model": {
        if (!arg) {
          console.log(yellow(`current model: ${resolveConfig(model).model}`))
          break
        }
        model = arg
        config = { ...config, model: arg }
        saveConfig(config)
        console.log(green(`model set to ${arg}`))
        break
      }
      case "system": {
        if (arg === "" || arg === "reset") {
          system = DEFAULT_SYSTEM
          config = { ...config, system: undefined }
          saveConfig(config)
          console.log(green("system prompt reset to default"))
          break
        }
        system = arg
        config = { ...config, system: arg }
        saveConfig(config)
        console.log(green("system prompt updated — applies from the next message"))
        break
      }
      case "clear":
        convo = []
        clearHistory()
        console.log(green("conversation cleared"))
        break
      case "history":
        if (convo.length === 0) {
          console.log(dim("conversation is empty"))
          break
        }
        for (const message of convo) {
          const label = message.role === "user" ? cyan("you") : green("lume")
          console.log(`${label}  ${message.content.replace(/\n/g, " ").slice(0, 200)}`)
        }
        break
      case "resume": {
        convo = readHistory()
        console.log(dim(`loaded ${convo.length} previous message${convo.length === 1 ? "" : "s"} into the conversation`))
        break
      }
      case "quit":
      case "exit":
        console.log()
        process.exit(0)
        break
      default:
        console.log(red(`unknown command /${command}`))
        console.log(dim("type /help for available commands"))
    }
  }

  async function completeTurn(systemPrompt: string, messages: Message[]): Promise<string | null> {
    const cfg = resolveConfig(model)
    const request: Message[] = [{ role: "system", content: systemPrompt }, ...messages]
    process.stdout.write(`${green("lume")}  `)
    let answer = ""
    try {
      for await (const fragment of streamChat(cfg, request)) {
        answer += fragment
        process.stdout.write(fragment)
      }
    } catch (error) {
      console.error(red(`\nlume: ${error instanceof Error ? error.message : String(error)}`))
      return null
    }
    process.stdout.write("\n")
    return answer
  }
}
