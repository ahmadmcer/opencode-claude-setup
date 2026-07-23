import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createElement, insert, setProp } from "@opentui/solid"
import { onCleanup } from "solid-js"
import { existsSync, readFileSync } from "fs"
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

function readSession(sid: string): TokenData {
  try {
    if (sid && existsSync(DATA_FILE)) {
      const store: SessionStore = JSON.parse(readFileSync(DATA_FILE, "utf-8"))
      if (store.sessions?.[sid]) return store.sessions[sid]
    }
  } catch {}
  return { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0 }
}

function formatNum(n: number): string {
  return n.toLocaleString("en-US")
}

function cacheRateDisplay(cacheRead: number, input: number): string {
  if (input === 0) return "0.0%"
  const rate = Math.min((cacheRead / input) * 100, 100)
  return rate.toFixed(1) + "%"
}

function el(tag: string, props: Record<string, unknown>, children: any[] = []): any {
  const node = createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) setProp(node, key, value)
  }
  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) insert(node, child)
  }
  return node
}

function box(props: Record<string, unknown>, children: any[] = []): any {
  return el("box", props, children)
}

function txt(props: Record<string, unknown>, children: any[] = []): any {
  return el("text", props, children)
}

function row(label: string, valueNode: any, muted: unknown): any {
  return box({ flexDirection: "row", width: "100%", justifyContent: "space-between" }, [
    txt({ fg: muted }, [label]),
    valueNode,
  ])
}

// SolidJS reactivity doesn't re-render inside this slot system (see PUBLISHING.md) --
// nodes must be mutated imperatively on a poll interval instead of via signals.
function setNodeText(node: any, text: string) {
  insert(node, null)
  insert(node, [text])
}

function valNode(style: Record<string, unknown>): any {
  const node = createElement("text")
  for (const [key, value] of Object.entries(style)) {
    if (value !== undefined) setProp(node, key, value)
  }
  insert(node, [""])
  return node
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 150,
    slots: {
      sidebar_content() {
        const muted = (api.theme.current as any).textMuted
        const valStyle = { fg: muted }

        const inputVal = valNode(valStyle)
        const outputVal = valNode(valStyle)
        const reasoningVal = valNode(valStyle)
        const cacheReadVal = valNode(valStyle)
        const cacheWriteVal = valNode(valStyle)
        const cacheRateVal = valNode(valStyle)
        const costVal = valNode(valStyle)

        function update() {
          const route = api.route.current
          const sid = route?.name === "session" ? (route.params?.sessionID as string) ?? "" : ""
          if (!sid) {
            setNodeText(inputVal, "")
            setNodeText(outputVal, "")
            setNodeText(reasoningVal, "")
            setNodeText(cacheReadVal, "")
            setNodeText(cacheWriteVal, "")
            setNodeText(cacheRateVal, "")
            setNodeText(costVal, "")
          } else {
            const d = readSession(sid)
            setNodeText(inputVal, formatNum(d.input))
            setNodeText(outputVal, formatNum(d.output))
            setNodeText(reasoningVal, formatNum(d.reasoning))
            setNodeText(cacheReadVal, formatNum(d.cacheRead))
            setNodeText(cacheWriteVal, formatNum(d.cacheWrite))
            setNodeText(cacheRateVal, cacheRateDisplay(d.cacheRead, d.input))
            setNodeText(costVal, `$${d.cost.toFixed(2)}`)
          }
        }

        update()

        const timer = setInterval(update, 500)
        onCleanup(() => clearInterval(timer))

        return box({ flexDirection: "column", width: "100%" }, [
          txt({ bold: true }, ["Token Usage"]),
          row("Input", inputVal, muted),
          row("Output", outputVal, muted),
          row("Reasoning", reasoningVal, muted),
          row("Cache read", cacheReadVal, muted),
          row("Cache write", cacheWriteVal, muted),
          row("Cache rate", cacheRateVal, muted),
          row("Cost", costVal, muted),
        ])
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: "token-usage",
  tui,
}

export default plugin
