import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { backupIfExists } from "./backup.mjs";

const EXPORT_LINE_RE = /^export GITHUB_TOKEN=.*$/m;

function posixProfilePath() {
  const shell = process.env.SHELL || "";
  if (shell.includes("zsh")) return path.join(homedir(), ".zshrc");
  if (shell.includes("bash")) return path.join(homedir(), ".bashrc");
  return path.join(homedir(), ".profile");
}

// Windows: setx.exe is a real standalone executable (not a shell builtin),
// so this runs without `shell: true` -- no argument-escaping concerns at
// all here, unlike anywhere this codebase actually needs shell:true for
// .cmd-shimmed binaries. Persists to the User registry hive; only takes
// effect in a NEW process, same limitation as if the user ran it by hand.
function persistWindows(token) {
  execFileSync("setx", ["GITHUB_TOKEN", token], { encoding: "utf8" });
  return { method: "setx", detail: "User environment variable (registry)" };
}

// macOS/Linux: no registry equivalent -- append (or replace, if already
// present from a previous run of this installer) an export line in the
// user's shell profile. Backed up first, since this is an existing,
// actively-used file we don't own, unlike everything else this installer
// writes.
function persistPosix(token) {
  const profilePath = posixProfilePath();
  const line = `export GITHUB_TOKEN="${token}"`;
  let content = existsSync(profilePath) ? readFileSync(profilePath, "utf8") : "";

  if (existsSync(profilePath)) backupIfExists(profilePath);

  if (EXPORT_LINE_RE.test(content)) {
    content = content.replace(EXPORT_LINE_RE, line);
  } else {
    const sep = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
    content = `${content}${sep}${line}\n`;
  }
  writeFileSync(profilePath, content, "utf8");
  return { method: "profile", detail: profilePath };
}

// Returns { ok: true, method, detail } on success, or { ok: false, error }
// on failure -- caller falls back to printing the manual command either way.
export function persistGithubToken(token) {
  try {
    const result = process.platform === "win32" ? persistWindows(token) : persistPosix(token);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
