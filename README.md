# 🚀 LaunchWizard — The 'Get It Live' Pre-Flight Engine

> **Catch production build errors before you deploy, read them in plain English, fix the common ones in one click, and share a live HTTPS link with a phone QR code.**  
> 🌐 Website: [https://launchwizard.taqnik.in](https://launchwizard.taqnik.in) • ⚡ [Get Lifetime Pro ($9.99)](https://launchwizard.taqnik.in/#pricing)

**LaunchWizard** is a pre-flight checker and 1-click shareable preview engine for **VS Code**, **Cursor**, and **Antigravity**. It completes the **DrOpenSource Calm Dev Suite** alongside [GitWizard](https://github.com/DrOpenSource/GitWizard) and [EnvWizard](https://github.com/DrOpenSource/EnvWizard).

---

## ⚡ Why LaunchWizard?

You build fast with AI tools. Then:

1. **The production build trap**: code that runs in `npm run dev` fails during `next build` or `vite build` on Vercel or Cloudflare.
2. **The "check it on my phone" friction**: sharing a preview means ngrok tokens, port forwarding, or pushing half-finished work.
3. **Cryptic errors**: `TS2307`, `TS2322` and Next.js `'use client'` errors stop your flow.

LaunchWizard checks your project locally, explains every problem in plain English, fixes the safe ones for you (with undo), and gives you a live link in one click.

---

## 🆓 Free, forever

* **Pre-flight check**: runs your project's own `tsc --noEmit`, audits browser env variables, and scans for traps the compiler misses: a missing `'use client'`, imports whose letter case only works on Windows/macOS, and `.env` values silently cut off at `#`. It never reports "all clear" unless the check really ran and passed.
* **Full production build check**: runs your real `build` script and turns Next.js, webpack and Vite/Rollup errors into plain-English cards.
* **Plain-English error cards**: what happened, why it breaks your deploy, and what to do, with a clickable `file:line`.
* **1-click fixes with preview and undo**: see the diff before anything changes; undo with Ctrl+Z or "Undo Last Fix". LaunchWizard never offers to make a secret-looking variable public.
* **Shareable HTTPS link + phone QR code**: Cloudflare Quick Tunnel (falls back to localhost.run or localtunnel), with a health check first, cancellable startup, and support for dev servers on IPv6.

## 💎 Pro: $9.99 once, no subscription

| Group | Feature | What you get |
| --- | --- | --- |
| Ship safe | **Auto-fix on save** | Safe fixes (`'use client'`, import letter case, `.env` quoting) applied when you save, with an Undo button. |
| Ship safe | **Background check on save** | The pre-flight check re-runs after you save (debounced). |
| Ship safe | **Secret Leak Guard** | Finds hard-coded keys (Stripe, AWS, OpenAI, Anthropic, GitHub, Supabase service role, database URLs and more) in code and build output, before you share or deploy. |
| Ship safe | **Pre-Push Gate** | A git hook that stops pushes with build blockers (`git push --no-verify` skips it once). Never overwrites hooks it didn't write. |
| Ship safe | **Dependency Health** | `npm audit` and outdated-framework warnings in plain English (npm and pnpm). |
| Ship safe | **Bundle Size Budget** | How much JavaScript visitors download, build to build, against a budget you set. |
| Share | **Private links** | Passcode-protected links; the shared link and QR code open directly for the people you send them to. |
| Share | **Link controls** | Links that close themselves after 30 min to 2 h, plus a visitor log (device, browser, page). |
| Share | **Multi-port sharing** | Share your frontend and API together. |
| Share | **Team preview cards** | One paste for Slack or a PR: link, passcode, branch, commit, build status, plus a QR code image. |
| Share | **Custom subdomains** *(beta)* | `preview.yourdomain.com` through a free named Cloudflare Tunnel on your own domain. |
| Ship | **BYOK deploy** *(beta)* | Deploy to Vercel or Cloudflare Pages with your own free account. Pre-flight check first; preview by default; production needs two confirmations. |
| Ship | **Shareable reports** | Export the pre-flight report as Markdown or HTML. |

One license covers up to 3 of your personal machines. Pay once, own it forever.

👉 **[Get Pro Lifetime at launchwizard.taqnik.in](https://launchwizard.taqnik.in/#pricing)**

---

## ⚠️ Current Limitations (v0.5.0)

We'd rather you know these up front:

* **Beta features**: BYOK deploy and custom subdomains are tested against simulated Vercel/Cloudflare tools, not yet against live accounts. Report anything odd and it will be fixed quickly.
* **Fixes cover common traps only**: other errors get a plain-English explanation, not an automatic fix.
* **The full build check runs your real build**: it writes the normal output folders (`.next`, `dist`, …) but never changes source files. It can take a few minutes on large projects.
* **Preview links**: install the free [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) app for the best links. Without it, localtunnel shows visitors an IP check page. A new link takes about 10–30 seconds to work worldwide; LaunchWizard waits for that before saying it's ready. Free links are public to anyone with the URL.
* **Secret Leak Guard is pattern-based**: it catches well-known key formats but can't promise to find every secret.
* **Dependency Health** supports npm and pnpm projects (yarn and bun users can run their own audit command).
* **Pre-Push Gate** needs Node.js on your PATH. With Husky or another custom hooks folder, LaunchWizard gives you one line to paste instead of editing your hooks.
* **Licensing**: activation needs the internet once; Pro then works offline for 30 days between checks. To move a seat to another machine, ask support.
* **Platforms**: verified by hand on Windows. macOS and Linux are covered by the automated tests but not yet by hand.

---

## 🧩 The DrOpenSource Calm Dev Suite

1. **[GitWizard](https://github.com/DrOpenSource/GitWizard)**: protects your source code history and auto-saves against AI overwrites.
2. **[EnvWizard](https://github.com/DrOpenSource/EnvWizard)**: unjams your local dev ports (`3000`, `5173`) and heals missing `.env` variables.
3. **[LaunchWizard](https://github.com/DrOpenSource/LaunchWizard)**: clean production builds and instant shareable preview links.

---

## 🛠️ Development & Testing

```bash
npm test          # Vitest suite (core engine + extension layer with a VS Code API stand-in)
npm run compile   # strict TypeScript check against the VS Code 1.90 API
npm run build     # bundles dist/extension.js and the pre-push checker dist/cli.js
npm run package   # builds the .vsix
```

---

## 📜 License
MIT © Dr. OpenSource
