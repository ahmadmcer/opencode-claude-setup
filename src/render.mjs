// Builds opencode.jsonc / tui.json / package.json as plain JS objects and
// JSON.stringify's them, rather than text-splicing JSONC strings. The JSONC
// comments in docs/REFERENCE.md are illustrative for humans -- valid JSON is
// valid JSONC, so this loses nothing, and avoids trailing-comma bugs from
// conditionally including/excluding MCP servers or plugin entries.

const ALWAYS_PERMISSION_BASH = {
  "*": "ask",
  "git *": "allow",
  "npm *": "allow",
  "bun *": "allow",
  "pnpm *": "allow",
  "yarn *": "allow",
  "cargo *": "allow",
  "go *": "allow",
  ls: "allow",
  "cat *": "allow",
};

const COMMANDS = {
  test: {
    template:
      "Run the full test suite and fix any failures.\nFocus on the failing tests and suggest fixes.",
    description: "Run tests and fix failures",
    agent: "build",
  },
  commit: {
    template:
      "Stage all changes, create a descriptive commit message, and commit.\nUse conventional commits format.",
    description: "Stage and commit changes",
    agent: "build",
  },
  review: {
    template:
      "Review the current uncommitted changes for code quality, potential bugs, and security issues.",
    description: "Review current changes",
    agent: "review",
  },
  fix: {
    template: "Find and fix all lint errors in the project.",
    description: "Fix lint errors across the project",
    agent: "build",
  },
  pr: {
    template:
      "Create a pull request with the current branch changes.\nWrite a descriptive title and body.",
    description: "Create a PR from current branch",
    agent: "build",
  },
  audit: {
    template:
      "Audit project dependencies for security vulnerabilities and outdated packages.\nSuggest specific updates.",
    description: "Audit dependencies",
    agent: "security-audit",
  },
  summarize: {
    template: "Summarize the recent git log changes and create a changelog entry.",
    description: "Summarize recent changes",
    agent: "docs",
  },
  explore: {
    template:
      "Search the codebase to answer: $ARGUMENTS\nLocate the relevant files and code, then report file paths and line numbers. Do not make edits.",
    description: "Fast read-only codebase search",
    agent: "explore",
  },
  init: {
    template:
      "Analyze this codebase and generate/update AGENTS.md with: build/lint/test commands, code style conventions, and any repo-specific rules a new agent session would need. Keep it concise.",
    description: "Bootstrap or refresh AGENTS.md from the codebase",
    agent: "build",
  },
};

function buildMcp(includedMcp) {
  const mcp = {};
  if (includedMcp.has("github")) {
    mcp.github = {
      type: "remote",
      url: "https://api.githubcopilot.com/mcp/",
      enabled: true,
      oauth: false,
      headers: { Authorization: "Bearer {env:GITHUB_TOKEN}" },
    };
  }
  if (includedMcp.has("context7")) {
    mcp.context7 = { type: "remote", url: "https://mcp.context7.com/mcp", enabled: true };
  }
  if (includedMcp.has("sequential-thinking")) {
    mcp["sequential-thinking"] = {
      type: "local",
      command: ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
      enabled: true,
    };
  }
  if (includedMcp.has("playwright")) {
    mcp.playwright = {
      type: "local",
      command: ["npx", "-y", "@playwright/mcp@latest"],
      enabled: true,
    };
  }
  return mcp;
}

export function buildOpencodeConfig(answers) {
  return {
    $schema: "https://opencode.ai/config.json",
    model: answers.model,
    small_model: answers.smallModel,
    lsp: {},
    formatter: {},
    autoupdate: true,
    share: "manual",
    compaction: { auto: true, prune: true },
    permission: {
      edit: "ask",
      bash: ALWAYS_PERMISSION_BASH,
      glob: "allow",
      grep: "allow",
      read: "allow",
      list: "allow",
    },
    mcp: buildMcp(answers.mcp),
    command: COMMANDS,
    agent: {
      build: {
        permission: {
          edit: "ask",
          bash: ALWAYS_PERMISSION_BASH,
          glob: "allow",
          grep: "allow",
          read: "allow",
          list: "allow",
        },
      },
      plan: {
        permission: {
          edit: "deny",
          bash: "deny",
          glob: "allow",
          grep: "allow",
          read: "allow",
          list: "allow",
        },
      },
    },
  };
}

export function buildTuiConfig(answers) {
  // Hardcoded literal forward slash -- this string is consumed by opencode's
  // own resolver, not Node's fs. Never run through path.join/path.resolve,
  // which would emit backslashes on Windows and could break the import.
  const plugin = answers.plugins.has("token-usage") ? ["./plugins/token-usage-tui.ts"] : [];

  return {
    $schema: "https://opencode.ai/tui.json",
    theme: answers.theme,
    attention: { enabled: true, notifications: true, sound: true, volume: 0.4 },
    diff_style: "auto",
    mouse: true,
    keybinds: {
      help: "ctrl+p",
      sessions: "ctrl+o",
      share: "ctrl+y",
      agent_list: "ctrl+e",
      send_mode: ["tab", "tab"],
      adopt_subagent: "cmd+enter",
      compaction: "ctrl+b",
      import: "ctrl+i",
      export: "ctrl+x",
      fs_edit: "ctrl+s",
      bash: "ctrl+j",
      formatters: "ctrl+f",
      toggler: "ctrl+t",
    },
    plugin,
  };
}

// Returns null if no plugins were selected -- package.json (and its
// @opencode-ai/plugin dependency, used only for plugin-file typings) would
// be dead weight with nothing in plugins/ to import it.
export function buildPackageJson(answers) {
  if (answers.plugins.size === 0) return null;
  // Exact pins, not ranges: this combination (@opencode-ai/plugin 1.14.48 +
  // @opentui/* 0.2.6) is the specific set verified working together. A
  // caret range on @opencode-ai/plugin lets npm resolve a newer release
  // whose peer dependency on @opentui/solid has since moved to >=0.4.5,
  // producing an ERESOLVE conflict against the pinned 0.2.6 below.
  const dependencies = { "@opencode-ai/plugin": "1.14.48" };
  if (answers.plugins.has("token-usage")) {
    dependencies["@opentui/core"] = "0.2.6";
    dependencies["@opentui/keymap"] = "0.2.6";
    dependencies["@opentui/solid"] = "0.2.6";
  }
  return { dependencies };
}

export function toFileContent(obj) {
  return JSON.stringify(obj, null, 2) + "\n";
}
