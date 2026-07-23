// Zero-dependency prompt primitives built on node:readline -- deliberately
// no `inquirer`/`prompts` package, since this is a bootstrap script and
// should have no install friction of its own.
//
// IMPORTANT: does NOT use readline's `question()` method. Calling
// `question()` repeatedly in sequence on a non-TTY (piped/redirected)
// stdin is a documented Node.js footgun -- if multiple lines arrive in one
// buffered chunk (which any pipe naturally does), the 'line' events for
// answers beyond the first can fire before the next question() call has
// registered its listener, silently dropping them and hanging forever on
// an "unsettled await". Consuming the interface via its async iterator
// instead queues every line safely regardless of arrival timing, and
// works identically for real interactive typing.

export function createPrompter(rl) {
  const it = rl[Symbol.asyncIterator]();
  async function rawLine(label) {
    process.stdout.write(label);
    const { value, done } = await it.next();
    return done ? "" : value;
  }
  return { rawLine };
}

export async function promptText(prompter, question, { default: def, validate } = {}) {
  while (true) {
    const label = def ? `${question} [${def}]: ` : `${question}: `;
    const raw = (await prompter.rawLine(label)).trim();
    const value = raw || def || "";
    if (!validate) return value;
    const result = validate(value);
    if (result.ok) return value;
    console.log(`  x ${result.message}`);
  }
}

export async function promptYesNo(prompter, question, defaultYes = true) {
  const suffix = defaultYes ? "[Y/n]" : "[y/N]";
  while (true) {
    const raw = (await prompter.rawLine(`${question} ${suffix}: `)).trim().toLowerCase();
    if (raw === "") return defaultYes;
    if (raw === "y" || raw === "yes") return true;
    if (raw === "n" || raw === "no") return false;
    console.log("  Please answer y or n.");
  }
}

// Presents a numbered list and asks which to EXCLUDE (Enter = include all).
// items: [{ id, label, desc }]. Returns the array of included ids.
export async function promptExcludeList(prompter, question, items) {
  for (const [i, item] of items.entries()) {
    console.log(`  ${i + 1}. ${item.label} -- ${item.desc}`);
  }
  const raw = await prompter.rawLine(
    `${question} (numbers to EXCLUDE, comma-separated, Enter = include all): `
  );
  const excluded = new Set(
    raw
      .split(",")
      .map((s) => parseInt(s.trim(), 10) - 1)
      .filter((n) => !Number.isNaN(n))
  );
  return items.filter((_, i) => !excluded.has(i)).map((item) => item.id);
}
