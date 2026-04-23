---
id: IC-TEST-002
title: Write isolated tests
category: testing
severity: important
source: https://kt.dev
---

Each test should be able to run on its own, in any order, without depending on state
left behind by another test. Isolation makes failures diagnosable (the failing test
tells you what broke), makes parallelization possible, and makes flakes rare. Reset
shared resources — databases, caches, queues — between tests; do not rely on test
ordering to set up data.
