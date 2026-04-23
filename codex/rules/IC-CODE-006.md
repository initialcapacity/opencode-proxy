---
id: IC-CODE-006
title: Favor immutable objects
category: code
severity: important
source: https://kt.dev
---

Default to immutable data. Objects whose fields cannot change after construction are
safe to share across threads and async boundaries, safe to cache, easy to reason
about, and impossible to corrupt through aliasing. Reach for mutation only when you
have a measured reason — hot-path performance, a genuinely stateful workflow — and
contain it behind a narrow interface.
