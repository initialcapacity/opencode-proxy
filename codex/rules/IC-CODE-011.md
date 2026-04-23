---
id: IC-CODE-011
title: Refactor ruthlessly
category: code
severity: suggestion
source: https://kt.dev
---

Leave the code better than you found it on every change. Rename the variable that
confused you. Extract the function that was inlined for no reason. Delete the branch
that is never reached. Small refactors compounded over many changes keep a codebase
young; skipping them compounds into the "we need a rewrite" conversation.
