---
name: deploy
description: Run tests, commit, push, and monitor the CI/CD pipeline
---

## Steps

1. Run `npm test` and confirm all tests pass.
2. Stage the changed files and create a commit.
3. Push to `origin main`.
4. Run `gh run watch` to monitor the pipeline and report the result.
