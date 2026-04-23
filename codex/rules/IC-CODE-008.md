---
id: IC-CODE-008
title: Favor standard exceptions
category: code
severity: suggestion
source: https://kt.dev
---

When you do throw, reach for the language's standard exception types —
`IllegalArgumentException`, `IllegalStateException`, `UnsupportedOperationException`,
their platform equivalents — before inventing a new one. A custom exception class is
only warranted when callers need to distinguish it programmatically from the
standard types. Otherwise a good message on a standard exception tells the reader
everything they need.
