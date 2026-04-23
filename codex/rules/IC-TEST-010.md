---
id: IC-TEST-010
title: Avoid nested tests
category: testing
severity: suggestion
source: https://kt.dev
---

Keep test structure flat. Deeply nested `describe` / `context` blocks with shared
setup at every level are satisfying to write and painful to read — when a test
fails, the reader has to reconstruct state by walking up through every surrounding
block. Prefer flat tests with explicit, local setup; repetition is cheaper than
hidden coupling.
