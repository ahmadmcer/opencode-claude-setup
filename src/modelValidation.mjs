import { shellExec } from "./shellExec.mjs";

// `opencode models` prints one bare `provider/model` id per line, no header.
export function listModels() {
  let out;
  try {
    out = shellExec("opencode", ["models"]);
  } catch (err) {
    throw new Error(
      `Could not list models (${err.message}). Is the opencode CLI installed and on PATH?`
    );
  }
  return out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}
