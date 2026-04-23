# Agents

Guidelines for AI coding agents working on this project.

## Code style

- Write code that reads like it was written by a senior developer. Favor clarity over cleverness.
- Use TypeScript constructor shorthand (`private readonly`) instead of declaring fields and assigning
  them separately.
- Define types where they are used, not in shared type files.
- Keep file structures flat. Don't create directories for one or two files.
- Prefer explicit code over abstractions. Two similar blocks are better than a premature
  generalization. An explicit object literal is better than `Object.fromEntries` with a `.map`.
- Don't create single-line files just to share a constant. Export it from the module that owns it.
- Inject dependencies through constructor parameters for testability. Prefer passing instances over
  factories.

## Workflow

- Propose your approach before making changes. Don't edit until the plan is approved.
- Research thoroughly before answering. Read the actual documentation and source code rather than
  guessing. When something doesn't work, verify assumptions before trying alternatives.
- Prefer simple, correct solutions. When a tool has a flag for what you need (e.g.,
  `--no-verbose`), use it instead of shell piping hacks.
- Run tests after every change. Don't commit broken code.
- Run `npm run typecheck` and `npm run format:check` before committing.
- Let the CI/CD pipeline handle deployments. Don't run `npm run deploy` or `wrangler deploy` locally.
- Write concise commit messages focused on what changed and why.
- Keep the architecture docs and usage docs updated in the README.md

## Testing

- Write unit tests for each module and integration tests for the full app.
- Use dependency injection to avoid mocking globals. Pass test doubles through constructor
  parameters.
- Test behavior, not implementation details.

## Project context

This is a Cloudflare Worker (Hono) that proxies AI provider requests through Cloudflare AI Gateway,
authenticated via Cloudflare Access. The `.well-known/opencode` endpoint provides
[OpenCode](https://opencode.ai/) with auto-configuration so developers only need to run
`opencode auth login` to get started.
