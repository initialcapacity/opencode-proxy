---
id: IC-ARCH-012
title: Reconsider microservices
category: architecture
severity: suggestion
source: https://kt.dev
---

Splitting a system into microservices buys you independent deployability at the cost
of distributed-systems failure modes, network latency, schema coordination, and
operational complexity. That trade is usually bad until the team and traffic
demand it. Start with a well-modularized monolith; extract a service only when the
coupling pain is concrete and the boundary is obvious.
