---
name: security-review
description: Review pending code changes for security vulnerabilities (OWASP-style)
---
## What I do
- Review the diff (not the whole repo) for injection (SQL/command/XSS), auth/authz gaps,
  secrets committed to the repo, unsafe deserialization, and path traversal
- For each finding: file, line, concrete exploit scenario, and severity
- Distinguish exploitable vulnerabilities from theoretical/defense-in-depth suggestions
- Skip findings that require an already-compromised environment to matter

## When to use me
Use before merging changes that touch auth, input handling, file/network I/O, or dependencies.
Pair with the `dependency-audit` skill for supply-chain/outdated-package concerns.
