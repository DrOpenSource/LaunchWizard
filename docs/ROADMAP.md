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
  - [x] Execute framework build dry runs. *(Delivered in v0.5.0.)*
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
  - [x] Auto-fixer 3: Unquoted or malformed `.env` production variables. *(Delivered in v0.5.0.)*
  - [x] Auto-fixer 4: Missing local module import path fixes. *(Delivered in v0.5.0.)*
  - [x] Auto-fixer 5: Safe optional chaining (`?.`) insertion for undefined property errors.
- [x] **3.2 Safety Rollback & Diff Generator**
  - [x] Provide preview diffs before mutation. *(Delivered in v0.5.0.)*
  - [x] In-memory rollback checkpoint to guarantee zero code corruption. *(Delivered in v0.5.0.)*
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
  - [x] Unlock Pro features: Auto-heal on save, BYOK Cloud deploy, Custom subdomains. *(Delivered in v0.5.0.)*
- [x] **6.2 BYOK Cloud Deployment Connector** *(Delivered in v0.5.0, beta.)*
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

---

# 🛠️ Remediation & Pro Readiness Plan (from the 2026-10-22 audit)

> Bug IDs **B1–B13** refer to the audit's defect list, logged as `BUG-004`–`BUG-016` in [`docs/memory/KNOWN_ISSUES.md`](memory/KNOWN_ISSUES.md).
> Every phase ends with the standard gate: `npm run compile` → `npm test` → `npm run build` → `npm run package`, a git tag, and updates to `docs/memory/VERSIONING.md` and `KNOWN_ISSUES.md`.

```
[10: Truth in advertising] ─┐
                            ├─> [11: v0.2.3 critical/high fixes] ─> [12: v0.2.4 hardening + extension tests]
                            │                                              │
                            │                                              v
                            │                                  [13: v0.3.0 licensing platform]
                            │                                    │            │            │
                            │                                    v            v            v
                            │                         [14: heal on save] [15: BYOK deploy] [16: private links + team cards]
                            │                                    └────────────┴────────────┘
                            └───────────────────────────────────────────────> [17: Pro relaunch]
```

Phase 13 must ship before any new Pro feature: there is no point building paid features on a license check that can be bypassed. After it lands, Phases 14–16 do not depend on each other and can run in parallel.

### ✅ Decisions (updated 2026-10-23)

**Cost rule: everything must run at $0 for the maintainer.** No paid servers and no paid APIs. Users bring their own free accounts where a feature needs one.

- [x] **D1 — Existing buyers:** none exist. No refund work is needed; Phase 10 only makes the copy honest.
- [x] **D2 — `SHIP-PRO-` offline keys:** none were ever issued. Retire the format and delete the HMAC secret in Phase 11.5.
- [x] **D3 — License server:** **no server.** Licensing uses Gumroad's free license API directly from the extension (Phase 13). A Cloudflare Worker on the free plan would also cost $0 (100,000 requests/day; past that, requests fail rather than being billed), but it adds ops for little gain at this scale. Revisit only if manual machine resets become a support burden.
- [x] **D4 — Deploy default:** preview deployments by default; production only after a second explicit confirmation.
- [x] **D5 — Custom subdomains:** deliverable at $0 for us. Defined as "a subdomain on the user's own domain, managed in their free Cloudflare account, through a free named Cloudflare Tunnel". Only users who own a domain can use it.
- [x] **D6 — Team preview cards:** deliverable at $0. Defined as a copyable Markdown/Slack card plus a deck card; no server, no accounts.
- [x] **D7 — Extra zero-cost Pro features:** maintainer approved building all Phase 18 candidates (2026-10-23).

---

## 📦 Phase 10: Truth in Advertising (no extension release) — size S
**Goal**: Make every sales surface match what the code does today.

- [x] Mark BYOK deploy, password-protected links, custom subdomains and team preview cards as **"Coming soon"**, and label Pro **"Early Access"**, in `index.html`, `README.md`, `docs/GUMROAD_LISTING.md` and the Pro card in `src/extension/PreFlightDeckView.ts`.
- [x] Rename "Automated AST auto-healing on save" to **"Background pre-flight check on every save"** until Phase 14 ships.
- [x] Fix the activation messages in `LicenseManager.ts`.
- [x] Replace the landing-page demo that "heals" `process.env.API_SECRET` with a non-secret example (`SITE_URL`).
- [x] Remove the "under 2 seconds" / "3-second" timing claims and the "bundler" and "rollback" claims.
- [x] Add a **Current Limitations** section to `README.md` and `index.html` (`#limitations`) and a summary to the Gumroad copy.
- [x] `EULA.md` / `eula.html`: describe Pro as early access, with future features included at no charge; drop the "cryptographic validation" wording.
- [x] `PRIVACY.md` / `privacy.html`: disclose localhost.run (SSH), loca.lt and the npm registry download of localtunnel; drop the offline-HMAC claim.
- [x] `npm run build:site` regenerated `public/`.
- [ ] **Maintainer**: paste the updated description from `docs/GUMROAD_LISTING.md` into the live Gumroad page.
- [x] **Maintainer**: redeploy the site (`npm run deploy:site`). *(Done 2026-10-23 with v0.5.0.)*
- [x] Marketplace README refresh: included in `launchwizard-0.5.0.vsix`; goes live when the maintainer publishes it.

