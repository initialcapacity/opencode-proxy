---
id: IC-CODE-010
title: Avoid locking
category: code
severity: important
source: https://kt.dev
---

Avoid explicit locks. They are easy to get wrong — deadlocks, livelocks, priority
inversions — and they signal that shared mutable state has leaked into your design.
Prefer immutable data, message passing, or a database with appropriate transaction
isolation to coordinate concurrent work. When a lock is genuinely unavoidable, keep
its scope minimal and document the invariant it protects.
