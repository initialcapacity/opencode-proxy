---
id: IC-ARCH-011
title: Avoid circular dependencies
category: architecture
severity: important
source: https://kt.dev
---

Package and module dependencies should form a directed acyclic graph. Cycles make
the involved modules impossible to reason about independently, impossible to test
in isolation, and impossible to release separately. When you find yourself tempted
to add an import that closes a cycle, the responsibility is in the wrong place —
extract it to a shared lower-level module or push it up to a coordinating caller.
