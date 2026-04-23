---
id: IC-ARCH-008
title: Favor one repository
category: architecture
severity: suggestion
source: https://kt.dev
---

Keep related code in one repository. A single repo makes cross-cutting changes
atomic, keeps the dependency graph honest, and eliminates the version-skew
coordination tax that multi-repo setups impose. Reach for a second repository only
when the boundary is genuinely independent in release cadence and ownership.
