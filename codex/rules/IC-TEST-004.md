---
id: IC-TEST-004
title: Write tests using local services
category: testing
severity: important
source: https://kt.dev
---

Run the real collaborators your code depends on — the database, the queue, the
cache — as local processes or containers during tests. Tests against local
instances of the real thing catch schema mistakes, SQL mistakes, and configuration
mistakes that a mock or an in-memory substitute will cheerfully accept. Shared
remote test environments introduce flakes and coordination costs; keep test
services on the developer's machine and in CI.
