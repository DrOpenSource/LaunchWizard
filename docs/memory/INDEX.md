# 🧠 LaunchWizard — Memory Architecture Master Index

Welcome to the **LaunchWizard Memory Architecture**. This system preserves institutional memory, technical decisions, operational context, and versioning rules across agent turns and developer handoffs.

---

## 🏛️ The Four Memory Pillars

```
                     ┌───────────────────────────┐
                     │   LAUNCHWIZARD MEMORY     │
                     └─────────────┬─────────────┘
                                   │
      ┌──────────────┬─────────────┴─────────────┬──────────────┐
      ▼              ▼                           ▼              ▼
┌───────────┐  ┌───────────┐               ┌───────────┐  ┌───────────┐
│  CONTEXT  │  │ DECISIONS │               │  ROADMAP  │  │VERSIONING │
│ Tenets &  │  │   (ADRs)  │               │ Sprints & │  │  Release  │
│ Ecosystem │  │  History  │               │ Milestones│  │ Checklist │
└───────────┘  └───────────┘               └───────────┘  └───────────┘
```

1. **[CONTEXT.md](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/CONTEXT.md)**:
   - What LaunchWizard is and who it is built for ("vibe coders").
   - The DrOpenSource Calm Dev Suite Triad (GitWizard + EnvWizard + LaunchWizard).
   - Core design principles (Zero friction, Plain English, Non-destructive dry runs).
   - Runtime environment constraints (Windows PowerShell, Node.js IPv4/IPv6, OpenSSH).

2. **[DECISIONS.md](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/DECISIONS.md)** & **[decisions/](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/decisions/)**:
   - Comprehensive log of Architecture Decision Records (ADRs).
   - [ADR-001: Cloudflare Quick Tunnels vs Localtunnel](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/decisions/ADR-001-cloudflare-quick-tunnels-vs-localtunnel.md).
   - [ADR-002: $9.99 One-Time Lifetime License Model](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/decisions/ADR-002-freemium-lifetime-license.md).
   - [ADR-003: Non-Destructive In-Memory Preflight Dry Runs & AST Rollback](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/decisions/ADR-003-non-destructive-preflight-dry-runs.md).
   - [ADR-004: Zero-IDE Core Isolation (`core/` vs `extension/`)](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/decisions/ADR-004-zero-ide-core-isolation.md).

3. **[ROADMAP.md](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/ROADMAP.md)**:
   - Living progress checklist synced across Phase 1 through Phase 9.
   - Sprints, milestones, and upcoming technical deliverables.

4. **[VERSIONING.md](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/VERSIONING.md)**:
   - Semantic Versioning guidelines.
   - Mandatory release verification checklist (100% Vitest pass, strict `tsc --noEmit`, VSIX build, Gumroad sync).
   - Release history and migration notes.

5. **[KNOWN_ISSUES.md](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/docs/memory/KNOWN_ISSUES.md)**:
   - Living ledger of diagnosed bugs, root causes, reproductions, and status:
     - Bug #1: Localtunnel 35s timeout on Windows.
     - Bug #2: Localtunnel anti-phishing interstitial screen ("Enter IP shown above").
     - Bug #3: Localtunnel 502 Bad Gateway due to `localhost` IPv6 `::1` resolution.

---

## 📋 Memory Maintenance Rules for Agents

- **Rule 1: Verify Before Mutating**: Always run `npm test` and `npm run compile` before and after modifying core logic.
- **Rule 2: Log New ADRs**: If you alter a core architectural pattern (e.g. adding a new tunnel provider, changing licensing mechanisms, or introducing new auto-fix rules), create a new `ADR-00X-*.md` in `docs/memory/decisions/`.
- **Rule 3: Keep Roadmaps Truthful**: Check off sprint items in `ROADMAP.md` only when accompanied by passing unit tests in `test/`.
- **Rule 4: Record Bugs**: When a bug or diagnostic is investigated, document the findings in `KNOWN_ISSUES.md`.
