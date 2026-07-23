import type { Plugin } from "@opencode-ai/plugin"

interface WebhookConfig { url: string; headers?: Record<string, string> }

function getConfig() {
  try {
    const raw = process.env.OPENCODE_NOTIFY_CONFIG
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

async function sendWebhook(config: WebhookConfig, body: unknown) {
  const res = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...config.headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) console.error(`[notification] webhook failed: ${res.status}`)
}

function formatMessage(event: any): string {
  switch (event.type) {
    case "session.created": return `Session started: ${event.properties.session?.title || "Untitled"}`
    case "session.idle": return `Session completed: ${event.properties.session?.title || "Untitled"}`
    case "session.error": return `Session error: ${event.properties.session?.title || "Untitled"}\n${event.properties.error}`
    default: return ""
  }
}

export const NotificationPlugin: Plugin = async () => {
  const config = getConfig()
  return {
    event: async ({ event }) => {
      if (!["session.created", "session.idle", "session.error"].includes(event.type)) return
      const message = formatMessage(event)
      if (!message) return
      if (config.slack) await sendWebhook(config.slack, { text: message })
      if (config.discord) await sendWebhook(config.discord, { content: message })
    },
  }
}
export default NotificationPlugin
