import { shellExec, shellExecInherit } from "./shellExec.mjs";

export function runNpmInstall(targetDir) {
  console.log("\nRunning npm install (this may take a moment)...");
  // --prefix rather than process.chdir, so the installer's own cwd is never mutated.
  // stdio inherited (not captured) so a multi-second install doesn't look hung.
  shellExecInherit("npm", ["install", "--prefix", targetDir]);
}

// Non-fatal either way -- by the time this runs, every file is already on
// disk, so a resolution failure here is just diagnostic, not something to
// roll back over.
export function verifyConfig(targetDir, answers) {
  let parsed;
  try {
    const out = shellExec("opencode", ["debug", "config"], { cwd: targetDir });
    parsed = JSON.parse(out);
  } catch (err) {
    console.log(`\nConfig did not resolve cleanly:\n  ${err.message}`);
    console.log("Files were already written -- re-run `opencode debug config` manually after investigating.");
    return false;
  }

  const checks = [
    ["model", parsed.model === answers.model],
    ["small_model", parsed.small_model === answers.smallModel],
  ];
  for (const mcpName of answers.mcp) {
    checks.push([`mcp.${mcpName}.enabled`, parsed.mcp?.[mcpName]?.enabled === true]);
  }

  console.log("\nConfig verification (opencode debug config):");
  let allOk = true;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? "OK" : "FAIL"}  ${label}`);
    if (!ok) allOk = false;
  }
  return allOk;
}

export function listMcpStatus(targetDir) {
  console.log("\nMCP server status (opencode mcp list):");
  try {
    shellExecInherit("opencode", ["mcp", "list"], { cwd: targetDir });
  } catch (err) {
    console.log(`  Could not check MCP status: ${err.message}`);
  }
}
