# ADR-001: Cloudflare Quick Tunnels as Primary with Built-in Windows SSH & Localtunnel Fallback

- **Status**: Accepted
- **Date**: 2026-10-14
- **Deciders**: Dr. Shubham Kashyap & Antigravity AI Agent

---

## 1. Context & Problem Statement

LaunchWizard’s core value proposition for "vibe coders" is **1-Click Instant Shareable Links** with a mobile-friendly QR code. The user must be able to scan their phone camera or send a link to a client without configuring accounts, adding SSH keys, or entering credit cards.

Traditional tunneling tools introduce friction:
- **Ngrok**: Requires signup, authentication tokens (`ngrok config add-authtoken`), and has restrictive bandwidth/session limits on free tiers.
- **Localtunnel (`loca.lt`)**: Free and requires no account, but has three major flaws:
  1. *Anti-Phishing Interstitial Screen*: Every visitor to a `loca.lt` URL in a browser is intercepted with a warning page demanding they type in the host’s public IP address before proceeding. This breaks QR-code mobile testing.
  2. *Slow Startups & Timeouts*: Spawning `npx --yes localtunnel` on Windows often takes 35-40 seconds, exceeding default timeouts and causing VS Code error toasts.
  3. *IPv6 Bad Gateway*: Without explicitly specifying `--local-host 127.0.0.1`, localtunnel connects to `localhost`. On Windows, `localhost` often resolves to IPv6 `::1`, but local dev servers (Vite, Next.js) listen on IPv4 `127.0.0.1`. When traffic hits `loca.lt`, it returns `502 Bad Gateway`.

---

## 2. Decision

1. **Primary Tunnel Engine: Cloudflare Quick Tunnels (`cloudflared`)**:
   - Uses Cloudflare's global edge network via `cloudflared tunnel --url http://127.0.0.1:<port>`.
   - Generates a clean `https://<random>.trycloudflare.com` URL.
   - Requires zero accounts, zero tokens, and displays **NO interstitial warning screens**.
   - Renders cleanly on any mobile browser upon scanning the IDE's generated QR code.

2. **Windows Built-in OpenSSH Fallback**:
   - Windows 10/11 includes `ssh.exe` (`C:\Windows\System32\OpenSSH\ssh.exe`).
   - Can establish reverse tunnels via zero-config SSH relays (`localhost.run` or `pinggy.io`) with zero software installation and no interstitial screen.

3. **Localtunnel Hardening (Tertiary Fallback)**:
   - When falling back to `localtunnel`, always pass `--local-host 127.0.0.1` to prevent IPv6 [::1] connection drops and 502 Bad Gateway errors.
   - Increase timeout from 35,000ms to 45,000ms to accommodate Windows `npx` resolution.
   - Notify the user to install `cloudflared` (e.g. `winget install --id Cloudflare.cloudflared`) for the best zero-interstitial experience.

---

## 3. Consequences

### Positive
- Users with `cloudflared` get instantaneous, zero-friction links with no IP challenge page.
- Adding `--local-host 127.0.0.1` eliminates the 502 Bad Gateway error on Windows dev servers.
- Increased timeout eliminates false-positive 35s timeout errors.

### Negative / Tradeoffs
- If `cloudflared` is not pre-installed, Localtunnel still shows the mandatory IP challenge page due to `loca.lt` upstream policy.
- Future work should bundle or auto-download a portable `cloudflared` binary to eliminate `localtunnel` entirely.
