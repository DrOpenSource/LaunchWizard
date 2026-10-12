# 🗺️ LaunchWizard — Implementation Roadmap & Trackable Sprints

> **Status Tracker**: Track progress sprint-by-sprint. Complete all unit and integration tests before advancing to the next milestone.

---

## 🎯 Milestone Summary

```
[Phase 1: Pre-Flight Engine] ──> [Phase 2: Error Translator] ──> [Phase 3: Auto-Healer]
                                                                        │
[Phase 6: UI Deck & Extension] <── [Phase 5: Cloudflare Tunnel] <───────┘
          │
          └──> [Phase 7: $9.99 License] ──> [Phase 8: Landing Page] ──> [Phase 9: VSIX Package]
```

---

## 📦 Phase 1: Tooling Scaffolding & Core Pre-Flight Engine
**Goal**: Build a cross-platform framework detector and non-destructive pre-flight compiler dry-runner.

- [x] **1.1 Workspace & Tooling Scaffolding**
  - [x] Initialize `package.json` with TypeScript, `esbuild`, `vitest`, and extension dependencies.
  - [x] Configure `tsconfig.json` for strict typechecking (`noImplicitAny`, `strictNullChecks`).
  - [x] Configure `vitest.config.ts` for fast, isolated engine unit tests.
- [x] **1.2 Framework Detector (`FrameworkDetector`)**
  - [x] Inspect workspace `package.json` to identify Next.js, Vite, React, Astro, SvelteKit, Remix, Nuxt, or Vanilla TS.
  - [x] Detect package managers (`npm`, `pnpm`, `yarn`, `bun`).
  - [x] Resolve entry points and build scripts (`npm run build`, `tsc --noEmit`).
- [x] **1.3 Non-Destructive Pre-Flight Runner (`PreFlightEngine`)**
  - [x] Execute `tsc --noEmit` in memory / child process.
  - [x] Execute framework build dry runs.
  - [x] Parse stdout/stderr into structured error models: `{ file, line, column, code, message, severity }`.
- [x] **1.4 Test Suite Gate 1**
  - [x] Unit tests for framework detection across Next.js, Vite, and Astro mock fixtures.
  - [x] Unit tests for compiler output parsers (TypeScript, Rollup, Next.js).

---

## 📦 Phase 2: Plain-English Error Translator & Diagnostics Glossary
**Goal**: Translate cryptic compiler codes (`TS2307`, `TS2322`, missing directives) into calm, conversational explanations for vibe coders.

- [x] **2.1 Technical-to-Plain-English Glossary (`glossary.ts`)**
  - [x] Map common TypeScript error codes (`TS2307`, `TS2322`, `TS2339`, `TS7006`, `TS2769`, `TS18003`).
  - [x] Map Next.js specific build traps (`use client` required, unconfigured image domain, `window is not defined` during SSR).
  - [x] Map bundler errors (Rollup unresolved external, Vite module not found).
- [x] **2.2 Error Translation Engine (`ErrorTranslator`)**
  - [x] Transform raw error strings into structured `TranslatedError` cards.
  - [x] Include: Title, Plain-English Explanation, Why it breaks production, and Recommended Action.
- [x] **2.3 Test Suite Gate 2**
  - [x] Test translation accuracy across 15+ real-world compiler error strings.

---

## 📦 Phase 3: Deterministic AST & Pattern Auto-Healer
**Goal**: Create safe, 1-click auto-healers for the most common build-breaking vibe coder mistakes.

- [x] **3.1 Auto-Heal Strategy Engine (`AutoHealer`)**
  - [x] Auto-fixer 1: Missing `'use client';` directive addition at line 1.
  - [x] Auto-fixer 2: Environment variable client prefixing (`process.env.KEY` -> `process.env.NEXT_PUBLIC_KEY` / `import.meta.env.VITE_KEY`).
  - [x] Auto-fixer 3: Unquoted or malformed `.env` production variables.
  - [x] Auto-fixer 4: Missing local module import path fixes.
  - [x] Auto-fixer 5: Safe optional chaining (`?.`) insertion for undefined property errors.
- [x] **3.2 Safety Rollback & Diff Generator**
  - [x] Provide preview diffs before mutation.
  - [x] In-memory rollback checkpoint to guarantee zero code corruption.
- [x] **3.3 Test Suite Gate 3**
  - [x] Vitest test suite executing auto-fixes against mock TypeScript/React files and asserting clean file updates.

---

## 📦 Phase 4: Instant Shareable Tunnel & Mobile QR Deck
**Goal**: 1-click Cloudflare Quick Tunnel runner with in-IDE SVG QR code generation for mobile testing.

