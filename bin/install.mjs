#!/usr/bin/env node
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import { createPrompter, promptText, promptYesNo, promptExcludeList } from "../src/prompts.mjs";
import { backupIfExists } from "../src/backup.mjs";
import { listModels } from "../src/modelValidation.mjs";
import { shellExec } from "../src/shellExec.mjs";
import { defaultTargetDir, resolveTargetDir } from "../src/paths.mjs";
import { buildOpencodeConfig, buildTuiConfig, buildPackageJson, toFileContent } from "../src/render.mjs";
import { copyFile } from "../src/copyStatic.mjs";
import { runNpmInstall, verifyConfig, listMcpStatus } from "../src/verify.mjs";
import { persistGithubToken } from "../src/tokenPersist.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const TEMPLATES = path.join(REPO_ROOT, "templates");

const PLUGIN_UNITS = [
  { id: "notification", label: "notification", desc: "Webhook (Slack/Discord) on session lifecycle events" },
  { id: "auto-lint", label: "auto-lint", desc: "Runs the project's linter after every edit/write" },
  { id: "checkpoint", label: "checkpoint", desc: "Lets the agent bookmark/recall named points in a session" },
  { id: "token-usage", label: "token-usage", desc: "Sidebar panel showing per-session token usage and cost (server + TUI pair)" },
  { id: "go-usage", label: "go-usage", desc: "Sidebar panel showing OpenCode Go usage limits (TUI only)" },
];