---

## 📦 Phase 11: v0.2.3 — Critical & High Safety Fixes (B1–B5) — size M
**Goal**: Pre-flight never says "ready" when it isn't, healing never harms the project, a stopped link is really stopped, and Pro can't be unlocked for free.

- [x] **11.1 B1 — No false all-clear** (`PreFlightEngine.runTypeScriptDryRun`)
  - [x] Resolve the project's own compiler (`node_modules/.bin/tsc`, `tsc.cmd` on Windows, or `node node_modules/typescript/bin/tsc`). Never use `npx tsc`, which downloads an unrelated package when TypeScript is missing.
  - [x] TypeScript not installed → a `TS_NOT_INSTALLED` blocker with a glossary card ("Run `npm install` first").
  - [x] Timeout (`killed`/`signal` set) → a `PREFLIGHT_TIMEOUT` blocker, never a pass. Raise the default to 60 s and add a `launchwizard.preflightTimeoutSeconds` setting.
  - [x] Non-zero exit with zero parsed diagnostics → a `TSC_UNPARSED` blocker that carries the last 5 lines of output.
  - [x] Parse location-less lines (`error TS18003: ...`, `error TS5023: ...`).
  - [x] Spawn with `spawn` (no shell) so a timeout kills the whole process tree (also closes B13).
  - [x] Tests: no-TypeScript fixture, mocked timeout, TS18003 output, non-zero exit with unparseable output.
- [x] **11.2 B2 — Env-prefix "fix" must not publish secrets**
  - [x] Drop `healerId` from `ENV_LEAK_OR_UNDEFINED` and `VITE_PROCESS_ENV_USAGE`, so they become explain-only cards with two options: move the read into server code, or rename the variable in `.env` *knowingly*.
  - [x] Never suggest a public prefix for names matching `/SECRET|KEY|TOKEN|PASSWORD|PRIVATE|CREDENTIAL/i`. Show a "this looks like a secret" warning instead.
  - [x] Apply the same rules in `CodeActions.ts`.
  - [x] Tests: secret-like names are never healed; non-secret names show the explain card.
- [x] **11.3 B3 — Heals are previewed, confirmable and undoable**
  - [x] `AutoHealer` (core) returns text edits instead of writing files. The extension applies them through `vscode.workspace.applyEdit`, which respects unsaved buffers and Ctrl+Z.
  - [x] Batch "Heal All" opens a diff preview (`vscode.diff` against a virtual document) and asks for confirmation.
  - [x] Replace the 40-character `generateDiff` stub with a real line-based unified diff.
  - [x] Add a `launchwizard.undoLastHeal` command and a deck button, backed by a rollback checkpoint saved to `context.storageUri` so it survives a reload. *(Built with `globalStorageUri`, which also works without a folder open.)*
  - [x] Tests: edits are pure (no disk writes in core), diff output, rollback restores the exact bytes.
- [x] **11.4 B4 — Stop really stops**
  - [x] Capture `child` in each handler's closure. `exit` and `error` handlers only clear state when `this.activeProcess === child`.
  - [x] Track every spawned PID. `stopTunnel()` and `deactivate()` kill all of them (with `taskkill /T` on Windows).
  - [x] Tests: timeout → fallback → a late `exit` from the old process → `stopTunnel()` still kills the new process; same for a port switch.
- [x] **11.5 B5 — Close the free-Pro bypasses (interim; the full fix is Phase 13)**
  - [x] Remove the offline grant for keys never verified online. Store `verifiedAt` and allow offline use only within 30 days of a successful online check.
  - [x] Re-verify a stored Gumroad key in the background at startup (`increment_uses_count=false`). Downgrade if the purchase is refunded or charged back.
  - [x] Store the license in `context.secrets` (SecretStorage) instead of `globalState`; migrate the `launchwizard.licenseKey` and `shipwizard.licenseKey` values once. *(They are cleared instead: no customer keys exist, per D1/D2.)*
  - [x] Retire `SHIP-PRO-` keys (D2: none were ever issued): remove `verifyCryptographicChecksum`, `generateOfflineKey`, the `SALT` constant and their tests.
  - [x] Tests: unverified key offline → free; refunded → free; within grace → Pro; grace expired → free.
