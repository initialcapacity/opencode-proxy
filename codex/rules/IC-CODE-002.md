---
id: IC-CODE-002
title: Write generic code
category: code
severity: suggestion
source: https://kt.dev
---

Use the language's type system to write code that works for more than one concrete
type when the operation genuinely does not depend on the specifics. Generics surface
intent, catch mismatches at compile time, and eliminate the runtime casts that come
with `Object`-shaped or `any`-shaped APIs. Do not reach for generics where a
concrete type would be clearer.
