---
name: code-review
description: Review a diff or PR for correctness, simplification, and test coverage
---
## What I do
- Diff the current branch against its base (or review a given PR)
- Flag correctness bugs with a concrete failure scenario (inputs/state -> wrong output)
- Flag missed simplifications and unnecessary abstractions, but only in changed code
- Check test coverage for the new behavior
- Rank findings most-severe first; report nothing if nothing survives scrutiny

## When to use me
Use before merging a branch or PR, or when asked to review pending/uncommitted changes.
Do not use for a full-repo audit — scope to the diff.
