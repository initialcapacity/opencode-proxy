---
id: IC-TEST-001
title: Write fast tests
category: testing
severity: important
source: https://kt.dev
---

Tests that are slow get run less often, and tests that are run less often stop
catching bugs. A fast test suite is a suite the team actually runs on every change.
Budget the whole suite in the low minutes, not the tens of minutes; a single test
should run in milliseconds unless it has a specific reason to touch a slow
collaborator.
