---
name: git-release
description: Prepare a tagged release from git history; use for changelogs, release notes, semantic version bumps, tags, and GitHub release commands.
---

# Git Release

Use this skill when the user asks to prepare a release, draft release notes, choose a semantic version, create a changelog from commits, tag a version, or publish a GitHub release.

## Workflow

1. Identify the release target: current branch, commit range, last tag, requested version, or pre-release channel.
2. Find the latest relevant tag. If tags are missing or ambiguous, ask one concise question or state the assumed base.
3. Review commits and, when needed, changed files since the base tag. Prefer commit messages plus diff context for ambiguous commits.
4. Categorize changes into breaking changes, features, fixes, performance, documentation, chores, and internal maintenance.
5. Recommend a semantic version bump:
   - Major for breaking public behavior or migration-required changes.
   - Minor for backward-compatible features.
   - Patch for backward-compatible fixes and small maintenance releases.
6. Draft release notes for users, not just commit authors. Merge duplicate commits into one clear item.
7. Before tag or publish commands, check for a clean worktree and confirm the user wants the release action executed.

## Release Notes Shape

```markdown
## vX.Y.Z - YYYY-MM-DD

### Highlights
- Short summary of the release value.

### Breaking Changes
- Migration-impacting changes, or "None".

### Features
- User-visible additions.

### Fixes
- User-visible bug fixes.

### Maintenance
- Internal changes worth noting.

### Verification
- Tests/builds/checks used before release.
```

## Command Guidance

Provide commands only after the version and notes are clear:

```bash
git status --short
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file RELEASE_NOTES.md
```

Execute tag, push, or publish commands only when the user explicitly asks you to do it.

## Guardrails

- Do not invent changes that are not supported by git history or diffs.
- Do not include secret values, private issue content, or noisy dependency lockfile churn in release notes.
- Do not tag from a dirty worktree unless the user explicitly accepts that risk.
- Do not assume `main`/`master` is the release branch when the repository shows a different convention.
