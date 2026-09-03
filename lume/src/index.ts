#!/usr/bin/env bun
import { runAsk, readPipedStdin } from "./ask"
import { runChat } from "./chat"
import { runDoctor } from "./doctor"
import { bold, cyan, dim, red } from "./ui"

const VERSION = "0.1.0"

const HELP = `${bold("lume")} — an AI chat assistant that lives in your terminal

usage:
  ${cyan("lume")} <question>            ask a question, print the answer, exit
  ${cyan("lume")} chat                 start an interactive conversation
  ${cyan("lume")} chat --resume        resume the last conversation from disk
  ${cyan("lume")} doctor               check API key, endpoint and storage
  ${cyan("lume")} --help               show this help
  ${cyan("lume")} --version            show the version

options:
  -m, --model <name>    model to use (default: gpt-4o-mini)
  -s, --system <text>   override the system prompt
  -h, --help            show this help
  -v, --version         show the version

environment:
  OPENAI_API_KEY        API key (required)
  LUME_BASE_URL         any OpenAI-compatible endpoint (default https://api.openai.com/v1)
  LUME_MODEL            default model
  NO_COLOR              disable colors

examples:
  ${dim("lume \"explain what an AST is in one paragraph\"")}
  ${dim("echo 'summarize this log' | lume")}
  ${dim("lume chat --resume")}

Inside chat, type /help for slash commands. Conversation history and settings
are stored in ~/.lume.`

type Parsed = {
  help: boolean
  version: boolean
  resume: boolean
  model?: string
  system?: string
  positional: string[]
}

function parseArgs(argv: string[]): Parsed | { error: string } {
  const parsed: Parsed = { help: false, version: false, resume: false, positional: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case "-h":
      case "--help":
        parsed.help = true
        break
      case "-v":
      case "--version":
        parsed.version = true
        break
      case "--resume":
        parsed.resume = true
        break
      case "-m":
      case "--model":
        if (i + 1 >= argv.length) return { error: `${arg} requires a value` }
        parsed.model = argv[++i]
        break
      case "-s":
      case "--system":
        if (i + 1 >= argv.length) return { error: `${arg} requires a value` }
        parsed.system = argv[++i]
        break
      default:
        if (arg.startsWith("-")) return { error: `unknown option ${arg}` }
        parsed.positional.push(arg)
    }
  }
  return parsed
}

async function main(argv: string[]) {
  const parsed = parseArgs(argv)
  if ("error" in parsed) {
    console.error(red(`lume: ${parsed.error}`))
    console.error(dim("run `lume --help` for usage"))
    return 1
  }
  if (parsed.version) {
    console.log(`lume ${VERSION}`)
    return 0
  }
  if (parsed.help || argv.length === 0) {
    console.log(HELP)
    return 0
  }

  const [command, ...rest] = parsed.positional
  switch (command) {
    case "chat":
      if (rest.length > 0) {
        console.error(red('lume: chat takes no arguments (extra text can go inside the session)'))
        return 1
      }
      return runChat({ resume: parsed.resume, model: parsed.model, system: parsed.system })
    case "doctor":
      if (rest.length > 0) return usageError("doctor takes no arguments")
      return runDoctor()
    case "help":
      console.log(HELP)
      return 0
    default: {
      const prompt = parsed.positional.join(" ")
      const question = prompt || (await readPipedStdin()).trim()
      if (!question) {
        console.error(red('lume: nothing to ask — pass a question or pipe input in'))
        console.error(dim("run `lume --help` for usage"))
        return 1
      }
      return runAsk(question, parsed.model, parsed.system)
    }
  }
}

function usageError(message: string): number {
  console.error(red(`lume: ${message}`))
  console.error(dim("run `lume --help` for usage"))
  return 1
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code
  },
  (error: unknown) => {
    console.error(red(`lume: ${error instanceof Error ? error.message : String(error)}`))
    process.exitCode = 1
  },
)
