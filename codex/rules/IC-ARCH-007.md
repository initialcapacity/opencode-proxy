---
id: IC-ARCH-007
title: Favor replaceability
category: architecture
severity: suggestion
source: https://kt.dev
---

Design modules so they can be thrown away and rewritten rather than forever extended.
Small, well-bounded pieces with narrow interfaces are cheaper to replace than to
debug in place. When you catch yourself piling flags onto an existing module, ask
whether a new implementation behind the same interface would be simpler.
