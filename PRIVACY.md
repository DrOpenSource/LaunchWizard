# 🛡️ Privacy Policy — LaunchWizard

> **Last Updated: October 2026 (v0.5.0)**

We believe developer tools should operate with total transparency and zero surveillance. **LaunchWizard** runs on your computer, has no servers of its own, and collects no analytics.

---

## 1. Zero Telemetry & Zero Data Collection

- **No Remote Transmission of Code**: pre-flight checks, the build check, fixes, the Secret Leak Guard and the Pre-Push Gate run **strictly locally on your computer**.
- **No Source Code Uploads**: your files, secrets and project structure are never sent to LaunchWizard or any analytics service. The only time your code leaves your machine is when **you** choose to deploy it to your own Vercel or Cloudflare account (section 4).
- **Local storage only**: your license, deploy tokens, the last-fix undo point and bundle-size history are stored by VS Code on your machine.

---

## 2. Public Preview Links

- When you explicitly create a shareable link, LaunchWizard connects your chosen local port to a temporary public HTTPS URL using the first available provider:
  1. **Cloudflare Quick Tunnel** (`cloudflared`, `*.trycloudflare.com`) if the `cloudflared` app is installed.
  2. **localhost.run** over SSH (`*.lhr.life`) if `ssh` is available.
  3. **localtunnel** (`*.loca.lt`), downloaded on demand from the public npm registry via `npx`.
- Before announcing a Cloudflare link, LaunchWizard asks Cloudflare's public DNS resolver (`1.1.1.1`) whether the new hostname is live. Only the hostname is sent.
- Visitors' traffic to your link passes through that provider's servers to your machine. Each provider's own privacy policy applies.
- **Pro visitor log**: for Pro links, a small proxy on your machine records each page visit (time, device type, browser, page path and IP address) **in memory only**. It is shown to you in the editor, never sent anywhere, and is gone when the link stops.
- **Custom subdomains (Pro)**: these run through a named Cloudflare Tunnel in **your own** Cloudflare account, which you log in to yourself.
- Anyone with a link can open it until you stop it (or, for Pro passcode links, until it expires).

---

## 3. License Verification

- When you activate LaunchWizard Pro, and about once a week afterwards, your license key is sent to Gumroad's license API (`api.gumroad.com`) to check it is valid and not refunded. No code, workspace or environment details are sent.
- To count your 3 machines, LaunchWizard stores a one-way hash of VS Code's machine identifier **on your machine**. It is not sent to Gumroad or anyone else.

---

## 4. Pro Tools That Contact Third Parties (only when you run them)

- **BYOK deploy**: uploads your project to **your own** Vercel or Cloudflare Pages account using the token you provide. Tokens are kept in VS Code's secure storage on your machine and passed to the official Vercel / Wrangler tools as environment variables.
- **Dependency Health**: runs `npm audit` / `npm outdated` (or the pnpm equivalents), which send your dependency list to the public npm registry, exactly as when you run those commands yourself.

---

## Contact
For privacy questions, visit: [launchwizard.taqnik.in](https://launchwizard.taqnik.in)
