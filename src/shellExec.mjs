import { execFileSync } from "node:child_process";

// `shell: true` is required on Windows because the global `opencode`/`npm`
// binaries resolve as .cmd shims, which execFileSync cannot invoke directly
// without going through a shell. Harmless on macOS/Linux, so applied
// uniformly rather than branching on process.platform at every call site.
export function shellExec(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", shell: true, ...opts });
  } catch (err) {
    throw new Error(`Failed running \`${cmd} ${args.join(" ")}\`: ${err.message}`);
  }
}

export function shellExecInherit(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: "inherit", shell: true, ...opts });
}
