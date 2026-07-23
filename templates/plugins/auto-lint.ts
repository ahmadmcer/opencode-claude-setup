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