- [ ] **11.6 Release v0.2.3**: *superseded: Phases 11–18 ship together as v0.5.0. Gate passed and the live tunnel smoke test ran on Windows; macOS by hand and the git tag are still open (see Phase 17).*

---

## 📦 Phase 12: v0.2.4 — Medium/Low Fixes, Hardening & Extension Tests (B6–B13) — size M
**Goal**: Remove the remaining rough edges and get the extension layer under test.

- [x] **B6**: Make tunnel progress cancellable (pass an `AbortSignal` into `TunnelManager.startTunnel`). Show which provider is being tried ("Trying Cloudflare… trying localhost.run…").
- [x] **B7**: Health ping tries `127.0.0.1`, then `::1`. Pass whichever host answered to every provider (`http://[::1]:port` for cloudflared, `-R 80:[::1]:port` for ssh, `--local-host ::1` for localtunnel).
- [x] **B8**: Gate lightbulbs by the detected framework (cache `FrameworkDetector` per workspace). Match `/['"]use client['"]/`. Only offer `'use client'` in Next.js `app/` or component files.
- [x] **B9**: Debounce the on-save check (1.5 s) and make it single-flight: skip while running, then run once more afterwards.
- [x] **B10**: `TunnelManager` emits status events (an `EventEmitter`). The status bar and deck subscribe, so "Connecting…" and an unexpected tunnel death show immediately.
- [x] **B11**: Error cards show a clickable `file:line`, the `actionPrompt`, and a per-card "Fix" button when a healer exists. Fix the "TypeScript Project project" summary text.
- [x] **B12**: Add a Content-Security-Policy with a script nonce to the webview, and escape all strings before `innerHTML`.
- [x] **Packaging**: add `MEMORY.md` and `dist/*.map` to `.vscodeignore`; resize `assets/icon.png` to 256 px.
- [x] **Extension tests**: activation, every command registered, Pro gating, on-save debounce, auto-fix on save, lightbulbs and deploy safety. *(Built with Vitest and an in-memory VS Code API stand-in, `test/mocks/vscode.ts`, instead of `@vscode/test-cli`: no VS Code download needed in CI. The sidebar's HTML rendering is not unit-tested.)*
- [x] **Docs drift**: fix the test counts in both roadmaps, add 0.1.1–0.1.5 to `VERSIONING.md`, and tag releases from now on. *(Tags start with v0.5.0 once committed.)*
- [ ] **Release v0.2.4**: *superseded by v0.5.0.*

---

## 📦 Phase 13: v0.3.0 — Zero-Cost Licensing (prerequisite for all Pro work) — size M
**Goal**: Licensing that enforces the 3-machine limit and re-checks refunds, using only Gumroad's free license API. No server and no secrets in the extension (D3).

> Honest limit: any check that runs on the user's machine can be patched out by a determined user. At $9.99 the aim is to keep honest people honest, not perfect DRM.

- [x] **13.1 Activation with a machine count**
  - [x] First activation on a machine calls Gumroad `verify` with `increment_uses_count=true`. Refuse if the returned `uses` is above 3, with a calm message and a support contact.
  - [x] Save `{key, machineIdHash, verifiedAt}` in SecretStorage (`machineIdHash` = SHA-256 of `vscode.env.machineId`). Re-activating on the same machine sends `increment_uses_count=false`, so it never spends a seat twice.
- [x] **13.2 Background re-check**
  - [x] Re-verify every 7 days with `increment_uses_count=false`. Downgrade to Free if the purchase is refunded or charged back.
  - [x] 30-day offline grace from the last successful check; after that, Pro pauses (never the free features) until the next successful check.
- [x] **13.3 Machine resets (manual, $0)**: users email support to free a seat. The maintainer lowers the count with Gumroad's license API using their own seller token, which never ships in the extension. Write the steps in `docs/SUPPORT.md`.
- [x] **13.4 Commands**: "LaunchWizard: License Status" (tier, last check, seats used out of 3) and "LaunchWizard: Remove License From This Machine" (clears local state and links to the reset request).
- [x] **13.5 Gating**: one `requirePro(feature)` helper in the extension layer. It shows one calm upsell only when the user invokes a Pro action, so the free tier stays nag-free.
- [x] **13.6 Tests** (mocked `fetch`): 4th machine refused, same-machine re-activation doesn't increment, refunded → Free, grace window, free features unaffected while Pro is paused.
- [x] **13.7 Docs**: ADR-005 (Gumroad-only licensing, no server); `PRIVACY.md` notes that the license key is re-checked with Gumroad weekly.
- [ ] **Release v0.3.0**, tag. *Superseded by v0.5.0.*

---

## 📦 Phase 14: v0.3.x — Pro: Real Auto-Heal on Save — size M
**Goal**: Saving a file automatically fixes the safe, deterministic build traps, with an instant undo.

- [x] **14.1 Make healers reachable**: detect a missing `'use client'` by scanning Next.js `app/` files that use hooks or event handlers without the directive. Map TS18003 → `fix-tsconfig-include`.
- [x] **14.2 Build the missing fixers** (reopened 3.1 items):
  - [x] `.env` value repair: quote values containing an unquoted `#`. *(Spaces and trailing whitespace are already handled correctly by dotenv, so they are left alone.)*
  - [x] Import-path repair: fix case or extension mismatches only when there is exactly **one** unambiguous matching file (this case breaks Linux CI on Vercel).
- [x] **14.3 Safety classes**: tag each healer `safe` (may run on save: `use client`, import case, `.env` quoting) or `review` (needs a preview: tsconfig include, optional chaining). Optional chaining is never applied automatically because it changes runtime behaviour. ADR-006 records the classification.
- [x] **14.4 Pipeline**: on save → a fast scan of that one file (no full tsc) → apply `safe` heals through `WorkspaceEdit` → a non-blocking toast "Healed 1 issue · Undo". Add a `launchwizard.healOnSave` setting, with consent asked on first use. Never touch `node_modules`, generated or ignored files, or files outside the workspace.
- [x] **14.5 Tests**: a fixture per healer, idempotence (healing twice gives no further change), `review` healers never run on save, Pro gating.
- [x] Flip "Auto-heal on save" back from "Coming soon" (Phase 17 checklist).

---

## 📦 Phase 15: v0.4.0 — Pro: BYOK 1-Click Deploy — size L
**Goal**: Deploy a preview to the user's own Vercel or Cloudflare Pages account from the IDE, gated by a passing pre-flight check. Depends on **D4**.

- [x] **15.1 Connect accounts**: "Connect Vercel" and "Connect Cloudflare" commands store tokens (plus the Cloudflare account ID) in SecretStorage. Pass tokens to child processes through environment variables, never on the command line.
- [x] **15.2 Pre-deploy gate**: pre-flight must pass, then a real local build runs (`<pm> run build`). This finally delivers the reopened 1.3 "framework build" check; build failures go through `ErrorTranslator`.
- [x] **15.3 Vercel**: `vercel deploy --yes` with `VERCEL_TOKEN`. Preview deploy by default; `--prod` only after a second explicit confirmation.
- [x] **15.4 Cloudflare Pages**: `wrangler pages deploy <outputDir> --project-name <name>` with `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`. Detect the output folder per framework (`dist`, `build`, `out`). For Next.js server apps, recommend Vercel instead of failing.
- [x] **15.5 UX and safety**: a confirmation modal names the target, project, branch and preview vs production (AGENTS.md principle 1). Logs stream to an Output channel; the result shows the URL and a QR code.
- [x] **15.6 Tests**: command construction, tokens never in argv, output-folder detection, no deploy without confirmation, gate blocks on a failed pre-flight.
- [x] ADR-007 (BYOK deploy via official CLIs). Flip "BYOK deploy" from "Coming soon".

---

## 📦 Phase 16: v0.5.0 — Pro: Private & Branded Links, Team Preview Cards — size L
**Goal**: Deliver the remaining advertised Pro sharing features. Depends on **D5** and **D6**.

- [x] **16.1 Password-protected tunnels**: a local auth proxy (`node:http`) on a random port in front of the dev server. The tunnel points at the proxy. Access works by passcode (a small login page rather than basic auth, friendlier on phones) or a token link that sets a cookie; the QR code embeds the token so phones skip the prompt. Forward WebSocket upgrades so hot reload keeps working.
  - [x] Tests: 401 without credentials, pass-through with them, WebSocket upgrade refused without auth, passcode rate limit, live test through a real Cloudflare tunnel. *(Each link start creates a new proxy and token.)*
- [x] **16.2 Custom subdomains** (as defined in D5): a guided flow using the user's Cloudflare account (`cloudflared tunnel login` → create a named tunnel → `route dns` to `preview.<their-domain>` → run). Reuse the Phase 15 Cloudflare token where possible. *(Uses `cloudflared tunnel login` instead, so it works without connecting a deploy account.)*
  - [x] Tests: hostname validation (no apex domains), DNS clash never overwritten, tunnel list parsing. *(Beta: not yet run against a live domain.)*
- [x] **16.3 Team preview cards** (as defined in D6): "Copy Preview Card" produces a Markdown/Slack-ready block with the link, a QR image, branch, commit, pre-flight status and expiry, plus a matching card in the deck. No server, no accounts.
  - [x] Tests: Markdown and Slack card content, passcode, expiry, extra ports.
- [x] Flip each feature from "Coming soon" as it ships.

---

## 📦 Phase 17: Pro Relaunch — size S
**Goal**: Re-announce Pro once every advertised feature exists and works.

- [ ] Manual end-to-end matrix: Windows (PowerShell and cmd), macOS, Linux × Next.js, Vite, Astro: pre-flight, heal on save, tunnel (plain, private, custom subdomain), deploy (Vercel, Pages), license activate/deactivate.
  - [x] Windows, done 2026-10-23: Pre-Push Gate with real git (clean push passes, broken push blocked, `--no-verify` bypasses); private link through a real Cloudflare tunnel (401 → token → page, visitor log); first click works after the DNS wait; real `npm audit`/`outdated`.
  - [x] Real VS Code 1.90.0 (the minimum supported version), headless via `@vscode/test-electron`: extension activates, 35/35 commands register, sidebar opens, lightbulb provider runs.
  - [ ] By hand in VS Code / Cursor / Antigravity, macOS, Linux; live Vercel / Cloudflare Pages deploy; live custom domain; real Gumroad key activation.
- [x] Remove every "Coming soon" label; re-check every claim on the site, README, Gumroad and IDE card against the code. Deploy and custom subdomains are labelled "beta".
- [x] Update `VERSIONING.md` and the ADR index (ADR-005–007). *(`docs/PRD.md` and `CONTEXT.md` still describe the original plan; refresh them before the next big feature.)*
- [ ] **Maintainer**: publish `launchwizard-0.5.0.vsix` to the VS Code Marketplace (publisher page ⋮ → Update) and Open VSX, paste the Gumroad copy, run `npm run deploy:site`, and announce.

---

## 💡 Phase 18: Extra Zero-Cost Pro Features — ✅ all seven delivered in v0.5.0
**Goal**: Make Pro worth $9.99 sooner, with features that run entirely on the user's machine (or on their own free accounts) and cost the maintainer nothing.

Free-tier rule (AGENTS.md): manual pre-flight checks, manual tunnels and error explanations stay free. These candidates add **automation, protection or convenience** on top.

| # | Candidate | What the user gets | Needs | Size |
|---|---|---|---|:---:|
| 18.1 | **Secret Leak Guard** | Before a link opens or a deploy runs, scans client code and build output for hard-coded keys (Stripe `sk_live_`, AWS `AKIA…`, OpenAI `sk-…`, private keys) and blocks with a plain-English card | Local regex scan | M |
| 18.2 | **Link Controls** | Auto-expire links after 30/60/120 min, a visitor log (time, device, page), one-click revoke and new URL | The Phase 16.1 local proxy | S (after 16.1) |
| 18.3 | **Pre-Push Gate** | A git `pre-push` hook that runs pre-flight and blocks pushes with blockers (one-click override) | Local git hook | S |
| 18.4 | **Multi-Port Sharing** | Share frontend and API together (e.g. `:3000` + `:8000`) as two links and two QR codes | Two tunnel processes | M |
| 18.5 | **Shareable Pre-Flight Report** | Export the check as Markdown/HTML for a PR description or client handoff | Local | S |
| 18.6 | **Dependency Health** | `npm audit` and outdated-framework warnings, translated to plain English | npm registry (free) | S |
| 18.7 | **Bundle Size Budget** | After a build, "your JS grew 40% since last build" cards with a size budget | Local build (Phase 15.2) | M |

Suggested Pro line-up at relaunch:
- **Ship Safe**: auto-fix on save (14), Secret Leak Guard (18.1), Pre-Push Gate (18.3).
- **Share Pro**: password links (16.1), Link Controls (18.2), custom subdomains (16.2), team cards (16.3).
- **Deploy**: BYOK deploy (15).

Recommended order if approved: 18.3 and 18.1 alongside Phase 14 (they need nothing new), then 18.2 right after 16.1.
