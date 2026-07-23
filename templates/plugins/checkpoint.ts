import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"

interface Checkpoint {
  id: string
  timestamp: number
  title: string
}

interface CheckpointStore {
  checkpoints: Record<string, Checkpoint[]>
  currentId: string
}

const CHECKPOINT_DIR = join(process.cwd(), ".opencode", "checkpoints")
const CHECKPOINT_INDEX = join(CHECKPOINT_DIR, "index.json")
const MAX_PER_SESSION = 10

function readStore(): CheckpointStore {
  try {
    if (existsSync(CHECKPOINT_INDEX)) {
      return JSON.parse(readFileSync(CHECKPOINT_INDEX, "utf-8"))
    }
  } catch {}
  return { checkpoints: {}, currentId: "" }
}

function writeStore(store: CheckpointStore) {
  if (!existsSync(CHECKPOINT_DIR)) mkdirSync(CHECKPOINT_DIR, { recursive: true })
  writeFileSync(CHECKPOINT_INDEX, JSON.stringify(store, null, 2))
}

export const CheckpointPlugin: Plugin = async () => {
  return {
    tool: {
      checkpoint_create: tool({
        description:
          "Save a named checkpoint marking the current point in this session, so it can be referred back to later. This only bookmarks a moment in the conversation -- it does not snapshot file contents (opencode's own session/undo history already covers that).",
        args: {
          title: tool.schema.string().describe("Short label for this checkpoint"),
        },
        async execute(args, context) {
          const store = readStore()
          const id = `cp_${Date.now().toString(36)}`
          const list = store.checkpoints[context.sessionID] ?? []
          list.push({ id, timestamp: Date.now(), title: args.title })
          store.checkpoints[context.sessionID] = list
          store.currentId = id
          writeStore(store)
          return `Saved checkpoint ${id}: "${args.title}"`
        },
      }),
      checkpoint_list: tool({
        description: "List saved checkpoints for the current session.",
        args: {},
        async execute(_args, context) {
          const list = readStore().checkpoints[context.sessionID] ?? []
          if (list.length === 0) return "No checkpoints saved in this session yet."
          return list.map((c) => `${c.id}  ${new Date(c.timestamp).toISOString()}  ${c.title}`).join("\n")
        },
      }),
      checkpoint_restore: tool({
        description:
          "Recall a previously saved checkpoint by id (see checkpoint_list). Returns its title and timestamp for context -- it does not revert file changes.",
        args: {
          id: tool.schema.string().describe("Checkpoint id from checkpoint_list"),
        },
        async execute(args, context) {
          const store = readStore()
          const list = store.checkpoints[context.sessionID] ?? []
          const found = list.find((c) => c.id === args.id)
          if (!found) throw new Error(`Checkpoint ${args.id} not found for this session`)
          store.currentId = found.id
          writeStore(store)
          return `Checkpoint ${found.id}: "${found.title}" (saved ${new Date(found.timestamp).toISOString()})`
        },
      }),
    },

    event: async ({ event }) => {
      if (event.type !== "session.compacted") return
      const { sessionID } = event.properties
      const store = readStore()
      const list = store.checkpoints[sessionID]
      if (!list || list.length <= MAX_PER_SESSION) return
      store.checkpoints[sessionID] = list.slice(-MAX_PER_SESSION)
      writeStore(store)
    },

    "shell.env": async (input, output) => {
      const store = readStore()
      const list = store.checkpoints[input.sessionID ?? ""] ?? []
      output.env.CHECKPOINT_CURRENT = store.currentId
      output.env.CHECKPOINT_LATEST = list.at(-1)?.id ?? ""
    },
  }
}

export default CheckpointPlugin
