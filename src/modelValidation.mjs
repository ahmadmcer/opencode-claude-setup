import { shellExec } from "./shellExec.mjs";

// Known OpenCode models, used as a fallback when `opencode models` only returns
// models available to the user's current subscription tier. Kept in sync with
// the model catalog at https://opencode.ai/docs/providers.
export const KNOWN_MODELS = [
  // OpenAI / GPT
  "opencode/gpt-5.6-sol", "opencode/gpt-5.6-terra", "opencode/gpt-5.6-luna",
  "opencode/gpt-5.5", "opencode/gpt-5.5-pro",
  "opencode/gpt-5.4", "opencode/gpt-5.4-pro", "opencode/gpt-5.4-mini", "opencode/gpt-5.4-nano",
  "opencode/gpt-5.3-codex", "opencode/gpt-5.3-codex-spark",
  "opencode/gpt-5.2", "opencode/gpt-5.2-codex",
  "opencode/gpt-5.1", "opencode/gpt-5.1-codex", "opencode/gpt-5.1-codex-max", "opencode/gpt-5.1-codex-mini",
  "opencode/gpt-5", "opencode/gpt-5-codex", "opencode/gpt-5-nano",

  // Claude
  "opencode/claude-fable-5",
  "opencode/claude-opus-4-8", "opencode/claude-opus-4-7", "opencode/claude-opus-4-6", "opencode/claude-opus-4-5",
  "opencode/claude-sonnet-5", "opencode/claude-sonnet-4-6", "opencode/claude-sonnet-4-5",
  "opencode/claude-haiku-4-5",

  // Gemini
  "opencode/gemini-3.6-flash", "opencode/gemini-3.5-flash", "opencode/gemini-3.5-flash-lite",
  "opencode/gemini-3.1-pro", "opencode/gemini-3-flash",

  // Grok
  "opencode/grok-4.5", "opencode/grok-build-0.1",

  // Qwen
  "opencode/qwen3.7-max", "opencode/qwen3.7-plus",
  "opencode/qwen3.6-plus", "opencode/qwen3.5-plus",

  // DeepSeek
  "opencode/deepseek-v4-pro", "opencode/deepseek-v4-flash", "opencode/deepseek-v4-flash-free",

  // MiniMax
  "opencode/minimax-m3", "opencode/minimax-m2.7", "opencode/minimax-m2.5",

  // GLM
  "opencode/glm-5.2", "opencode/glm-5.1", "opencode/glm-5",

  // Kimi
  "opencode/kimi-k2.5", "opencode/kimi-k2.6", "opencode/kimi-k2.7-code",

  // Free-tier
  "opencode/big-pickle", "opencode/mimo-v2.5-free", "opencode/laguna-s-2.1-free",
  "opencode/north-mini-code-free", "opencode/nemotron-3-ultra-free",

  // OpenCode Go (subscription)
  "opencode-go/grok-4.5",
  "opencode-go/glm-5.2", "opencode-go/glm-5.1",
  "opencode-go/kimi-k3", "opencode-go/kimi-k2.7-code", "opencode-go/kimi-k2.6",
  "opencode-go/mimo-v2.5", "opencode-go/mimo-v2.5-pro",
  "opencode-go/minimax-m3", "opencode-go/minimax-m2.7", "opencode-go/minimax-m2.5",
  "opencode-go/qwen3.7-max", "opencode-go/qwen3.7-plus", "opencode-go/qwen3.6-plus",
  "opencode-go/deepseek-v4-pro", "opencode-go/deepseek-v4-flash",

  // GitHub Copilot
  "github-copilot/claude-fable-5", "github-copilot/claude-haiku-4.5",
];

// `opencode models` prints one bare `provider/model` id per line, no header.
// Merges the live list with the known-model fallback so validation passes for
// models the user's current subscription doesn't have access to yet.
export function listModels() {
  let out;
  try {
    out = shellExec("opencode", ["models"]);
  } catch (err) {
    throw new Error(
      `Could not list models (${err.message}). Is the opencode CLI installed and on PATH?`
    );
  }
  const live = out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...live, ...KNOWN_MODELS])];
}
