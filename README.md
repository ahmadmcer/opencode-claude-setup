# opencode-claude-setup

An interactive installer that configures [OpenCode](https://opencode.ai) to
behave like Claude Code: specialized subagents, reusable skills, gated tool
permissions, a persistent memory-file convention, and a handful of plugins
that fill gaps OpenCode doesn't cover out of the box.

## Quick start

```bash
npx github:ahmadmcer/opencode-claude-setup
```

No npm publish, no global install -- npx clones the repo and runs it
directly. Requires Node.js >= 18 and the `opencode` CLI already on `PATH`
(`npm install -g opencode-ai` if you don't have it yet).

## What this installs

- 6 markdown-defined subagents (`review`, `security-audit`, `explore`, `docs`, `debug`, `coordinator`)
- 4 skills (`code-review`, `dependency-audit`, `security-review`, `git-release`)
- Up to 5 optional plugins (`notification`, `auto-lint`, `checkpoint`, `token-usage`, `go-usage`)
- Up to 4 optional MCP servers (`github`, `context7`, `sequential-thinking`, `playwright`)
- A memory-file convention (`AGENTS.md` + an empty `memory/` directory + `MEMORY.md` index)

Full details, including every gotcha that shaped these choices, are in
[`docs/REFERENCE.md`](docs/REFERENCE.md).

## What it does NOT do

- **Never silently overwrites anything.** Any existing file at a target path
  is renamed to a timestamped `.bak` before a new one is written.
- **Never writes your GitHub token to disk.** If you give one, it's only
  referenced in the generated config as `{env:GITHUB_TOKEN}`; the raw value
  is never persisted anywhere by this tool.
- **Never touches your shell profile or the registry without asking first.**
  If you provide a token, you're asked separately whether to persist it
  automatically (`setx` on Windows, appending to your shell profile on
  macOS/Linux) or have the exact command printed for you to run yourself
  instead. Declining changes nothing on your system.
- **Doesn't phone home.** Everything happens locally against your own
  filesystem and your own `opencode` CLI.

## Prerequisites

- Node.js >= 18
- `opencode` CLI on `PATH`
- Optional: a GitHub personal access token, if you want the GitHub MCP server

## Prompts you'll see

1. Confirm or override the target directory (defaults to `~/.config/opencode`)
2. GitHub personal access token (optional -- blank skips the GitHub MCP server)
3. If a token was given: whether to persist it automatically or just print the command
4. Default model and small model, each validated live against `opencode models`
5. TUI theme name (no live validation exists for this one)
6. Which plugins to include (all on by default)
7. Which MCP servers to include (all on by default, minus GitHub if no token was given)
8. A final recap and yes/no confirmation -- **nothing is written to disk, and no environment variable is touched, before this point**

After that: files are written (with backups as needed), `npm install` runs
if any plugin needing dependencies was selected, then `opencode debug config`
and `opencode mcp list` run so you can see whether everything resolved
cleanly before the script exits.

## After install

One thing can't be automated: open the interactive `opencode` TUI once and
check for a red "Failed to load plugin" banner in a fresh session.
`opencode debug config` can't detect a TUI plugin that's failing to load --
that one has to be eyeballed.

## Rollback

Every backup is a plain renamed file sitting next to the one that replaced
it (e.g. `opencode.jsonc.2026-07-23T12-00-00Z.bak`). To roll back a single
file, delete the new one and rename the `.bak` back to its original name.
There's no automated rollback command.

## Customizing after install

Everything generated is a plain, unlocked file -- edit `opencode.jsonc`,
`tui.json`, any agent/skill/plugin file, exactly as you would if you'd
written it by hand.

## Contributing

`templates/` maps 1:1 to the file list documented in `docs/REFERENCE.md` --
if you change one, update the other so they don't drift apart.

## License

MIT
