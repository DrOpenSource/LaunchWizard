# 🚀 ShipWizard — The 'Get It Live' Pre-Flight Engine

> **1-Click Secure Shareable Links + Auto-Healing Production TypeScript & Bundle Errors for Vibe Coders.**  
> 🌐 Website: [https://shipwizard.taqnik.in](https://shipwizard.taqnik.in) • ⚡ [Get Lifetime Pro ($9.99)](https://shipwizard.taqnik.in)

**ShipWizard** is an intent-based pre-flight compiler inspector and 1-click shareable preview engine for **VS Code**, **Cursor**, and **Antigravity**. It completes the **DrOpenSource Calm Dev Suite** alongside [GitWizard](https://github.com/DrOpenSource/GitWizard) and [EnvWizard](https://github.com/DrOpenSource/EnvWizard).

---

## ⚡ Why ShipWizard?

Vibe coders and modern AI developers build full-stack apps at lightning speed using Cursor Composer, Claude, and Antigravity. But when it's time to test on a mobile phone or push to production:

1. **The Production Build Trap**: Code that runs locally in `npm run dev` blows up with 200 lines of red compiler errors during `next build` or `vite build` on Vercel or Cloudflare.
2. **The "Check My Phone" Friction**: Testing mobile responsiveness or sending a quick preview to a friend usually requires setting up ngrok tokens, port forwarding, or pushing half-baked commits to staging.
3. **Cryptic Terminal Panic**: Compiler errors like `TS2307`, `TS2322`, or Next.js App Router client directive exceptions cause anxiety and derail flow state.

**ShipWizard gives you complete peace of mind before you ship:**
* **3-Second Pre-Flight Radar**: Non-destructive dry runs catch every build blocker locally before you push to git.
* **1-Click Free Cloudflare Preview**: Instant secure HTTPS preview link (`trycloudflare.com`) with zero configuration, no accounts, and no credit cards.
* **In-IDE Mobile QR Code**: Scan your screen with your phone camera to test live apps on your device in seconds.
* **Plain-English Error Translator**: Translates cryptic compiler codes into friendly, solvable cards.
* **Deterministic 1-Click Auto-Healer**: Safely fixes missing `'use client'`, environment variables (`NEXT_PUBLIC_`), and import paths with full rollback safety.

---

## 🌟 Core Features

### 1. 🔍 The "Get It Live" Pre-Flight Engine
* **Framework Autodetection**: Automatically detects Next.js, Vite, Remix, Astro, SvelteKit, Nuxt, and Vanilla TypeScript.
* **Non-Destructive Compiler Dry Run**: Executes `tsc --noEmit` and static bundle verification in memory.
* **Secret Leak & Prefix Shield**: Catches client components accessing environment variables without `NEXT_PUBLIC_` or `VITE_` prefixes before production builds fail.

### 2. 🌐 1-Click Cloudflare Live Preview & Mobile QR Deck
* **Zero-Config Public Links**: Generates free Cloudflare Quick Tunnels with end-to-end SSL encryption.
* **In-IDE SVG QR Code**: Scannable QR code generated directly in your sidebar webview.
* **Status Bar Radar**: Live port indicator + instant copyable URL (`$(globe) Ship: Live (:3000)`).

### 3. 🗣️ Plain-English Compiler Error Translator
* Translates panic-inducing errors into human language:
  * `TS2307` ➔ *"Missing Module or File Typo"*
  * `TS2322` ➔ *"Value Type Does Not Match"*
  * `USE_CLIENT_MISSING` ➔ *"Interactive Hook in Server Component"*
  * `ENV_LEAK` ➔ *"Missing NEXT_PUBLIC_ Prefix"*

### 4. 🪄 1-Click AST Auto-Healer (With Rollback Shield)
* 1-Click automated patches for the most common vibe coding build traps.
* In-memory rollback registry ensures 100% safe undo with zero code corruption.

---

## 💎 Pricing: Freemium + $9.99 One-Time Lifetime License

* **Free Tier (Forever Free)**:
  * Full local pre-flight compiler dry runs.
  * 1-Click Cloudflare shareable preview links (`trycloudflare.com`).
  * In-IDE Mobile QR Code generator.
  * Plain-English Error Translator.
* **Pro Tier ($9.99 One-Time Lifetime Purchase)**:
  * Automated AST auto-healing on file save.
  * BYOK 1-Click Cloud Deploy (Vercel & Cloudflare Pages).
  * Password-protected preview links & custom subdomains.
  * Activate on up to 3 personal machines.
  * **Zero subscriptions** — pay once, own forever.

👉 **[Get Pro Lifetime at shipwizard.taqnik.in](https://shipwizard.taqnik.in)**

---

## 🧩 The DrOpenSource Calm Dev Suite

ShipWizard completes the three pillars of the vibe coding lifecycle:

1. **[GitWizard](https://github.com/DrOpenSource/GitWizard)**: Protects your source code history and auto-saves against AI overwrites.
2. **[EnvWizard](https://github.com/DrOpenSource/EnvWizard)**: Unjams your local dev ports (`3000`, `5173`) and heals missing `.env` variables.
3. **[ShipWizard](https://github.com/DrOpenSource/ShipWizard)**: Ensures clean production builds and gives you instant 1-click shareable preview tunnels.

---

## 🛠️ Development & Testing

```bash
# Run the complete isolated Vitest test suite
npm test

# Strict TypeScript typechecking
npm run compile

# Bundle extension with esbuild
npm run build
```

---

## 📜 License
MIT © Dr. OpenSource
