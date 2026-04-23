---
id: IC-CODE-009
title: Avoid globals and constants
category: code
severity: important
source: https://kt.dev
---

Avoid module-level mutable state and avoid pulling configuration values from global
constants scattered across the codebase. Global state makes tests order-dependent,
hides dependencies from the signatures that need them, and turns every caller into
an implicit collaborator. Pass collaborators in through constructors or function
parameters so the dependency graph is visible at the call site.
