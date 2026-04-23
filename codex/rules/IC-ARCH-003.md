---
id: IC-ARCH-003
title: Avoid object-relational mapping libraries
category: architecture
severity: suggestion
source: https://kt.dev
---

Write SQL directly instead of hiding it behind an ORM. ORMs trade a small amount of
initial convenience for lazy-loading surprises, N+1 query bugs, opaque performance,
and a second query language you have to learn anyway once queries get interesting.
A thin mapping layer over hand-written SQL keeps the database model visible and
the query cost obvious.
