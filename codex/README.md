# IC Codex

The IC Codex is the structured form of [kt.dev](https://kt.dev) — Initial Capacity's
opinionated engineering principles — turned into machine-readable rules that the
`@code-reviewer` agent cites when reviewing diffs.

## Rule format

Each rule lives in its own file under `rules/` and has YAML frontmatter followed by a body.

```markdown
---
id: IC-TEST-009
title: Avoid mocks
category: testing
severity: important
source: https://kt.dev
---

Prefer fakes over mocks. Mocks couple tests to implementation details — they assert
that a specific method was called on a specific collaborator, which breaks whenever
you refactor the collaborator even if the behavior is unchanged. A fake reimplements
the collaborator's behavior in-memory, lets you assert against observable outcomes,
and survives refactoring.
```

### Frontmatter fields

| Field      | Required | Notes                                                              |
|------------|----------|--------------------------------------------------------------------|
| `id`       | yes      | `IC-<CATEGORY>-<NNN>`, zero-padded to three digits                 |
| `title`    | yes      | Short imperative statement, matches the kt.dev principle           |
| `category` | yes      | One of `architecture`, `code`, `testing`                           |
| `severity` | yes      | One of `critical`, `important`, `suggestion`, `nit`                |
| `source`   | no       | URL for provenance, typically `https://kt.dev`                     |

### Categories and ID ranges

| Prefix         | Category       | Scope                                                      |
|----------------|----------------|------------------------------------------------------------|
| `IC-ARCH-NNN`  | `architecture` | System design, dependencies, service boundaries            |
| `IC-CODE-NNN`  | `code`         | Language-level practices, naming, organization             |
| `IC-TEST-NNN`  | `testing`      | Test structure, fakes vs. mocks, real services             |

### Severities

| Severity     | Meaning                                                                 |
|--------------|-------------------------------------------------------------------------|
| `critical`   | Must fix before merge. Security, correctness, or data-loss concerns.    |
| `important`  | Strong violation of an IC principle. Fix or explicitly justify.         |
| `suggestion` | Would improve the change. Author's call.                                |
| `nit`        | Minor; informational.                                                   |

## Adding or editing a rule

1. Pick the next unused number in the appropriate prefix.
2. Create `rules/IC-<PREFIX>-<NNN>.md` with frontmatter and a one-paragraph rationale.
3. Run `npm run build:codex` to regenerate `src/codex.generated.ts`.
4. Run `npm test` to verify.

The reviewer agent (Phase 2) cites rules by `id` in its findings, so IDs are stable —
do not renumber existing rules even if titles change.

## What's intentionally not here

kt.dev includes process rules ("Commit to main daily", "Deploy on-demand", "Avoid pull
requests") that describe how the team works rather than what a diff should look like.
Those belong in team onboarding, not in a diff reviewer. This corpus is restricted to
principles that are actually reviewable against a code change.
