import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createElement, insert, setProp } from "@opentui/solid"
import { onCleanup } from "solid-js"
import { existsSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"

const LIMITS = {
  rolling: 12,
  weekly: 30,
  monthly: 60,
}

const CONFIG_FILE = join(homedir(), ".config", "opencode", "go-usage.json")
const REFRESH_MS = 60_000
const COLLAPSED_KV_KEY = "go-usage.collapsed"

interface UsageData {
  usagePercent: number
  resetInSec: number
}

interface FetchState {
  status: "loading" | "ok" | "error" | "no-config"
  rolling?: UsageData
  weekly?: UsageData
  monthly?: UsageData
  message?: string
  lastFetch: number
}

let state: FetchState = { status: "loading", lastFetch: 0 }
let inflight = false
let collapsed = false
let collapsedInitialized = false

function loadConfig(): { cookie: string; workspaceId: string } | null {
  const envCookie = process.env.OPENCODE_GO_SESSION_COOKIE
  const envWs = process.env.OPENCODE_GO_WORKSPACE_ID
  if (envCookie && envWs) return { cookie: envCookie, workspaceId: envWs }
  if (envCookie) return { cookie: envCookie, workspaceId: "wrk_01KVPGZCHY0D7VFVZGV0QJQVJ9" }
  try {
    if (existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"))
      if (cfg?.cookie) {
        return {
          cookie: cfg.cookie,
          workspaceId: cfg.workspaceId || "wrk_01KVPGZCHY0D7VFVZGV0QJQVJ9",
        }
      }
    }
  } catch {}
  return null
}

function extractUsage(html: string, key: string): UsageData | null {
  const marker = key + ":"
  let idx = -1
  let searchFrom = 0
  while (true) {
    const found = html.indexOf(marker, searchFrom)
    if (found < 0) break
    const tail = html.substring(found, found + 200)
    if (tail.includes("usagePercent:")) {
      idx = found
      break
    }
    searchFrom = found + marker.length
  }
  if (idx < 0) return null
  const slice = html.substring(idx, idx + 200)
  const pct = slice.match(/usagePercent:(\d+)/)
  const reset = slice.match(/resetInSec:(\d+)/)
  if (!pct || !reset) return null
  return { usagePercent: Number(pct[1]), resetInSec: Number(reset[1]) }
}

async function fetchOnce() {
  if (inflight) return
  inflight = true
  try {
    const cfg = loadConfig()
    if (!cfg) {
      state = { ...state, status: "no-config" }
      return
    }
    const cookieHeader = cfg.cookie.includes("=") ? cfg.cookie : `__Secure-authjs.session-token=${cfg.cookie}`
    const url = `https://opencode.ai/workspace/${cfg.workspaceId}/go`
    const res = await fetch(url, {
      headers: {
        Cookie: cookieHeader,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "manual",
    })
    if (res.status >= 300 && res.status < 400) {
      state = { ...state, status: "error", message: `redirect ${res.status} -> ${res.headers.get("location") ?? "?"}` }
      return
    }
    if (!res.ok) {
      state = { ...state, status: "error", message: `HTTP ${res.status}` }
      return
    }
    const html = await res.text()
    const rolling = extractUsage(html, "rollingUsage")
    const weekly = extractUsage(html, "weeklyUsage")
    const monthly = extractUsage(html, "monthlyUsage")
    if (!rolling || !weekly || !monthly) {
      try {
        const debugFile = join(homedir(), ".config", "opencode", "go-usage-debug.html")
        writeFileSync(debugFile, html)
      } catch {}
      state = {
        ...state,
        status: "error",
        message: `parse failed (${html.length} bytes, saved to go-usage-debug.html)`,
      }
      return
    }
    state = { status: "ok", rolling, weekly, monthly, lastFetch: Date.now() }
  } catch (e) {
    state = { ...state, status: "error", message: String((e as Error).message ?? e) }
  } finally {
    inflight = false
  }
}

function fmtReset(resetSec: number): string {
  if (!resetSec || resetSec < 0) return ""
  const days = Math.floor(resetSec / 86400)
  const hours = Math.floor((resetSec % 86400) / 3600)
  const mins = Math.floor((resetSec % 3600) / 60)
  let inner = ""
  if (days > 0) inner = `${days}d ${hours}h`
  else if (hours > 0) inner = `${hours}h ${mins}m`
  else inner = `${mins}m`
  return `(${inner})`
}

function fmtPct(pct: number): string {
  return `${pct.toFixed(1).padStart(4)}%`
}

function fmtDollar(pct: number, limit: number): string {
  const used = (pct / 100) * limit
  return `$${used.toFixed(2)} / $${limit}`
}

function summaryText(): string {
  const r = state.rolling
  const w = state.weekly
  const m = state.monthly
  if (state.status === "ok" && r && w && m) {
    const maxPct = Math.max(r.usagePercent, w.usagePercent, m.usagePercent)
    return `(${maxPct.toFixed(1)}% max)`
  }
  if (state.status === "no-config") return "(no config)"
  if (state.status === "error") return "(error)"
  return "(...)"
}

const tui: TuiPlugin = async (api) => {
  if (!collapsedInitialized) {
    collapsed = Boolean(api.kv.get(COLLAPSED_KV_KEY, false))
    collapsedInitialized = true
  }

  api.slots.register({
    order: 160,
    slots: {
      sidebar_content() {
        const muted = (api.theme.current as any).textMuted

        function txt(props: Record<string, unknown>, text?: string): any {
          const node = createElement("text")
          for (const [key, value] of Object.entries(props)) {
            if (value !== undefined) setProp(node, key, value)
          }
          if (text !== undefined) insert(node, [text])
          return node
        }

        function val(): any {
          const node = createElement("text")
          setProp(node, "fg", muted)
          insert(node, [""])
          return node
        }

        function setText(el: any, text: string) {
          insert(el, null)
          insert(el, [text])
        }

        const rollingPct = val()
        const rollingDol = val()
        const rollingReset = val()
        const weeklyPct = val()
        const weeklyDol = val()
        const weeklyReset = val()
        const monthlyPct = val()
        const monthlyDol = val()
        const monthlyReset = val()
        const status = val()

        const headerTitle = createElement("text")
        setProp(headerTitle, "bold", true)
        setProp(headerTitle, "fg", (api.theme.current as any).text)
        insert(headerTitle, ["\u25BC Go Usage"])

        const headerSummary = createElement("text")
        setProp(headerSummary, "fg", (api.theme.current as any).textMuted)

        function toggle() {
          collapsed = !collapsed
          api.kv.set(COLLAPSED_KV_KEY, collapsed)
          setProp(body, "visible", !collapsed)
          update()
        }

        function update() {
          const now = Date.now()
          if (state.lastFetch === 0 || now - state.lastFetch > REFRESH_MS) {
            fetchOnce()
          }
          const r = state.rolling
          const w = state.weekly
          const m = state.monthly
          setText(headerTitle, collapsed ? `\u25B6 Go Usage` : `\u25BC Go Usage`)
          if (collapsed) {
            setText(headerSummary, ` ${summaryText()}`)
            setProp(headerSummary, "visible", true)
          } else {
            setText(headerSummary, "")
            setProp(headerSummary, "visible", false)
          }
          if (state.status === "ok" && r && w && m) {
            setText(rollingPct, fmtPct(r.usagePercent))
            setText(rollingDol, fmtDollar(r.usagePercent, LIMITS.rolling))
            setText(rollingReset, fmtReset(r.resetInSec))
            setText(weeklyPct, fmtPct(w.usagePercent))
            setText(weeklyDol, fmtDollar(w.usagePercent, LIMITS.weekly))
            setText(weeklyReset, fmtReset(w.resetInSec))
            setText(monthlyPct, fmtPct(m.usagePercent))
            setText(monthlyDol, fmtDollar(m.usagePercent, LIMITS.monthly))
            setText(monthlyReset, fmtReset(m.resetInSec))
            setText(status, "")
          } else if (state.status === "no-config") {
            setText(rollingPct, "\u2014")
            setText(rollingDol, "")
            setText(rollingReset, "")
            setText(weeklyPct, "\u2014")
            setText(weeklyDol, "")
            setText(weeklyReset, "")
            setText(monthlyPct, "\u2014")
            setText(monthlyDol, "")
            setText(monthlyReset, "")
            setText(status, 'set OPENCODE_GO_SESSION_COOKIE=name=value, or ~/.config/opencode/go-usage.json')
          } else if (state.status === "error") {
            setText(rollingPct, "\u2014")
            setText(rollingDol, "")
            setText(rollingReset, "")
            setText(weeklyPct, "\u2014")
            setText(weeklyDol, "")
            setText(weeklyReset, "")
            setText(monthlyPct, "\u2014")
            setText(monthlyDol, "")
            setText(monthlyReset, "")
            setText(status, state.message ?? "error")
          } else {
            setText(rollingPct, "\u2026")
            setText(weeklyPct, "\u2026")
            setText(monthlyPct, "\u2026")
            setText(status, "loading")
          }
        }

        function period(label: string, pctEl: any, dolEl: any, resetEl: any): any {
          const period = createElement("box")
          setProp(period, "flexDirection", "column")
          setProp(period, "width", "100%")

          const row = createElement("box")
          setProp(row, "flexDirection", "row")
          setProp(row, "width", "100%")
          setProp(row, "justifyContent", "space-between")
          const left = createElement("box")
          setProp(left, "flexDirection", "row")
          insert(left, [txt({ fg: muted }, label)])
          insert(left, [pctEl])
          insert(row, [left])
          insert(row, [dolEl])

          const resetRow = createElement("box")
          setProp(resetRow, "flexDirection", "row")
          setProp(resetRow, "width", "100%")
          setProp(resetRow, "justifyContent", "flex-end")
          insert(resetRow, [resetEl])

          insert(period, [row])
          insert(period, [resetRow])
          return period
        }

        const rollingPeriod = period("Rolling  ", rollingPct, rollingDol, rollingReset)
        const weeklyPeriod = period("Weekly   ", weeklyPct, weeklyDol, weeklyReset)
        const monthlyPeriod = period("Monthly  ", monthlyPct, monthlyDol, monthlyReset)

        const body = createElement("box")
        setProp(body, "flexDirection", "column")
        setProp(body, "width", "100%")
        setProp(body, "visible", !collapsed)

        insert(body, [rollingPeriod, weeklyPeriod, monthlyPeriod, status])

        const header = createElement("box")
        setProp(header, "flexDirection", "row")
        setProp(header, "width", "100%")
        insert(header, [headerTitle])
        insert(header, [headerSummary])
        setProp(header, "onMouseUp", () => toggle())

        const root = createElement("box")
        setProp(root, "flexDirection", "column")
        setProp(root, "width", "100%")
        insert(root, [header])
        insert(root, [body])

        function applyCollapse() {
          setProp(body, "visible", !collapsed)
        }

        update()
        const timer = setInterval(update, 2000)
        onCleanup(() => clearInterval(timer))

        return root
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: "go-usage",
  tui,
}

export default plugin
