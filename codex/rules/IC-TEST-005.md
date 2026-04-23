---
id: IC-TEST-005
title: Test against a real database
category: testing
severity: important
source: https://kt.dev
---

Write database-touching tests against the same database engine you run in
production. H2 pretending to be Postgres, SQLite pretending to be MySQL, and
in-memory repositories pretending to be either do not catch dialect differences,
transaction semantics, index behavior, or constraint violations that will show up
in production. Spin up the real engine locally and in CI.
