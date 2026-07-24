# AGENTS.md - Global Instructions

## Coding Standards
- Follow existing code style and conventions in each project
- Use TypeScript with strict types when possible
- Write tests alongside implementation code
- Use async/await over raw promises
- Prefer functional patterns over classes unless OOP is established

## Workflow
1. Read relevant files to understand context before making changes
2. Plan the approach first
3. Run tests after changes to verify nothing is broken
4. Use conventional commits format: `type(scope): description`
5. **Git messages: never break lines manually.** Let the body text flow naturally at paragraph width. Do not insert hard line breaks mid-sentence or mid-paragraph — only blank lines between sections.

## Security
- Never commit secrets, API keys, or credentials
- Never read .env files or expose their contents
- Flag any hardcoded credentials found
- Use parameterized queries for database operations

## Communication
- Be concise and direct
- Explain tradeoffs when presenting options
- Show code examples when suggesting changes
- Ask clarifying questions when requirements are ambiguous

## Tool Usage
- Use glob/grep for codebase exploration before reading files
- Use websearch for external docs and API references
- Use MCP tools (github, context7, sequential-thinking, playwright) when relevant
- Use the `explore` subagent for read-only codebase search instead of doing broad greps yourself

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
```
---
name: kebab-case-slug
description: one-line summary for relevance matching
type: user|feedback|project|reference
---
```
For `feedback`/`project` entries, structure the body as: the rule/fact, then a `**Why:**` line
(the reason given, e.g. a past incident) and a `**How to apply:**` line (when this should kick in).
Link related memories with `[[slug]]`. Then add one line to `MEMORY.md`: `- [Title](memory/slug.md) — hook`.

**Before acting on a recalled memory** that names a specific file/function/flag, verify it still
exists (grep/read) — it may be stale. Prefer current repo state over a frozen memory snapshot when
they conflict, and update or delete the memory file at that point.
