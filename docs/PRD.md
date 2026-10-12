# 🚀 ShipWizard — Product Requirements Document (PRD)

> **"The 'Get It Live' Pre-Flight Engine: 1-click secure tunnels + auto-healing production bundle & TypeScript errors before deploying to Vercel and Cloudflare."**

---

## 1. Executive Summary & Vision

**ShipWizard** is an intent-based pre-flight inspection and instant shareable tunnel extension for **VS Code**, **Cursor**, and **Antigravity**. It completes the DrOpenSource Calm Dev Suite alongside [GitWizard](https://github.com/DrOpenSource/GitWizard) and [EnvWizard](https://github.com/DrOpenSource/EnvWizard).

### The Problem
Vibe coders and modern AI developers write code faster than ever before. But when it's time to test on a mobile phone or push to production:
1. **The Production Build Trap**: Code that runs fine locally in development (`npm run dev`) frequently explodes during production builds (`next build`, `vite build`) on Vercel or Cloudflare due to:
   - TypeScript strictness violations (`TS2307`, `TS2322`, `TS7006`)
   - Missing client directives (e.g. Next.js missing `'use client'`)
   - Missing environment variables or client-side exposure bugs (e.g. missing `NEXT_PUBLIC_` or `VITE_` prefix)
   - Dynamic server route mismatches and unconfigured image hostnames
2. **The "Check My Phone" Frustration**: Testing a web app on a mobile device or sharing a quick link with a co-founder requires setting up complex port-forwarding, ngrok auth tokens, or premature git pushes to staging.
3. **Cryptic Terminal Panic**: Vibe coders get hit with a 200-line compiler traceback that causes anxiety, stalling their creative momentum.

### The Solution
ShipWizard provides:
* **Pre-Flight Radar**: A 1-click or passive check that catches every build-breaking bug locally in under 3 seconds before you push to git or trigger a CI/CD build.
* **Plain-English Error Translator**: Translates cryptic TypeScript and bundler errors into clear, friendly cards.
* **Auto-Healer**: 1-click automated fixes for common build blockers (missing imports, `'use client'`, env prefixes, type assertions).
* **Instant Secure Tunnel**: 1-click zero-config Cloudflare Quick Tunnel (`https://*.trycloudflare.com`) paired with an instant in-IDE QR Code for mobile testing.
* **Vibe-Friendly Monetization**: 100% free manual tunnels & local checks, with a **$9.99 One-Time Lifetime License** for automated healing on save and BYOK cloud pipelines.

---

## 2. Product Philosophy: The GitWizard & EnvWizard DNA

ShipWizard follows the exact core design philosophy proven across DrOpenSource products:

| DrOpenSource Tenet | ShipWizard Implementation |
| :--- | :--- |
| **🛡️ Safe Defaults & Zero Loss** | All auto-heals create non-destructive diffs with instant undo. Pre-flight checks run pure non-emitting dry runs (`tsc --noEmit`). |
| **🗣️ Plain-English Translations** | Translates `TS2307`, `TS2322`, Rollup chunk limits, and Next.js SSG errors into conversational cards with clear fixes. |
| **⚡ Intent-Driven Calm Deck** | 1-Click *"Run Pre-Flight"*, *"Get Live Link"*, *"Auto-Heal Build"*, and *"Scan Mobile QR"* action triggers. |
| **📡 Passive Guardian** | Non-intrusive status bar indicator (`$(rocket) Ship: Ready | Live [Link]`) that surfaces build health without popups. |
| **💰 Fair Pay-Once Pricing** | **$9.99 Lifetime License** on Gumroad. No recurring subscription fees. Cloud add-ons use BYOK (Bring Your Own Key). |

---

## 3. Target Audience & Personas

### Persona A: "The Vibe Coder" (Primary)
* **Profile**: Founders, designers, creators, and hobbyists building full-stack apps with Cursor Composer, Claude, and Antigravity.
* **Pain Points**: Doesn't want to learn the intricacies of TypeScript configs or Webpack/Rollup chunking. Pushes code to Vercel, gets an email 3 minutes later saying `Build Failed (Command "npm run build" exited with 1)`, and feels defeated.
* **Value Realization**: ShipWizard catches the exact error in the editor, translates it to plain English, and provides a 1-click button to fix it. Then gives them a live link to test on their phone immediately.

### Persona B: "The Solo Indie Hacker / Client Freelancer" (Secondary)
* **Profile**: Solo builders delivering web apps to clients or testing responsive mobile layouts.
* **Pain Points**: Needs to show a client an in-progress feature right now without setting up a staging branch or dealing with ngrok token limits.
* **Value Realization**: Clicks "Get Live Link" in the status bar, gets an instant HTTPS URL with a QR code, scans it with their phone or sends the link to the client.

---

## 4. Core Features & Specifications

### 4.1 The "Get It Live" Pre-Flight Engine
1. **Framework Autodetection**:
   - Inspects `package.json` to identify project framework:
     - Next.js (App Router / Pages Router)
     - Vite (React, Vue, Svelte, Solid, Vanilla)
     - Astro, SvelteKit, Remix, Nuxt
     - Pure Node.js / TypeScript
2. **Non-Destructive Dry Run**:
   - Runs `tsc --noEmit` if TypeScript is present.
   - Executes framework dry-run build checks in an isolated sub-process.
3. **Environment & Secret Pre-Check**:
   - Inspects source code references to `process.env` or `import.meta.env`.
   - Cross-checks with `.env`, `.env.local`, and `.env.production`.
   - Flags missing variables and warns about un-prefixed secrets in client components (e.g. `API_KEY` used in a client file instead of `NEXT_PUBLIC_API_KEY`).

### 4.2 Plain-English Error Translator & Auto-Healer
1. **Error Glossary & Pattern Engine**:
   - Matches standard TypeScript error codes (`TS2307`, `TS2322`, `TS2339`, `TS7006`) and bundler exceptions.
   - Generates friendly diagnostic cards:
     ```
     🚨 Missing Client Directive
     Plain English: You used a React Hook (useState) in a Server Component.
     Why it breaks: Next.js requires 'use client' at the top of interactive files.
     [⚡ 1-Click Fix: Add 'use client' to line 1]
     ```
2. **Deterministic Auto-Healers**:
   - **Missing 'use client'**: Prepends `'use client';` directive to the top of the file.
   - **Env Prefix Fixer**: Automatically replaces `process.env.KEY` with `process.env.NEXT_PUBLIC_KEY` or `import.meta.env.VITE_KEY` and syncs `.env`.
   - **Missing Imports**: Scans workspace exports and adds missing named/default imports.
   - **Type Assertion / Cast**: Adds safe null checks or optional chaining (`?.`) when undefined property errors occur.

### 4.3 Instant Shareable Tunnel & Mobile QR Deck
1. **Cloudflare Quick Tunnel Integration**:
   - Leverages `cloudflared` (zero auth, 100% free, secured by Cloudflare SSL).
   - Dynamically parses the generated `https://*.trycloudflare.com` URL.
   - Health-checks the local dev port (e.g. `3000`, `5173`) before launching the tunnel.
2. **In-IDE QR Code & Mobile Deck**:
   - Renders crisp SVG/Canvas QR code directly inside the Webview sidebar.
   - One-click copy link, open in browser, or share via system clipboard.
   - Tunnel timer & traffic monitor showing active uptime and graceful 1-click stop.

### 4.4 Pro Tier & BYOK Cloud Deployment ($9.99 Lifetime)
1. **Gumroad License Verification**:
   - Offline cryptographic verification and online Gumroad API validation.
   - Up to 3 developer machines per license.
2. **BYOK Cloud Pipelines**:
   - Users can provide their own Cloudflare or Vercel API token.
   - Zero-config 1-click push to production directly from the editor without leaving their flow state.
3. **Background Auto-Healing**:
   - Automatically runs pre-flight checks on file save (debounced 1000ms) with inline editor lightbulbs.

---

## 5. User Interface & Experience Architecture

### 5.1 Status Bar Radar
* **Idle State**: `$(rocket) ShipWizard: Ready`
* **Pre-Flight In Progress**: `$(sync~spin) ShipWizard: Checking Build...`
* **Errors Found**: `$(error) ShipWizard: 2 Build Blockers [Fix]`
* **Live Tunnel Active**: `$(globe) ShipWizard: Live [https://...] $(link-external)`

### 5.2 Activity Bar Webview Deck (`PreFlightDeckView`)
* **Header**: Calm glassmorphic badge with DrOpenSource branding and active framework badge.
* **Pre-Flight Card**: Status indicator (Green checkmark or Red warning with plain-English explanation).
* **Live Tunnel Card**: 
  * Live URL with copy button
  * Interactive mobile QR code
  * Uptime counter
  * "Stop Tunnel" button
* **Auto-Heal Action Center**: List of detected build blockers with 1-click "Heal All" or individual "Heal" buttons.

---

## 6. Verification & Quality Assurance Strategy

* **Unit Testing**: Vitest suite covering `PreFlightEngine`, `ErrorTranslator`, `AutoHealer`, `TunnelManager`, and `LicenseManager`.
* **Cross-Platform Compatibility**: Tested on Windows, macOS, and Linux.
* **Zero Telemetry**: Respects user privacy; no tracking or telemetry collection.
