---
id: IC-ARCH-006
title: Favor loose coupling and high cohesion
category: architecture
severity: important
source: https://kt.dev
---

Modules should depend on as little of each other as possible (loose coupling), and
the things inside a module should belong together (high cohesion). Changes in one
area should not force changes across many unrelated areas. When you find a change
rippling through the codebase, the boundaries are in the wrong place.
