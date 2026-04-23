---
id: IC-TEST-009
title: Avoid mocks
category: testing
severity: important
source: https://kt.dev
---

Do not use mocking libraries to assert that a specific method was called on a
specific collaborator with specific arguments. Tests written that way pin the
current implementation in place — any refactor that preserves behavior still
breaks the test. Assert against observable outcomes through a fake or the real
collaborator instead, so the test measures what the code does, not how it does it.
