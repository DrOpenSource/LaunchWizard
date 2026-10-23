# ⚖️ LaunchWizard — Architectural Decision Records (ADR) Log

This document indexes all major architectural, design, and product decisions for LaunchWizard. Each record captures the context, problem statement, options considered, final decision, and consequences.

---

## 📑 ADR Index

| ADR ID | Title | Date | Status |
|---|---|:---:|:---:|
| **[ADR-001](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/decisions/ADR-001-cloudflare-quick-tunnels-vs-localtunnel.md)** | Cloudflare Quick Tunnels as Primary with Built-in Windows SSH / Localtunnel Fallback | 2026-10-14 | **Accepted** |
| **[ADR-002](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/decisions/ADR-002-freemium-lifetime-license.md)** | Freemium Model with $9.99 One-Time Lifetime License vs Recurring Subscriptions | 2026-10-11 | **Accepted** |
| **[ADR-003](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/decisions/ADR-003-non-destructive-preflight-dry-runs.md)** | Non-Destructive In-Memory Dry Runs and Shadow Rollback Architecture | 2026-10-10 | **Accepted** |
| **[ADR-004](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/decisions/ADR-004-zero-ide-core-isolation.md)** | Zero-IDE Core Isolation (`src/core/` vs `src/extension/`) | 2026-10-10 | **Accepted** |
| **[ADR-005](decisions/ADR-005-gumroad-only-licensing.md)** | Gumroad-Only Licensing (No License Server, $0) | 2026-10-23 | **Accepted** |
| **[ADR-006](decisions/ADR-006-heal-safety-classes.md)** | Heal Safety Classes, Editor-Based Edits, No "Make It Public" Fixes | 2026-10-23 | **Accepted** |
| **[ADR-007](decisions/ADR-007-zero-cost-pro-features.md)** | Zero-Cost Pro Features (BYOK Deploy, Local Link Proxy, Named Tunnels) | 2026-10-23 | **Accepted** |

---

## 🔄 ADR Lifecycle Process

1. **Proposed**: Under review and debate.
2. **Accepted**: Decided upon and implemented.
3. **Deprecated**: Superseded by a newer ADR.
4. **Rejected**: Evaluated and discarded.

When proposing or implementing a new architectural pattern, author a new Markdown file in `docs/memory/decisions/ADR-XXX-<name>.md` and link it in this table.
