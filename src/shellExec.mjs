import { execSync } from "node:child_process";

// Only plain identifier-ish tokens are allowed as arguments here (see the
// guard below) -- every current call site is a static, hardcoded string
// ("--version", "models", "debug", "config", ...), never anything derived
// from user input. Dynamic values (like a user-chosen target directory)
// must go through the `cwd` option instead, never through `args`.
const SAFE_ARG = /^[A-Za-z0-9._-]+$/;

function buildCommand(cmd, args) {
  for (const a of args) {
    if (!SAFE_ARG.test(a)) {
      throw new Error(
        `Refusing to shell out with unsafe-looking argument "${a}" -- pass dynamic values via the cwd option, not args.`
      );
    }
  }
  return [cmd, ...args].join(" ");
}

// A single pre-built command string via execSync, rather than execFileSync
// with a separate args array, deliberately avoids Node's shell:true +
// args-array combination entirely -- that combination is what triggers
// DEP0190 (arguments only concatenated, not escaped) regardless of whether
// the specific arguments happen to be safe. The guard above is what
// actually keeps this safe; execSync alone would not be.
export function shellExec(cmd, args, opts = {}) {
  try {
    return execSync(buildCommand(cmd, args), { encoding: "utf8", ...opts });
  } catch (err) {
    throw new Error(`Failed running \`${cmd} ${args.join(" ")}\`: ${err.message}`);
  }
}

export function shellExecInherit(cmd, args, opts = {}) {
  execSync(buildCommand(cmd, args), { stdio: "inherit", ...opts });
}
