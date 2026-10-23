# 🧠 LaunchWizard — Project-Level Memory Architecture (Root Anchor)

Welcome to the **Project-Level Memory Architecture** for **LaunchWizard** (formerly ShipWizard), developed by [DrOpenSource](https://github.com/DrOpenSource).

This memory system serves as the immutable single-source-of-truth for AI agents (Antigravity, Cursor, Claude, Copilot) and human maintainers across development sessions.

---

## 🗂️ Memory Index & Navigation

All memory modules are maintained in [`docs/memory/`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/):

| Pillar | Location | Description |
|---|---|---|
| **Context & Tenets** | [`docs/memory/CONTEXT.md`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/CONTEXT.md) | Mission, Calm Dev Suite ecosystem synergy, target personas ("vibe coders"), and runtime environment constraints. |
| **Decisions (ADRs)** | [`docs/memory/DECISIONS.md`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/DECISIONS.md) | Architectural Decision Log and individual ADRs in [`docs/memory/decisions/`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/decisions/). |
| **Roadmap & Sprints** | [`docs/memory/ROADMAP.md`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/ROADMAP.md) | Live phase tracking, completed milestones, current sprint state, and future roadmap. |
| **Versioning & Releases** | [`docs/memory/VERSIONING.md`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/VERSIONING.md) | SemVer governance, release checklists (Vitest gates, VSIX build, Gumroad sync), and tag protocols. |
| **Known Issues & Ledger** | [`docs/memory/KNOWN_ISSUES.md`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/KNOWN_ISSUES.md) | Active bug ledger, root cause analyses (e.g. Localtunnel timeouts, interstitial warning pages, 502 Bad Gateway), and remediations. |

---

## ⚡ Agent Protocol

Any AI agent interacting with this repository MUST:
1. Read [`docs/memory/INDEX.md`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/INDEX.md) before planning or executing modifications.
2. Log every substantial architectural change in [`docs/memory/DECISIONS.md`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/DECISIONS.md) as a numbered ADR.
3. Update [`docs/memory/VERSIONING.md`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/VERSIONING.md) when packaging or bumping versions.
4. Update [`docs/memory/KNOWN_ISSUES.md`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/KNOWN_ISSUES.md) when reporting or resolving bugs.
