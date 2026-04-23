---
id: IC-ARCH-005
title: Avoid large frameworks
category: architecture
severity: suggestion
source: https://kt.dev
---

Prefer small, composable libraries over large frameworks that dictate structure,
lifecycle, and conventions. Frameworks are expensive to migrate away from, tend to
leak their abstractions into application code, and couple your release cadence to
theirs. A handful of focused libraries keeps the application in charge of its own
architecture.
