---
id: IC-TEST-006
title: Test against a real queue
category: testing
severity: important
source: https://kt.dev
---

Where code publishes to or consumes from a queue, test against the same broker you
use in production. Message ordering, delivery guarantees, visibility timeouts, and
redelivery semantics differ across brokers and across configurations of the same
broker; an in-memory queue does not model any of them. Run the real thing locally
so the tests find the bugs the broker will find.
