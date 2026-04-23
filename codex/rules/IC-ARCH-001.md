---
id: IC-ARCH-001
title: Render server side first
category: architecture
severity: suggestion
source: https://kt.dev
---

Start with server-rendered HTML and add client-side interactivity only where it earns
its weight. Server rendering is simpler, faster to first paint, friendlier to search
engines, and avoids duplicating state and validation between a backend and a client
framework. Reach for a single-page app only when the interaction model genuinely
requires one.
