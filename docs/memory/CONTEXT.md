# 🧭 LaunchWizard — System Context & Tenets

## 1. Product Identity & Purpose

**LaunchWizard** (formerly ShipWizard) is an intent-based "Get It Live" pre-flight engine and 1-click shareable tunnel extension for **VS Code**, **Cursor**, and **Antigravity**. It solves the acute friction point modern developers face right before deployment:

1. **The Build Panic Trap**: Developers writing apps with AI prompt-driven workflows ("vibe coders") frequently build frontend apps that run locally in hot-reloading dev servers (Vite, Next.js), but completely crash when running production builds (`next build` / `vite build` / Vercel / Cloudflare Pages) due to missing `'use client'` directives, unquoted `.env` keys, or TypeScript type traps (`TS2307`, `TS2322`).
2. **The Share Link Friction**: Setting up tunnels, cloud accounts, CLI logins, or ngrok authtokens just to test a mobile viewport or show a colleague is overwhelming and high-friction.

---

## 2. Target Persona: The "Vibe Coder"

- **Profile**: Creators, designers, founders, and junior-to-mid developers who build using AI (Claude, Cursor, Antigravity, ChatGPT).
- **Pain Points**:
  - Paralyzed by walls of cryptic compiler errors (`TS2307: Cannot find module`, `Rollup failed to resolve import`).
  - Hates reading complex documentation to find why a production build failed.
  - Wants a simple, calm button that explains errors in plain English and offers a 1-click auto-fix.
  - Needs to test on their phone immediately via a QR code without entering credit cards or opening tunnel accounts.

---

## 3. The DrOpenSource Calm Dev Suite Triad

LaunchWizard is designed to sit alongside [GitWizard](https://github.com/DrOpenSource/GitWizard) and [EnvWizard](https://github.com/DrOpenSource/EnvWizard):

```
                   ┌────────────────────────────┐
                   │    DR OPENSOURCE SUITE     │
                   └─────────────┬──────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
   ┌───────────┐           ┌───────────┐           ┌───────────┐
   │ GitWizard │           │ EnvWizard │           │LaunchWizard│
   │Auto-saves │           │Unjams port│           │Pre-flight │
   │  & heals  │           │& heals env│           │ & instant │
   │git history│           │ variables │           │  tunnels  │
   └───────────┘           └───────────┘           └───────────┘
```

- **Aesthetic**: Premium dark-mode glassmorphic styling, non-blocking toasts, zero noise, 1-click intent triggers.
- **Tone**: Calm, reassuring, human-first, zero developer shaming.

---

## 4. Technical Architecture & Constraints

1. **Zero-IDE Core Engine (`src/core/`)**:
   - Must have **zero** dependencies on `vscode` APIs.
   - Any module in `src/core/` can run in CLI, Node scripts, WebWorkers, or browser runtimes.
   - All VS Code webviews and commands live exclusively in `src/extension/`.

2. **Non-Destructive Pre-Flight Dry Runs**:
   - Pre-flight checks execute compiler checks in memory or dry-run processes (`tsc --noEmit`, framework build dry-runs).
   - Source code files must never be modified without shadow in-memory rollback checkpoints (`AutoHealer.rollback()`).

3. **Platform Constraints & Network Dynamics**:
   - **OS Execution**: Windows PowerShell / cmd, macOS, Linux.
   - **IPv4 vs IPv6 on Windows**: Dev servers (Vite, Next.js) often listen on IPv4 `127.0.0.1`. Tunnel clients defaulting to `localhost` can resolve to IPv6 `::1`, causing `ECONNREFUSED` / 502 Bad Gateway. Always explicitly specify `127.0.0.1`.
   - **Tunnel Providers**:
     - *Primary*: Cloudflare Quick Tunnels (`cloudflared tunnel --url http://127.0.0.1:<port>`). Zero account, zero interstitial gate, instant HTTPS.
     - *Built-in Windows Fallback*: Windows 10/11 includes `ssh.exe` (`C:\Windows\System32\OpenSSH\ssh.exe`). Can leverage SSH reverse tunneling (`localhost.run`, `pinggy.io`) without third-party CLI installations.
     - *Localtunnel*: Legacy fallback (`npx localtunnel`). Requires explicit `--local-host 127.0.0.1` and longer timeouts; subject to Localtunnel's public anti-phishing interstitial screen.

4. **Monetization Principles**:
   - **Free Forever**: Pre-flight inspection, error translations, basic auto-fixes, and manual tunnel launching remain free with zero nag-screens.
   - **$9.99 One-Time Lifetime License**: Unlocks background auto-healing on save, BYOK cloud deployment, custom subdomains, and preview cards. Zero monthly subscriptions.
