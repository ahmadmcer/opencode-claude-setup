---
name: dependency-audit
description: Audit project dependencies, lockfiles, package manager reports, outdated packages, and CVEs; use for npm audit, pip audit, supply-chain, or dependency update requests.
---

# Dependency Audit

Use this skill when the user asks to audit dependencies, check outdated packages, evaluate CVEs, run `npm audit`, `pnpm audit`, `yarn npm audit`, `pip-audit`, `cargo audit`, `bundler audit`, `go list -m -u`, or plan dependency upgrades.

## Workflow

1. Detect package managers from lockfiles and manifests before choosing commands.
2. Prefer read-only audit and outdated checks first. Do not rewrite lockfiles or upgrade packages unless the user asks for changes.
3. Separate direct dependencies from transitive dependencies. Direct dependency upgrades are usually actionable; transitive fixes may require parent package updates, overrides, or waiting for upstream.
4. Prioritize critical and high vulnerabilities with plausible exploit paths in this project. Medium and low issues can be summarized unless they are internet-facing or easy to exploit.
5. Recommend the smallest safe upgrade that fixes the issue. Avoid broad "update everything" advice unless the user asked for a modernization pass.
6. Check release notes or changelogs for major upgrades when feasible, especially for frameworks, auth, crypto, database, build, and runtime packages.

## Package Manager Hints

- JavaScript: inspect `package.json` plus `package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml`, `yarn.lock`, or `bun.lock*`.
- Python: inspect `pyproject.toml`, `requirements*.txt`, `Pipfile.lock`, `poetry.lock`, or `uv.lock`.
- Go: inspect `go.mod` and `go.sum`.
- Rust: inspect `Cargo.toml` and `Cargo.lock`.
- Ruby: inspect `Gemfile` and `Gemfile.lock`.
- .NET: inspect `.csproj`, `packages.lock.json`, and `Directory.Packages.props`.

## Output Format

Report actionable items first:

```markdown
High Priority
- package: current -> fixed version, direct/transitive, severity, affected path, why it matters, recommended command/change.

Other Findings
- Lower-risk or informational dependency issues.

Upgrade Notes
- Breaking-change risks, lockfile impact, and test focus.

Verification
- Audit commands and sources used. Note commands not run.
```

## Guardrails

- Do not expose `.env` files or secrets while inspecting dependency configuration.
- Do not run install/update commands that mutate manifests or lockfiles unless explicitly asked.
- Do not treat every outdated package as a security issue.
- Do not recommend `--force` audit fixes without explaining breaking-change risk.