- [x] **4.1 Cloudflare Quick Tunnel Manager (`TunnelManager`)**
  - [x] Check/download or run `cloudflared` in quick tunnel mode (`cloudflared tunnel --url http://localhost:<port>`).
  - [x] Fallback to localtunnel / localhost.run if `cloudflared` binary is unavailable.
  - [x] Parse tunnel output to capture the public HTTPS URL (`https://*.trycloudflare.com`).
  - [x] Implement robust process lifecycle: clean shutdown on IDE exit, zombie prevention.
- [x] **4.2 In-IDE QR Code Generator (`QrGenerator`)**
  - [x] Generate clean SVG and Data URL QR codes without external network requests.
  - [x] Support custom styles and high contrast for dark/light themes.
- [x] **4.3 Test Suite Gate 4**
  - [x] Vitest tests for URL extraction from tunnel process streams.
  - [x] Vitest tests for QR code generation and lifecycle management.

---

## 📦 Phase 5: Calm UI Deck & VS Code Extension Integration
**Goal**: Build the VS Code / Cursor / Antigravity UI components following the DrOpenSource aesthetic.

- [x] **5.1 Extension Lifecycle & Commands (`extension.ts`)**
  - [x] Register core commands: `launchwizard.runPreFlight`, `launchwizard.startTunnel`, `launchwizard.stopTunnel`, `launchwizard.autoHealAll`, `launchwizard.showMobileQr`.
- [x] **5.2 Status Bar Radar (`StatusBar.ts`)**
  - [x] Live status indicator (`$(rocket) Launch: Ready`, `$(sync~spin) Checking...`, `$(globe) Live Link`).
  - [x] Click-to-open quick actions menu.
- [x] **5.3 Activity Bar Webview Deck (`PreFlightDeckView.ts`)**
  - [x] Glassmorphic dark/light UI with DrOpenSource design system.
  - [x] Pre-flight health score and card view.
  - [x] Active tunnel card with live link, uptime counter, and mobile QR code.
  - [x] 1-Click Auto-Heal action center.
- [x] **5.4 Inline Code Action Lightbulbs (`CodeActions.ts`)**
  - [x] Offer instant 1-click fixes directly inside the editor on error lines.

---

## 📦 Phase 6: Gumroad $9.99 Lifetime Licensing & BYOK Cloud Deploy
**Goal**: Implement the transparent $9.99 one-time payment validation and BYOK cloud deployment options.

- [x] **6.1 License Manager (`LicenseManager.ts`)**
  - [x] Cryptographic offline license key validation.
  - [x] Gumroad API verification (`https://api.gumroad.com/v2/licenses/verify`).
  - [x] Unlock Pro features: Auto-heal on save, BYOK Cloud deploy, Custom subdomains.
- [x] **6.2 BYOK Cloud Deployment Connector**
  - [x] Zero-config Vercel / Cloudflare Pages deployment triggers for users with their own API tokens.
- [x] **6.3 Test Suite Gate 5**
  - [x] Vitest tests for key validation and tier gating.

---

## 📦 Phase 7: Landing Page & Showcase Portfolio (`index.html`)
**Goal**: Create an Apple-grade marketing and documentation landing page for `launchwizard.taqnik.in`.

- [x] **7.1 Design System & Typography**
  - [x] Premium dark/light theme matching `envwizard.taqnik.in` with SF Pro / Inter typography.
  - [x] Glassmorphic cards, smooth animations, and high-converting copy.
- [x] **7.2 Interactive Product Simulator**
  - [x] Interactive macOS-style mock window showing Pre-Flight checks and live QR tunnel.
- [x] **7.3 Pricing & Gumroad Integration**
  - [x] Free vs $9.99 Pro Lifetime pricing cards.
  - [x] Direct Gumroad overlay embed (`gumroad-button`).
- [x] **7.4 DrOpenSource Ecosystem Footer**
  - [x] Cross-promotion links to GitWizard and EnvWizard.

---

## 📦 Phase 8: Verification, Packaging & Release
**Goal**: Complete end-to-end verification and compile ready-to-install VSIX extension.

- [x] **8.1 Comprehensive Test Suite Pass**
  - [x] 100% test pass across all Vitest suites (30/30 tests passing).
  - [x] Strict TypeScript compilation (`npm run compile`).
- [x] **8.2 VSIX Build & Package**
  - [x] Package extension bundle (`npm run build`).
  - [x] Create walkthrough documentation and release notes (`README.md`, `assets/icon.svg`).
