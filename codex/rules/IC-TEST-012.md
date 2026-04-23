---
id: IC-TEST-012
title: Avoid sleeping
category: testing
severity: important
source: https://kt.dev
---

A `sleep` in a test is almost always wrong. Either it masks a race by waiting
longer than the race usually takes, or it slows the suite down on machines where
the real wait would be shorter. Wait for the condition you actually care about —
poll a queue, await a future, block on a signal with a timeout — so the test
passes as soon as the work is done and fails quickly when it is not.
