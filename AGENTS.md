# AGENTS.md — LaunchWizard Project Protocol

Welcome, Agent. You are developing **LaunchWizard**, an intent-based "Get It Live" pre-flight engine and 1-click shareable tunnel extension for **VS Code**, **Cursor**, and **Antigravity**, created for vibe coders and modern developers.

---

## 1. Core Operating Principles

1. **Safety First (Code & Deployment Integrity Shield)**:
   - Never mutate user source files during auto-healing without an in-memory or shadow rollback backup.
   - Always run pre-flight checks in non-destructive dry-run mode (`tsc --noEmit`, framework build dry-runs).
   - Never deploy code to production or external cloud targets without explicit user confirmation.

2. **Plain-English UX for Vibe Coders**:
   - Vibe coders panic when presented with walls of cryptic compiler errors (`TS2307: Cannot find module`, `TS2322: Type 'string' is not assignable`, `Rollup failed to resolve import`, `Image is missing required src prop`).
   - Every raw error must be paired with an immediate, friendly plain-English translation card explaining:
     - **What happened** (in human terms)
     - **Why it matters** (how it breaks Vercel/Cloudflare production builds)
     - **1-Click Auto-Fix** (the exact proposed fix ready to apply)

3. **Instant Zero-Config Shareable Links**:
   - Free tier uses **Cloudflare Quick Tunnels** (`cloudflared` via trycloudflare.com) for 1-click secure HTTPS shareable links without requiring accounts, credit cards, or API tokens.
   - Generate mobile-friendly QR codes directly inside the IDE webview for instant phone testing.
   - In-flight health ping: verify local dev server is responding before launching tunnel to avoid dead links.

4. **Monetization & Pricing Guardrails**:
   - **Model**: Freemium with a **$9.99 One-Time Lifetime License** on Gumroad.
   - **Zero Subscriptions**: Never introduce monthly/annual recurring charges. Vibe coders impulse buy pay-once tools.
   - **Free Tier Integrity**: Local pre-flight build checks, manual tunnel creation, and basic error explanations must remain free forever with zero artificial nag-screens.
   - **Pro Tier ($9.99 Lifetime)**: Automated AST auto-healing on save, BYOK (Bring Your Own Key) zero-config cloud deployment to Cloudflare/Vercel, custom subdomains, and team preview cards.

5. **Lean Context & Cost Optimization**:
   - Do not bloat context with massive terminal or compiler build logs.
   - Reference specifications in `docs/PRD.md` and track execution state in `docs/ROADMAP.md`.
   - Maintain trackable sprint progress via checkboxes in `docs/ROADMAP.md` rather than repeating plans in chat.

6. **Strict Automated Verification**:
   - Every sprint feature must have automated unit tests in `test/` using Vitest.
   - Test tunnel process lifecycle, framework build detection, AST error diagnostics, and auto-healers against fixtures.
   - Always verify cross-platform execution (Windows PowerShell/cmd, macOS, Linux).
   - Always run `npm test` and `npm run compile` before marking tasks complete.

---

## 2. Directory Layout & Standards

```
LaunchWizard/
├── docs/
│   ├── PRD.md                 # Product Requirements Document & User Personas
│   └── ROADMAP.md             # Phase-wise sprint checklist & tracker
├── src/
│   ├── core/                  # Platform-agnostic engine (Zero IDE dependencies)
│   │   ├── PreFlightEngine.ts # Framework detector, typecheck, & build dry-run
│   │   ├── ErrorTranslator.ts # Compiler-to-Plain-English translation map
│   │   ├── AutoHealer.ts      # Deterministic AST & regex patch generator
│   │   ├── TunnelManager.ts   # Cloudflare Quick Tunnel runner & lifecycle
│   │   ├── QrGenerator.ts     # In-IDE ASCII & SVG QR code generator
│   │   └── LicenseManager.ts  # $9.99 Gumroad cryptographic key verification
│   ├── extension/             # VS Code / Cursor / Antigravity integration
│   │   ├── extension.ts       # Extension entry point & lifecycle hooks
│   │   ├── StatusBar.ts       # Live pre-flight radar & quick share button
│   │   ├── PreFlightDeckView.ts # Activity Bar webview dashboard
│   │   └── CodeActions.ts     # Inline lightbulb auto-healers
│   └── shared/                # Shared types, constants, and translations
│       ├── types.ts           # Pre-flight, tunnel, and diagnostics contracts
│       └── glossary.ts        # Technical-to-Plain-English translation dictionary
├── test/
│   ├── preflight-engine.test.ts # Framework build & typecheck detection tests
│   ├── error-translator.test.ts # Diagnostic translation tests
│   ├── auto-healer.test.ts     # AST patch application tests
│   └── tunnel-manager.test.ts  # Tunnel lifecycle & output parser tests
├── AGENTS.md                  # This agent protocol file
├── index.html                 # Ecosystem portfolio & showcase landing page
├── package.json               # Extension manifest and build scripts
├── tsconfig.json              # Strict TypeScript compiler options
└── vitest.config.ts           # Vitest unit test runner config
```

---

## 3. The DrOpenSource Calm Dev Suite Synergy

LaunchWizard completes the developer safety triad alongside [GitWizard](https://github.com/DrOpenSource/GitWizard) and [EnvWizard](https://github.com/DrOpenSource/EnvWizard):

1. **GitWizard**: Protects your source code history and auto-saves against AI overwrites.
2. **EnvWizard**: Unjams your local dev ports (`3000`, `5173`) and heals missing `.env` variables.
3. **LaunchWizard**: Ensures your code compiles cleanly for production and gives you an instant 1-click shareable preview tunnel to share with clients or test on your phone.

Shared visual aesthetic: dark-mode glassmorphic styling, non-blocking toasts, zero noise, and 1-click intent triggers.
