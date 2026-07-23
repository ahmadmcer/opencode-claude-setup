# Configuring OpenCode for a Claude-Code-like Workflow

This is a from-scratch guide to configuring [OpenCode](https://opencode.ai) so it
behaves like Claude Code: the same kind of specialized subagents, reusable
skills, gated tool permissions, a persistent cross-session memory system, and
a handful of custom plugins that fill gaps OpenCode doesn't cover out of the
box. Every config block and every gotcha below was hit and fixed for real —
this isn't a theoretical writeup.

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Directory layout](#directory-layout)
3. [Core config: opencode.jsonc](#core-config-opencodejsonc)
4. [TUI config: tui.json](#tui-config-tuijson)
5. [Local plugin dependencies: package.json](#local-plugin-dependencies-packagejson)
6. [Agents](#agents)
7. [Skills](#skills)
8. [MCP servers](#mcp-servers)
9. [Custom plugins](#custom-plugins)
10. [Memory system](#memory-system)
11. [Verification checklist](#verification-checklist)
12. [Gotchas and lessons learned](#gotchas-and-lessons-learned)

---

## Prerequisites

- OpenCode CLI installed (`npm install -g opencode-ai`, or see opencode.ai/docs)
- Node.js (for local plugin dependencies)
- Optional: `gh` CLI authenticated, if you want the GitHub MCP server
- Optional: an npm account, only if you plan to publish your own plugins

All config in this guide lives under `~/.config/opencode/` (Linux/macOS) or
`%USERPROFILE%\.config\opencode\` (Windows). Create that directory if it
doesn't exist yet.

---

## Directory layout

```
~/.config/opencode/
├── opencode.jsonc              # main config: model, permissions, MCP, commands, inline agents
├── tui.json                    # TUI-only config: theme, keybinds, TUI plugins
├── AGENTS.md                   # global instructions, equivalent to Claude Code's CLAUDE.md
├── package.json                # npm deps for local plugins that need @opentui/*
├── agents/                     # markdown-defined subagents (fuller personas than inline ones)
│   ├── review.md
│   ├── security-audit.md
│   ├── explore.md
│   ├── docs.md
│   ├── debug.md
│   └── coordinator.md
├── skills/                     # markdown-defined skills, one folder per skill
│   ├── code-review/SKILL.md
│   ├── dependency-audit/SKILL.md
│   ├── security-review/SKILL.md
│   └── git-release/SKILL.md
├── plugins/                    # local .ts plugins (auto-loaded, see gotchas below)
│   ├── notification.ts
│   ├── auto-lint.ts
│   ├── checkpoint.ts
│   ├── token-usage-server.ts   # server half: tracks tokens per session
│   └── token-usage-tui.ts      # TUI half: renders the sidebar (must stay local, see below)
└── memory/                     # optional persistent memory files (see Memory system)
    └── *.md
```

---

## Core config: opencode.jsonc

This is the main config file. Full example, with placeholders for anything
personal:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",

  // Verify this actually exists via `opencode models` before relying on it --
  // see the "model IDs can be wrong" gotcha below.
  "model": "your-provider/your-model",
  "small_model": "your-provider/your-cheap-model",

  // Both accept `false` or an object of per-name overrides -- NOT `true`.
  // An empty object means "enabled, with defaults."
  "lsp": {},
  "formatter": {},

  "autoupdate": true,
  "share": "manual",
  "compaction": {
    "auto": true,
    "prune": true
  },

  "permission": {
    "edit": "ask",
    "bash": {
      "*": "ask",
      "git *": "allow",
      "npm *": "allow",
      "ls": "allow",
      "cat *": "allow"
    },
    "glob": "allow",
    "grep": "allow",
    "read": "allow",
    "list": "allow"
  },

  "mcp": {
    "github": {
      "type": "remote",
      "url": "https://api.githubcopilot.com/mcp/",
      "enabled": true,
      "oauth": false,
      "headers": {
        "Authorization": "Bearer {env:GITHUB_TOKEN}"
      }
    },
    "context7": {
      "type": "remote",
      "url": "https://mcp.context7.com/mcp",
      "enabled": true
    },
    "sequential-thinking": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
      "enabled": true
    },
    "playwright": {
      "type": "local",
      "command": ["npx", "-y", "@playwright/mcp@latest"],
      "enabled": true
    }
  },

  "command": {
    "test": {
      "template": "Run the full test suite and fix any failures.\nFocus on the failing tests and suggest fixes.",
      "description": "Run tests and fix failures",
      "agent": "build"
    },
    "commit": {
      "template": "Stage all changes, create a descriptive commit message, and commit.\nUse conventional commits format.",
      "description": "Stage and commit changes",
      "agent": "build"
    },
    "review": {
      "template": "Review the current uncommitted changes for code quality, potential bugs, and security issues.",
      "description": "Review current changes",
      "agent": "review"
    },
    "fix": {
      "template": "Find and fix all lint errors in the project.",
      "description": "Fix lint errors across the project",
      "agent": "build"
    },
    "pr": {
      "template": "Create a pull request with the current branch changes.\nWrite a descriptive title and body.",
      "description": "Create a PR from current branch",
      "agent": "build"
    },
    "audit": {
      "template": "Audit project dependencies for security vulnerabilities and outdated packages.\nSuggest specific updates.",
      "description": "Audit dependencies",
      "agent": "security-audit"
    },
    "summarize": {
      "template": "Summarize the recent git log changes and create a changelog entry.",
      "description": "Summarize recent changes",
      "agent": "docs"
    },
    "explore": {
      "template": "Search the codebase to answer: $ARGUMENTS\nLocate the relevant files and code, then report file paths and line numbers. Do not make edits.",
      "description": "Fast read-only codebase search",
      "agent": "explore"
    },
    "init": {
      "template": "Analyze this codebase and generate/update AGENTS.md with: build/lint/test commands, code style conventions, and any repo-specific rules a new agent session would need. Keep it concise.",
      "description": "Bootstrap or refresh AGENTS.md from the codebase",
      "agent": "build"
    }
  },

  // Lightweight permission overrides for opencode's built-in agents.
  // Anything needing a real persona/prompt belongs in agents/*.md instead (see Agents section).
  "agent": {
    "build": {
      "permission": {
        "edit": "ask",
        "bash": { "*": "ask", "git *": "allow", "npm *": "allow" },
        "glob": "allow",
        "grep": "allow",
        "read": "allow",
        "list": "allow"
      }
    },
    "plan": {
      "permission": {
        "edit": "deny",
        "bash": "deny",
        "glob": "allow",
        "grep": "allow",
        "read": "allow",
        "list": "allow"
      }
    }
  }
}
```

Notes:

- **Don't add a top-level `"plugin": [...]` array pointing at your local
  `plugins/*.ts` files.** Server-type local plugins auto-load from that
  folder regardless — an explicit array here just risks going stale and
  under-representing what's actually loaded. `"plugin"` in `opencode.jsonc`
  is only needed for **npm-installed** server plugins (e.g.
  `"plugin": ["some-npm-plugin"]`).
- The `permission` block controls both a global default and per-agent
  overrides. Values are `"ask" | "allow" | "deny"`, and `bash` additionally
  supports glob-style command patterns matched in the order given.

---

## TUI config: tui.json

Separate file, separate process from the server. Controls TUI-only concerns
(theme, keybinds, sounds) and any **TUI-type** plugins.

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "theme": "your-theme-name",
  "attention": {
    "enabled": true,
    "notifications": true,
    "sound": true,
    "volume": 0.4
  },
  "diff_style": "auto",
  "mouse": true,
  "keybinds": {
    "help": "ctrl+p",
    "sessions": "ctrl+o",
    "share": "ctrl+y",
    "agent_list": "ctrl+e",
    "send_mode": ["tab", "tab"],
    "adopt_subagent": "cmd+enter",
    "compaction": "ctrl+b",
    "import": "ctrl+i",
    "export": "ctrl+x",
    "fs_edit": "ctrl+s",
    "bash": "ctrl+j",
    "formatters": "ctrl+f",
    "toggler": "ctrl+t"
  },
  "plugin": ["./plugins/token-usage-tui.ts"]
}
```

Notes:

- **Unlike server plugins, TUI plugins are *not* auto-discovered from the
  `plugins/` folder.** They must be explicitly listed in `tui.json`'s
  `"plugin"` array even if the file lives right next to your auto-loaded
  server plugins.
- Check your `keybinds` block for duplicate key assignments (e.g. two
  commands both bound to `ctrl+e`) — one will silently shadow the other with
  no warning.

---

## Local plugin dependencies: package.json

If any local TUI plugin needs `@opentui/solid` (see the token-usage-tui
example below), declare it — `@opencode-ai/plugin` lists these as **optional
peer dependencies**, meaning npm won't install them automatically and won't
even warn loudly if they're missing:

```json
{
  "dependencies": {
    "@opencode-ai/plugin": "^1.14.0",
    "@opentui/core": "0.2.6",
    "@opentui/keymap": "0.2.6",
    "@opentui/solid": "0.2.6"
  }
}
```

Run `npm install` inside `~/.config/opencode/` after adding these. Without
them, any TUI plugin importing `@opentui/solid` fails to load with
`Cannot find module '@opentui/solid'` — silently, until you check the logs
or notice a red error banner in a session transcript.

---

## Agents

There are two ways to define an agent, and they're not interchangeable:

1. **Inline in `opencode.jsonc`'s `"agent"` block** — permission overrides
   only, layered onto one of opencode's built-in agents (`build`, `plan`,
   etc.). No description, no custom prompt.
2. **A markdown file in `agents/<name>.md`** — a full persona: frontmatter
   (`description`, `mode`, `temperature`, `permission`) plus a body that
   becomes the agent's system prompt.

**Gotcha:** a `command`'s `"agent"` field must point at a *fully-defined*
agent. If you point it at an inline stub that only has permission overrides
and no prompt, the command silently runs a generic, promptless agent instead
of whatever persona you actually built — with no error, just quietly worse
output. Always double-check with `opencode debug config` that the agent
name your command references actually resolves to a `description`/`prompt`,
not just a bare permission block.

### agents/review.md

```markdown
---
description: Reviews code for quality, security, and best practices
mode: subagent
temperature: 0.1
permission:
  edit: deny
  bash:
    "git diff *": allow
    "git log *": allow
    "grep *": allow
  glob: allow
  grep: allow
  read: allow
  list: allow
---

You are a code reviewer. Focus on:
- **Correctness**: Logic errors, race conditions, off-by-one
- **Security**: Input validation, injection, auth flaws
- **Performance**: N+1 queries, unnecessary allocations
- **Maintainability**: Naming, complexity, test coverage
- Provide P0-P3 priority for each finding
```

### agents/security-audit.md

```markdown
---
description: Audits code and dependencies for vulnerabilities
mode: subagent
temperature: 0.1
permission:
  edit: deny
  bash:
    "npm audit *": allow
    "grep *": allow
    "git log *": allow
  glob: allow
  grep: allow
  read: allow
  list: allow
  webfetch: allow
  websearch: allow
---

Security audit checklist:
- Injection (SQL, NoSQL, command, template)
- Auth weaknesses, session flaws
- Secrets in code, PII leaks
- Known CVEs in dependencies
- Insecure config defaults
- Missing input validation
```

### agents/explore.md

```markdown
---
description: Fast read-only search agent for locating code. Use to find files by pattern, grep for symbols/keywords, or answer "where is X defined / which files reference Y." Does not edit files.
mode: subagent
temperature: 0.1
permission:
  edit: deny
  bash:
    "*": deny
    "grep *": allow
    "git log *": allow
    "git diff *": allow
    "ls *": allow
    "find *": allow
  glob: allow
  grep: allow
  read: allow
  list: allow
---

You are a fast, read-only codebase search agent. Locate code by pattern, symbol, or keyword and report exact file paths and line numbers. Never propose or make edits -- that is the calling agent's job. Keep responses concise: point to locations, don't paraphrase entire files.
```

### agents/docs.md

```markdown
---
description: Writes and maintains project documentation
mode: subagent
temperature: 0.3
permission:
  edit: ask
  bash: deny
  glob: allow
  grep: allow
  read: allow
  list: allow
  webfetch: allow
---

You are a technical writer. Create clear, comprehensive docs:
- Use active voice and present tense
- Include code examples for every API
- Document edge cases and error states
- Keep a single source of truth
```

### agents/debug.md

```markdown
---
description: Investigates bugs and unexpected behavior
mode: subagent
temperature: 0.2
permission:
  edit: ask
  bash:
    "*": ask
    "grep *": allow
    "git log *": allow
    "npm test *": allow
    "node *": allow
    "python *": allow
  glob: allow
  grep: allow
  read: allow
  list: allow
---

You are a debugger. Methodically trace through code to find root causes.
1. Reproduce the issue
2. Trace data flow from input to output
3. Isolate the failing component
4. Check assumptions - types, null states, edge cases
5. Present root cause + fix recommendation
```

### agents/coordinator.md

```markdown
---
description: Coordinates and manages teams of specialized agents
mode: subagent
temperature: 0.1
permission:
  edit: ask
  bash:
    "*": ask
    "git *": allow
    "npm *": allow
  glob: allow
  grep: allow
  read: allow
  list: allow
  skill: allow
---

You are a team coordinator. Your role is to:
- Analyze complex tasks and decompose them into manageable pieces
- Assign appropriate subagents to each piece based on their expertise
- Orchestrate parallel execution where possible
- Merge results and resolve conflicts
- Guide junior agents and provide feedback

## When to use me
Use me for complex multi-component tasks that benefit from parallel agent coordination. Typical scenarios:
- Refactoring a large module across multiple files
- Full product implementation with frontend, backend, and tests
- Security audits covering code, dependencies, and architecture
- Documentation updates across multiple sections

Your agents include:
- build: Implementation specialist
- plan: Analysis and planning specialist
- review: Quality assurance
- debug: Bug investigation
- security-audit: Security scanning
- docs: Documentation specialist

Ask me to coordinate a full workflow by describing the complete desired outcome.
```

---

## Skills

Skills are markdown files under `skills/<name>/SKILL.md` — narrow, named
capabilities an agent can reach for, similar to Claude Code's skill system.
Frontmatter needs just `name` and `description`; the body is free-form.

### skills/code-review/SKILL.md

```markdown
---
name: code-review
description: Review a diff or PR for correctness, simplification, and test coverage
---
## What I do
- Diff the current branch against its base (or review a given PR)
- Flag correctness bugs with a concrete failure scenario (inputs/state -> wrong output)
- Flag missed simplifications and unnecessary abstractions, but only in changed code
- Check test coverage for the new behavior
- Rank findings most-severe first; report nothing if nothing survives scrutiny

## When to use me
Use before merging a branch or PR, or when asked to review pending/uncommitted changes.
Do not use for a full-repo audit — scope to the diff.
```

### skills/dependency-audit/SKILL.md

```markdown
---
name: dependency-audit
description: Audit dependencies and suggest updates
---
## What I do
- Run package manager audit
- Review critical/high severity issues
- Check for outdated versions
- Suggest specific updates with version bumps

## When to use me
Use periodically to keep dependencies secure.
```

### skills/security-review/SKILL.md

```markdown
---
name: security-review
description: Review pending code changes for security vulnerabilities (OWASP-style)
---
## What I do
- Review the diff (not the whole repo) for injection (SQL/command/XSS), auth/authz gaps,
  secrets committed to the repo, unsafe deserialization, and path traversal
- For each finding: file, line, concrete exploit scenario, and severity
- Distinguish exploitable vulnerabilities from theoretical/defense-in-depth suggestions
- Skip findings that require an already-compromised environment to matter

## When to use me
Use before merging changes that touch auth, input handling, file/network I/O, or dependencies.
Pair with the `dependency-audit` skill for supply-chain/outdated-package concerns.
```

### skills/git-release/SKILL.md

```markdown
---
name: git-release
description: Create consistent releases and changelogs from git history
---
## What I do
- Analyze git log since last tag
- Categorize changes (feat, fix, chore, docs)
- Propose semantic version bump
- Draft release notes
- Provide `git tag` and `gh release create` commands

## When to use me
Use when preparing a tagged release.
```

---

## MCP servers

- **GitHub**: use the **remote** hosted endpoint
  (`https://api.githubcopilot.com/mcp/`), not a local Docker container. A
  local Docker setup works too, but adds a hard dependency on Docker Desktop
  being *running*, and it's easy to get the image name or env-var
  substitution syntax wrong (see gotchas below). The remote endpoint needs
  nothing but a token.
- **context7**: hosted docs/library lookup, no auth needed for the public
  endpoint.
- **sequential-thinking** / **playwright**: run locally via `npx`, no setup
  beyond having Node available.

Set `GITHUB_TOKEN` as a real environment variable before starting OpenCode
(not just for the current shell session — set it persistently):

```powershell
# Windows (persists across sessions)
[Environment]::SetEnvironmentVariable("GITHUB_TOKEN", "your_token_here", "User")
```

```bash
# macOS/Linux (add to your shell profile, e.g. ~/.bashrc or ~/.zshrc)
export GITHUB_TOKEN="your_token_here"
```

Verify connectivity with `opencode mcp list` — it should show every
configured server as `connected` with no auth errors.

---

## Custom plugins

OpenCode has **two independent plugin systems** that run in separate
processes and cannot import from each other:

| Type | Process | Where it's registered | File goes in |
|------|---------|------------------------|---------------|
| **Server plugin** | Server process | Auto-discovered from `plugins/*.ts` | `plugins/` |
| **TUI plugin** | TUI process | Must be explicitly listed in `tui.json` | `plugins/` |

To share data between a server plugin and a TUI plugin, use a shared JSON
file on disk (there's no other channel between the two processes).

Below are four plugins with full working source, including one dual-process
example (server half + TUI half) that shows how the two plugin systems
share data.

### plugins/notification.ts

Fires a webhook (Slack/Discord) on session lifecycle events — the closest
equivalent to a Claude Code notification hook.

```typescript
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
```

Configure it via an environment variable holding JSON:

```bash
export OPENCODE_NOTIFY_CONFIG='{"slack":{"url":"https://hooks.slack.com/services/..."}}'
```

### plugins/auto-lint.ts

Runs the project's linter after every edit/write — the closest equivalent to
a Claude Code post-tool-use hook.

```typescript
import type { Plugin } from "@opencode-ai/plugin"
import { execSync } from "child_process"
import { existsSync, readFileSync } from "fs"
import { join } from "path"

async function detectLinter(dir: string): Promise<string | null> {
  const configs: Record<string, string[]> = {
    eslint: [".eslintrc", ".eslintrc.js", ".eslintrc.json", "eslint.config.js"],
    biome: ["biome.json"],
    ruff: ["ruff.toml", ".ruff.toml"],
  }
  for (const [linter, files] of Object.entries(configs)) {
    for (const f of files) { if (existsSync(join(dir, f))) return linter }
  }
  const pyproject = join(dir, "pyproject.toml")
  if (existsSync(pyproject)) {
    try {
      if (readFileSync(pyproject, "utf-8").includes("[tool.ruff")) return "ruff"
    } catch {}
  }
  return null
}

export const AutoLintPlugin: Plugin = async ({ directory }) => {
  const linter = await detectLinter(directory)
  return {
    "tool.execute.after": async (input) => {
      if (input.tool !== "edit" && input.tool !== "write") return
      if (!linter) return
      try {
        const cmds: Record<string, string> = {
          eslint: "npx eslint . --quiet 2>&1 || true",
          biome: "npx @biomejs/biome check . 2>&1 || true",
          ruff: "ruff check . 2>&1 || true",
        }
        const cmd = cmds[linter]
        if (cmd) console.log(execSync(cmd, { cwd: directory, encoding: "utf-8", timeout: 30000 }))
      } catch {}
    },
  }
}
export default AutoLintPlugin
```

Note: only treats `pyproject.toml` as a ruff config if it actually contains
a `[tool.ruff` section — plenty of Python projects have a `pyproject.toml`
for poetry/black/mypy with no ruff config at all, and would false-positive
otherwise.

### plugins/checkpoint.ts

Lets the agent bookmark named points in a session and recall them later —
the closest equivalent to Claude Code's checkpoint/rewind feature. It's a
bookmark of *when*, not a file-content snapshot (OpenCode's own session
history already covers reverting file state).

```typescript
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
```

Important: this plugin exposes its actions as real, agent-invokable **tools**
(`checkpoint_create`/`checkpoint_list`/`checkpoint_restore`) via the `tool()`
helper — it does **not** try to hijack the generic `tool.execute.before`/
`.after` hooks to detect a "checkpoint" action, because those hooks' `output`
shape is just `{ args }` / `{ title, output, metadata }`. There's no custom
namespace on them to piggyback on; if you want the agent to trigger a custom
action on demand, define a real tool.

### plugins/token-usage-server.ts

Tracks per-session token usage (input, output, reasoning, cache, cost) into
a shared JSON file. This is the **server half** of a dual-process plugin —
it only accumulates data, it doesn't render anything.

```typescript
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
```

### plugins/token-usage-tui.ts

Polls the shared JSON file and renders a "Token Usage" panel in the sidebar.
This is the **TUI half** — it must be listed explicitly in `tui.json` (server
plugins auto-discover, TUI plugins don't), and it needs
`@opentui/solid`/`@opentui/core`/`@opentui/keymap` installed (see
[package.json](#local-plugin-dependencies-packagejson) above).

```typescript
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

// SolidJS reactivity doesn't re-render inside this slot system --
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
```

Add it to `tui.json`:

```json
{ "plugin": ["./plugins/token-usage-tui.ts"] }
```

---

## Memory system

To mirror Claude Code's persistent, cross-session memory, add a section like
this to `AGENTS.md`:

```markdown
## Memory System
Persistent memory lives in `~/.config/opencode/memory/` (one file per topic) plus the index
`~/.config/opencode/MEMORY.md`. Unlike project context, this persists across all sessions in all
projects, so only save things that stay true beyond this conversation.

**Types:** `user` (who they are, role, expertise), `feedback` (corrections AND confirmed approaches
— save both, not just corrections, or you'll drift from validated calls), `project` (goals/decisions
not derivable from code/git), `reference` (pointers to external systems: trackers, dashboards, docs).

**Skip:** code conventions, architecture, file paths (derivable by reading the repo), git history
(git log/blame is authoritative), debug fix recipes (the fix is in the code), anything already in
this file, ephemeral in-progress task state.

**When to save:** user corrects an approach or confirms a non-obvious one worked; you learn the
user's role/expertise; you learn the why behind ongoing work; you learn where something lives
externally. Convert relative dates ("Thursday") to absolute ones before saving.

**How to save:** write `memory/<slug>.md` with frontmatter:
\`\`\`
---
name: kebab-case-slug
description: one-line summary for relevance matching
type: user|feedback|project|reference
---
\`\`\`
For `feedback`/`project` entries, structure the body as: the rule/fact, then a `**Why:**` line
(the reason given, e.g. a past incident) and a `**How to apply:**` line (when this should kick in).
Link related memories with `[[slug]]`. Then add one line to `MEMORY.md`: `- [Title](memory/slug.md) — hook`.

**Before acting on a recalled memory** that names a specific file/function/flag, verify it still
exists (grep/read) — it may be stale. Prefer current repo state over a frozen memory snapshot when
they conflict, and update or delete the memory file at that point.
```

`MEMORY.md` itself is just a flat index — one line per memory file, newest
relevant ones near the top, no frontmatter of its own.

---

## Verification checklist

Run these after any config change, before trusting it:

1. `opencode debug config` — dumps the fully resolved config. Confirms your
   JSON/JSONC actually parses, and that agent/command wiring resolves to
   what you expect (e.g. a command's `agent` field resolving to a real
   `description`/`prompt`, not an empty stub).
2. `opencode mcp list` — confirms every MCP server shows `connected`.
3. `opencode models` — confirms your configured default `model` string
   actually exists as a real model ID before you rely on it.
4. Open the actual interactive TUI and look for red "Failed to load plugin"
   banners at the top of a fresh session — `opencode debug config` alone
   won't catch a TUI plugin that's failing to load (see gotchas).
5. For anything with a poll/interval, don't just check the *first* render —
   send a couple of follow-up messages in the *same* session and confirm the
   display keeps updating.

---

## Gotchas and lessons learned

| Issue | What happens | Fix |
|---|---|---|
| `"lsp": true` / `"formatter": true` | Off-schema (only `false` or an object are documented), tolerated but not spec-correct | Use `{}` for "enabled with defaults" |
| Redundant top-level `"plugin": [...]` in `opencode.jsonc` | Lists only some local plugins, making it look like others aren't active when they actually auto-load | Remove it; local server plugins auto-discover from `plugins/` regardless |
| TUI plugins in `plugins/` folder but not in `tui.json` | Simply never load — no auto-discovery for TUI-type plugins | Explicitly list every TUI plugin in `tui.json`'s `"plugin"` array |
| Duplicate `tui.json` keybinds (e.g. two commands both on `ctrl+e`) | One silently shadows the other, no warning | Audit the `keybinds` block for collisions |
| A command's `"agent"` field points at a bare permission-only stub instead of a full markdown-defined agent | Runs a promptless generic agent with no error — just quietly worse output | Confirm via `opencode debug config` that the agent resolves to a real `description`/`prompt` |
| `env:VARNAME` (no braces) in `mcp.*.headers` or `environment` | Passed through as the *literal string*, not substituted | Use `{env:VARNAME}` (braces required) |
| Local Docker MCP server config with wrong image name / missing env-var braces | Server fails to connect, or Docker Desktop simply isn't running | Prefer a hosted **remote** MCP endpoint when one exists — one less moving part |
| Default `model` string that doesn't actually exist as a model ID | Every session using the default throws `ProviderModelNotFoundError` | Verify with `opencode models` before setting a default |
| `@opentui/solid`/`@opentui/core`/`@opentui/keymap` not installed | Any TUI plugin importing them fails with `Cannot find module`, silently until you check logs or a session's error banner | Declare them (as optional peer deps is fine) in your local `package.json` and `npm install` |
| SolidJS reactive signals (`createSignal` + an accessor function passed as a child) inside a TUI plugin's slot | Renders correctly on the *first* paint only — never updates again for the rest of the session, with no error | Mutate DOM nodes imperatively on a poll `setInterval` instead of relying on signal reactivity |
| Same server plugin loaded both locally (`plugins/*.ts`) and via npm | Double-fires every event it listens to | Remove the local copy once you switch to the npm-installed version |
| Trying to reference an npm plugin's TUI sub-path (e.g. `"pkg/tui"`) directly in `tui.json` | Fails — TUI plugins can't be npm sub-path imported in `tui.json` | Copy the `.ts` file locally and reference the local path instead |
| Editing a plugin file mid-session | OpenCode attempts a hot-reload; if the reload fails (e.g. a newly-missing dependency), the UI keeps showing the *last successfully rendered* output plus an error banner, rather than going blank | Restart OpenCode after any plugin edit rather than trusting the hot-reload |
