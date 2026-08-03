---
name: security-review
description: Review a diff or PR for exploitable security vulnerabilities in auth, input handling, file/network I/O, secrets, logging, dependencies, and OWASP-style risks before merge.
---

# Security Review

Use this skill for requests like "security review this diff", "check this PR for vulnerabilities", "review auth changes", "is this input handling safe?", or before merging changes that touch authentication, authorization, parsing, uploads, filesystem access, networking, templates, secrets, logging, crypto, or dependencies.

## Workflow

1. Identify the changed trust boundaries: user input, external services, webhooks, files, environment variables, database records, queues, and privileged internal APIs.
2. Trace attacker-controlled data to sensitive sinks: SQL, shell commands, templates/HTML, redirects, SSRF-capable HTTP clients, filesystem paths, deserializers, logs, auth decisions, and secret material.
3. Check authorization separately from authentication. A valid user can still be an attacker if object ownership, tenant isolation, role checks, or admin boundaries are missing.
4. Confirm exploitability before reporting. A finding needs attacker control, a reachable path, and a meaningful impact.
5. Prefer the smallest safe mitigation: parameterization, allowlists, canonicalization, output encoding, permission checks, safer defaults, secret removal, or narrower scope.
6. Pair with `dependency-audit` when the main risk is vulnerable packages, lockfiles, or supply-chain exposure.

## Review Checklist

- Injection: SQL, NoSQL, command, LDAP, template, expression language, and header injection.
- Web: XSS, CSRF, open redirects, CORS mistakes, SSRF, request smuggling assumptions, unsafe cookies.
- Auth/authz: missing checks, confused deputies, tenant breakout, IDOR, privilege escalation, insecure password/session flows.
- Files and paths: traversal, unsafe archive extraction, upload validation, symlink handling, executable writes.
- Data protection: hardcoded secrets, secret logging, PII leakage, weak crypto, token exposure.
- Deserialization and parsing: unsafe object loading, YAML/XML/entity expansion, parser differentials.
- Operations: debug endpoints, unsafe defaults, overly broad permissions, missing rate limits where abuse impact is clear.

## Severity Rubric

- `critical`: remote unauthenticated compromise, credential theft, major data breach, or destructive action at scale.
- `high`: authenticated privilege escalation, tenant isolation break, reliable injection, secret exposure, or meaningful data modification.
- `medium`: constrained exploit with real impact, limited data exposure, bypass requiring specific conditions.
- `low`: defense-in-depth issue with plausible but limited abuse.

## Output Format

```markdown
Findings
- [severity] path:line - Vulnerability. Exploit scenario. Impact. Minimal fix.

Non-Findings / Assumptions
- Security-relevant assumptions or areas checked that did not produce findings.

Verification
- Evidence reviewed and commands run. Note anything not run.
```

## Guardrails

- Do not report theoretical issues that require a compromised host, malicious maintainer, or impossible input path unless that is exactly the threat model.
- Do not recommend broad rewrites when a targeted validation or permission check fixes the issue.
- Do not expose secrets in the response; identify the file and remediation path instead.
- Do not perform destructive security tests against live services unless the user explicitly authorizes them.
