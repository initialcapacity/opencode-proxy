---
id: IC-TEST-008
title: Use fakes
category: testing
severity: important
source: https://kt.dev
---

When you genuinely cannot use the real collaborator — because it is a third-party
API, because its setup is prohibitive, because you are testing a failure mode that
is hard to trigger — write a fake. A fake is a working in-memory implementation of
the same interface that lets tests assert against observable behavior. Maintain
the fake alongside the real implementation so they stay in agreement.
