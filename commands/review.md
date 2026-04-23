---
description: Review the current branch's changes against the IC Codex
agent: code-reviewer
subtask: true
---

Review the changes on this branch against the IC Codex.

## Repository context

@AGENTS.md

## Changed files

!`git diff --name-only origin/main...HEAD 2>/dev/null || git diff --name-only main...HEAD`

## Diff

!`git diff origin/main...HEAD 2>/dev/null || git diff main...HEAD`

Produce findings in the structured format specified in your system prompt.
