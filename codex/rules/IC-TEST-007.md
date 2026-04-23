---
id: IC-TEST-007
title: Test against a real cache
category: testing
severity: important
source: https://kt.dev
---

If the code uses a cache — Redis, Memcached, a CDN — exercise it against the real
cache in tests. Expiration, eviction, serialization, and concurrent-access behavior
are all places bugs hide, and none of them reproduce against a map. Run the real
cache locally alongside the rest of your dependencies.