const MCP_UNITS = [
  { id: "github", label: "github", desc: "GitHub MCP server (remote, needs a token)" },
  { id: "context7", label: "context7", desc: "Hosted docs/library lookup (remote, no auth needed)" },
  { id: "sequential-thinking", label: "sequential-thinking", desc: "Local, via npx" },
  { id: "playwright", label: "playwright", desc: "Browser automation, local via npx" },
];

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  const prompter = createPrompter(rl);

  console.log("opencode-claude-setup");
  console.log("Configures OpenCode to behave like Claude Code: subagents, skills,");
  console.log("plugins, MCP servers, and a memory-file convention.\n");
  console.log("Any existing file at a target path is renamed to a timestamped .bak");
  console.log("before anything is written -- nothing is ever silently overwritten.\n");

  try {
    shellExec("opencode", ["--version"]);
  } catch {
    console.log("Could not find the opencode CLI on PATH.");
    console.log("Install it first: npm install -g opencode-ai");
    rl.close();
    process.exit(1);
  }

  const answers = {};

  // --- target directory ---
  const defaultDir = defaultTargetDir();
  const useDefault = await promptYesNo(prompter, `Install to ${defaultDir}?`, true);
  const targetDir = useDefault
    ? defaultDir
    : resolveTargetDir(await promptText(prompter, "Target directory"));

  // --- GitHub token (optional) ---
  console.log("\nGitHub PAT is optional -- leave blank to skip the GitHub MCP server entirely.");
  console.log("It is never written to any generated file; only referenced as {env:GITHUB_TOKEN}.");
  const githubToken = await promptText(prompter, "GitHub personal access token");
  answers.githubToken = githubToken || null;

  answers.persistToken = false;
  if (answers.githubToken) {
    console.log(
      process.platform === "win32"
        ? "\nThis can set it as a persistent User environment variable via `setx` now,"
        : "\nThis can append it to your shell profile (~/.bashrc, ~/.zshrc, or ~/.profile) now,"
    );
    console.log("so you don't have to run a command yourself. Declining just prints the");
    console.log("command instead and changes nothing on your system.");
    answers.persistToken = await promptYesNo(prompter, "Persist GITHUB_TOKEN now?", true);
  }

  // --- model / small_model, validated live ---
  console.log("\nFetching available models (opencode models)...");
  let models;
  try {
    models = listModels();
  } catch (err) {
    console.log(`  ${err.message}`);
    rl.close();
    process.exit(1);
  }
  const modelValidator = (v) =>
    models.includes(v)
      ? { ok: true }
      : { ok: false, message: `Not a known model id. First few available: ${models.slice(0, 8).join(", ")}` };

  answers.model = await promptText(prompter, "\nDefault model (provider/model)", {
    default: models.includes("opencode/deepseek-v4-flash-free") ? "opencode/deepseek-v4-flash-free" : models[0],
    validate: modelValidator,
  });
  answers.smallModel = await promptText(prompter, "Small model (used for e.g. title generation)", {
    default: answers.model,
    validate: modelValidator,
  });

  // --- theme ---
  console.log("\nNo live validation exists for theme names -- an invalid one just falls back");
  console.log("silently to the default and can be changed later via the in-app theme picker.");
  answers.theme = await promptText(prompter, "TUI theme", { default: "catppuccin-mocha" });

  // --- plugins ---
  console.log("\nWhich plugins to include:");
  const includedPlugins = await promptExcludeList(prompter, "Plugins", PLUGIN_UNITS);
  answers.plugins = new Set(includedPlugins);

  // --- MCP servers ---
  console.log("\nWhich MCP servers to include:");
  let mcpChoices = MCP_UNITS;
  if (!answers.githubToken) {
    console.log("  github -- disabled, no token given");
    mcpChoices = MCP_UNITS.filter((u) => u.id !== "github");
  }
  const includedMcp = await promptExcludeList(prompter, "MCP servers", mcpChoices);
  answers.mcp = new Set(includedMcp);

  // --- recap + confirm ---
  console.log("\n--- Recap ---");
  console.log(`Target directory : ${targetDir}`);
  console.log(`Default model    : ${answers.model}`);
  console.log(`Small model      : ${answers.smallModel}`);
  console.log(`Theme            : ${answers.theme}`);
  console.log(`Plugins          : ${[...answers.plugins].join(", ") || "(none)"}`);
  console.log(`MCP servers      : ${[...answers.mcp].join(", ") || "(none)"}`);
  console.log(`GitHub token     : ${answers.githubToken ? "given" : "not given"}`);
  if (answers.githubToken) {
    console.log(`Persist token    : ${answers.persistToken ? "yes, automatically" : "no, print the command instead"}`);
  }

  const proceed = await promptYesNo(prompter, "\nProceed and write these files?", true);
  rl.close();
  if (!proceed) {
    console.log("Aborted -- nothing was written.");
    return;
  }

  // --- write files ---
  const backedUp = [];
  const written = [];

  function writeGenerated(destPath, content) {
    mkdirSync(path.dirname(destPath), { recursive: true });
    const backup = backupIfExists(destPath);
    if (backup) backedUp.push(backup);
    writeFileSync(destPath, content, "utf8");
    written.push(destPath);
  }

  writeGenerated(path.join(targetDir, "opencode.jsonc"), toFileContent(buildOpencodeConfig(answers)));
  writeGenerated(path.join(targetDir, "tui.json"), toFileContent(buildTuiConfig(answers)));

  // MEMORY.md is a static template (empty index), not generated -- copy it directly.
  {
    const dest = path.join(targetDir, "MEMORY.md");
    const backup = copyFile(path.join(TEMPLATES, "MEMORY.md"), dest);
    if (backup) backedUp.push(backup);
    written.push(dest);
  }

  const packageJsonContent = buildPackageJson(answers);
  let needsNpmInstall = false;
  if (packageJsonContent) {
    const packageJsonPath = path.join(targetDir, "package.json");
    const backup = backupIfExists(packageJsonPath);
    if (backup) backedUp.push(backup);
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(packageJsonPath, toFileContent(packageJsonContent), "utf8");
    written.push(packageJsonPath);
    needsNpmInstall = true;
  }

  // AGENTS.md -- always included, static
  {
    const backup = copyFile(path.join(TEMPLATES, "AGENTS.md"), path.join(targetDir, "AGENTS.md"));
    if (backup) backedUp.push(backup);
    written.push(path.join(targetDir, "AGENTS.md"));
  }

  // agents/*.md -- always included, static
  for (const name of ["review", "security-audit", "explore", "docs", "debug", "coordinator"]) {
    const dest = path.join(targetDir, "agents", `${name}.md`);
    const backup = copyFile(path.join(TEMPLATES, "agents", `${name}.md`), dest);
    if (backup) backedUp.push(backup);
    written.push(dest);
  }

  // skills/*/SKILL.md -- always included, static
  for (const name of ["code-review", "dependency-audit", "security-review", "git-release"]) {
    const dest = path.join(targetDir, "skills", name, "SKILL.md");
    const backup = copyFile(path.join(TEMPLATES, "skills", name, "SKILL.md"), dest);
    if (backup) backedUp.push(backup);
    written.push(dest);
  }

  // plugins/*.ts -- only the ones the user selected
  const pluginFiles = {
    notification: ["notification.ts"],
    "auto-lint": ["auto-lint.ts"],
    checkpoint: ["checkpoint.ts"],
    "token-usage": ["token-usage-server.ts", "token-usage-tui.ts"],
    "go-usage": ["go-usage-tui.ts"],
  };
  for (const id of answers.plugins) {
    for (const file of pluginFiles[id]) {
      const dest = path.join(targetDir, "plugins", file);
      const backup = copyFile(path.join(TEMPLATES, "plugins", file), dest);
      if (backup) backedUp.push(backup);
      written.push(dest);
    }
  }

  // empty memory/ directory, never touching any pre-existing personal content
  mkdirSync(path.join(targetDir, "memory"), { recursive: true });

  // --- npm install (only if any plugin needing @opencode-ai/plugin was selected) ---
  if (needsNpmInstall) {
    runNpmInstall(targetDir);
  } else {
    console.log("\nNo plugins selected -- skipping npm install (nothing to install).");
  }

  // --- persist GITHUB_TOKEN, if the user opted in (deferred until after the
  // Proceed? gate, same as every other side effect in this script) ---
  let persistResult = null;
  if (answers.githubToken && answers.persistToken) {
    persistResult = persistGithubToken(answers.githubToken);
  }

  // --- verification ---
  verifyConfig(targetDir, answers);
  if (answers.githubToken) {
    console.log(
      "\nNote: even if GITHUB_TOKEN was just persisted, it isn't set in THIS terminal's"
    );
    console.log(
      "environment yet -- the github server below will likely show as failed to connect."
    );
    console.log("That's expected, not a problem. It'll connect once you open a new terminal.");
  }
  listMcpStatus(targetDir);

  // --- final reminders ---
  console.log("\n--- Done ---");
  console.log(`Files written (${written.length}):`);
  for (const f of written) console.log(`  ${f}`);
  if (backedUp.length) {
    console.log(`\nExisting files backed up (${backedUp.length}):`);
    for (const b of backedUp) console.log(`  ${b}`);
  }

  if (answers.githubToken) {
    if (persistResult?.ok) {
      console.log(`\nGITHUB_TOKEN persisted (${persistResult.detail}).`);
      console.log("Open a NEW terminal for it to take effect.");
    } else {
      if (persistResult && !persistResult.ok) {
        console.log(`\nCould not persist GITHUB_TOKEN automatically (${persistResult.error}).`);
      }
      console.log("\nSet GITHUB_TOKEN yourself:");
      if (process.platform === "win32") {
        console.log(`  [Environment]::SetEnvironmentVariable("GITHUB_TOKEN", "${answers.githubToken}", "User")`);
        console.log("  (run in PowerShell, then open a NEW terminal for it to take effect)");
      } else {
        console.log(`  export GITHUB_TOKEN="${answers.githubToken}"`);
        console.log("  (add this line to ~/.bashrc / ~/.zshrc / ~/.profile to persist it)");
      }
    }
  }

  console.log("\nLast step (can't be automated): open the interactive `opencode` TUI once and");
  console.log("check for a red 'Failed to load plugin' banner in a fresh session --");
  console.log("`opencode debug config` cannot detect a failing TUI plugin load.");
}

main().catch((err) => {
  console.error(`\nInstall failed: ${err.message}`);
  process.exit(1);
});
