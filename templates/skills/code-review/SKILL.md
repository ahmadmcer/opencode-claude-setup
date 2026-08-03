---
name: code-review
description: Review a git diff, PR, branch, or uncommitted changes for correctness regressions, unnecessary complexity, and missing tests before merge.
---

# Code Review

Use this skill for requests like "review this diff", "review my PR", "check before merge", "look at my uncommitted changes", or "is this change safe?" Scope the review to changed code unless the user explicitly asks for a broader audit.

## Workflow

1. Identify the review target: current uncommitted diff, branch diff, provided PR, commit range, or specific files.
2. Inspect the changed code and nearby context needed to understand behavior. Do not review unrelated files just because they are interesting.
3. Check for correctness regressions first: wrong outputs, broken state transitions, race conditions, error handling gaps, data loss, compatibility breaks, and edge cases introduced by the change.
4. Check whether tests cover the new or changed behavior. Prefer specific missing test cases over generic "add tests" comments.
5. Look for simplifications only when the changed code adds needless abstraction, duplicate logic, misleading names, or avoidable coupling.
6. Discard speculative findings that do not have a concrete failure scenario.

## Finding Standard

Each finding must include:

- Severity: `critical`, `high`, `medium`, or `low`.
- Location: file and line or smallest relevant range.
- Problem: what is wrong in the changed behavior.
- Failure scenario: concrete inputs, state, or sequence that triggers the issue.
- Fix direction: the smallest practical correction.

## Output Format

Start with findings, ordered by severity. If there are no findings, say so explicitly and mention residual risks such as unrun tests, inaccessible CI, or missing runtime context.

Use this shape:

```markdown
Findings
- [severity] path:line - Problem. Failure scenario. Fix direction.

Open Questions
- Any assumptions that affect the review.

Verification
- Commands, checks, or evidence used. Note anything not run.
```

## Guardrails

- Do not praise or summarize before findings.
- Do not report style-only preferences unless they hide a bug or maintenance risk.
- Do not request large rewrites when a small fix is enough.
- Do not review generated, vendored, lockfile, or migration output line-by-line unless the change depends on it.
