# 🗺️ LaunchWizard — Sprint Tracker & Roadmap Memory

This document tracks all implementation phases, verification milestones, and ongoing technical initiatives.

---

## 📊 Phase-Wise Progress Status

| Phase | Description | Status | Verification Gate |
|---|---|:---:|---|
| **Phase 1: Scaffolding & Pre-Flight Engine** | Framework detection, package manager resolution, non-destructive `tsc --noEmit` & dry-run parser. | ✅ Complete | `test/preflight-engine.test.ts`, `test/framework-detector.test.ts` passing. |
| **Phase 2: Error Translator** | Plain-English translation cards, glossary for TS2307, TS2322, SSR window bugs, Next.js traps. | ✅ Complete | `test/error-translator.test.ts` passing. |
| **Phase 3: AST & Regex Auto-Healer** | 1-Click fixes (`'use client'`, `NEXT_PUBLIC_`, `VITE_`, optional chaining, `.env` quotes), shadow rollback. | ✅ Complete | `test/auto-healer.test.ts` passing. |
| **Phase 4: Instant Tunnels & QR Code** | Cloudflare Quick Tunnels, fallback runners, in-IDE SVG/base64 QR codes, lifecycle management. | ✅ Complete | `test/qr-generator.test.ts`, `test/tunnel-manager.test.ts` passing. |
| **Phase 5: Calm UI Deck & Extension** | Pre-Flight Deck Webview, Status Bar Radar, inline code action lightbulbs, 1-click healing. | ✅ Complete | Webview postMessage synchronization, command palette integration. |
| **Phase 6: $9.99 Lifetime Licensing** | Cryptographic offline key check + Gumroad verification API, feature gating (auto-heal on save). | ✅ Complete | `test/license-manager.test.ts` passing. |
| **Phase 7: Landing Page & Portfolio** | Modern marketing page (`index.html`) on Cloudflare Pages, Gumroad embed, Calm Suite links. | ✅ Complete | Live on `https://launchwizard.taqnik.in`. |
| **Phase 8: Packaging & Verification** | Strict compile check, Vitest 41/41 test pass, VSIX package generation (`launchwizard-0.2.1.vsix`). | ✅ Complete | Production extension bundled and packaged. |
| **Phase 9: Tunnel Resilience & Memory Architecture** | Fix Localtunnel timeouts & Bad Gateway, add OpenSSH fallback, create Project Memory Architecture (ADRs, context, versioning), release v0.2.2. | ✅ Complete | 44/44 Vitest tests passing, `launchwizard-0.2.2.vsix` packaged. |
| **Phases 10–18: Audit Remediation & Pro Build-out** | Honest copy, all 13 audit bugs fixed, zero-cost Gumroad licensing, auto-fix on save, Secret Leak Guard, Pre-Push Gate, private links, team cards, multi-port, Dependency Health, Bundle Budget, BYOK deploy (beta), custom subdomains (beta). Details: [`docs/ROADMAP.md`](../ROADMAP.md). | ✅ Built (v0.5.0) | 132/132 Vitest tests; headless run in VS Code 1.90.0; live Windows smoke tests. Publishing and some hand tests are still with the maintainer. |

---

## 🎯 Active Sprint: Tunnel Reliability & Memory Architecture (v0.2.2)

- [x] Diagnose Localtunnel 35s timeout and Windows child process lag.
- [x] Diagnose Localtunnel anti-phishing interstitial screen and mobile incompatibility.
- [x] Diagnose 502 Bad Gateway caused by `localhost` IPv6 `::1` resolution on Windows dev servers.
- [x] Patch `TunnelManager.ts` with `--local-host 127.0.0.1` and raise timeout threshold to 45000ms.
- [x] Refactor `test/tunnel-manager.test.ts` to mock child process lifecycle and prevent flaky network test failures.
- [x] Build and link Project-Level Memory Architecture (`docs/memory/`).
- [x] Add OpenSSH / `localhost.run` zero-interstitial fallback to eliminate drop-offs completely.
- [x] Add multi-provider automatic cascading (`Cloudflare` -> `localhost.run` -> `Localtunnel`).
- [x] Achieve 100% test pass (44/44 Vitest unit tests passing cleanly).
- [x] Tag and bundle `v0.2.2` (`launchwizard-0.2.2.vsix`).

## ⏭️ Next: Release v0.5.0 (maintainer actions)

All code for Phases 10–18 is built and tested (see [`docs/ROADMAP.md`](../ROADMAP.md)). Rule: everything runs at $0 for the maintainer (no paid servers; licensing is Gumroad-only, ADR-005). Remaining, all outward-facing or needing real accounts:

- [ ] Commit and tag `v0.5.0`.
- [ ] Publish `launchwizard-0.5.0.vsix` (Marketplace: publisher page ⋮ → Update; Open VSX).
- [ ] `npm run deploy:site`; paste the Gumroad copy from `docs/GUMROAD_LISTING.md`; enable "unique license key per sale".
- [ ] Hand tests: real Gumroad key activation, live Vercel / Cloudflare Pages deploy, live custom domain, macOS and Linux.

---

## 🔮 Future Roadmap Horizons

1. **Portable Zero-Install Cloudflared Binary**:
   - Provide an automated portable downloader for `cloudflared` binary on Windows, macOS, and Linux when not found in system PATH.
2. **Next.js 15 App Router Deep Linter**:
   - Detect dynamic server route exports (`export const dynamic = 'force-dynamic'`), missing metadata configs, and unhandled Server Actions.
3. **Calm Dev Suite Unified Command Bar**:
   - Deep integration with GitWizard (pre-commit auto-check) and EnvWizard (auto-injecting missing `.env.production` keys).
