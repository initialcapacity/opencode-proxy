---
id: IC-TEST-011
title: Avoid testing with implementation code
category: testing
severity: important
source: https://kt.dev
---

Tests should drive code through its public surface. Reaching into private fields,
calling internal helpers, or relying on reflection to set up state couples the test
to the implementation and punishes every refactor. If the public interface is hard
to test, fix the interface — extract a seam, accept a collaborator as a parameter,
split a class — do not work around it with privileged access.
