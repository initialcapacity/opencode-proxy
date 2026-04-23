---
id: IC-CODE-007
title: Use exceptions for exceptional conditions
category: code
severity: important
source: https://kt.dev
---

Throw exceptions for genuinely exceptional conditions — programmer errors, unmet
invariants, unavailable resources. Do not use exceptions for ordinary control flow
like "user not found" or "input invalid"; return a value that expresses the result
(an optional, a result type, a typed failure). Exceptions for normal outcomes make
the happy path harder to read and tempt callers to write empty catch blocks.
