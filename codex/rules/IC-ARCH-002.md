---
id: IC-ARCH-002
title: Avoid named environments or profiles
category: architecture
severity: important
source: https://kt.dev
---

Do not branch behavior on environment names like `dev`, `staging`, or `prod`, and do
not use framework profile mechanisms to swap implementations by environment. Code
paths that only run in production are code paths you cannot meaningfully test. Inject
configuration through environment variables or explicit parameters so every
environment runs the same code with different values.
