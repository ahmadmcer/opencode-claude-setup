import type { Plugin } from "@opencode-ai/plugin"
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"

interface TokenData {
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  cost: number
}

interface SessionStore {
  sessions: Record<string, TokenData>
}

const DATA_FILE = join(homedir(), ".opencode", "token-usage.json")

function readStore(): SessionStore {
  try {
    if (existsSync(DATA_FILE)) {
      return JSON.parse(readFileSync(DATA_FILE, "utf-8"))
    }
  } catch {}
  return { sessions: {} }
}

function writeStore(store: SessionStore) {
  const dir = join(homedir(), ".opencode")
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(DATA_FILE, JSON.stringify(store))
}

const empty = (): TokenData => ({ input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0 })

const plugin: Plugin = async () => {
  return {
    event: async ({ event }) => {
      if (event.type === "message.updated") {
        const info = event.properties.info as any
        if (info?.role !== "assistant") return
        if (!info.time?.completed) return

        const sid = info.sessionID as string
        if (!sid) return

        const store = readStore()
        if (!store.sessions[sid]) store.sessions[sid] = empty()
        const data = store.sessions[sid]
        data.input += (info.tokens?.input as number) ?? 0
        data.output += (info.tokens?.output as number) ?? 0
        data.reasoning += (info.tokens?.reasoning as number) ?? 0
        data.cacheRead += (info.tokens?.cache?.read as number) ?? 0
        data.cacheWrite += (info.tokens?.cache?.write as number) ?? 0
        data.cost += (info.cost as number) ?? 0
        writeStore(store)
      }
    },
  }
}

export default plugin
