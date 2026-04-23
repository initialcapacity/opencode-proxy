---
id: IC-TEST-003
title: Write tests first
category: testing
severity: suggestion
source: https://kt.dev
---

Write the test before the production code that makes it pass. Starting with the test
forces you to design the interface from the outside, surfaces awkward dependencies
before you commit to them, and guarantees the test actually fails for the reason
you think. A test written after the fact too easily becomes a description of what
the code happens to do.
