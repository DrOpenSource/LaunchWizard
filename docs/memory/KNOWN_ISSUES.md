# 🐞 LaunchWizard — Known Issues & Bug Ledger

This document catalogs active, investigated, and resolved bugs, architectural limitations, and diagnostics.

---

## 🔎 Bug Triage: October 2026 Live Issues

The following three issues were submitted for triage via user screenshot diagnostics:

| ID | Issue Description | Screenshot Symptom | Classification | Status |
|---|---|---|:---:|:---:|
| **BUG-001** | Tunnel process timeout after 35s | VS Code Error: *"Timed out waiting for localtunnel tunnel to start after 35000ms."* | **Software Bug / Flawed Timeout** | ✅ Resolved in `v0.2.2` |
| **BUG-002** | Localtunnel anti-phishing challenge screen | Desktop Browser: *"You are about to visit... enter the IP shown above [152.58.163.30]"* | **Upstream Provider Flaw** | ⚠️ Mitigated & Documented |
| **BUG-003** | Bad Gateway 502 on mobile viewport | Mobile Browser: *"Bad Gateway"* at `*-papers-warn.loca.lt` | **Binding Bug (IPv4 vs IPv6)** | ✅ Resolved in `v0.2.2` |

---

### Detailed Analysis of Issues

#### 1. BUG-001: Timed Out Waiting for localtunnel Tunnel (Image 3)
- **Symptom**: VS Code displays error notification:
  > `LaunchWizard Preview Error: Timed out waiting for localtunnel tunnel to start after 35000ms. Source: LaunchWizard`
- **Is this a bug or version mismatch?**:
  **It is a real software bug in LaunchWizard's tunnel orchestration and timeout threshold, NOT a version mismatch.**
- **Root Cause**:
  1. `TunnelManager.ts` checked if `cloudflared` is installed via `where.exe cloudflared`. Because `cloudflared` was not installed on the developer's machine, it silently fell back to `npx --yes localtunnel --port <port>`.
  2. On Windows, executing `npx --yes localtunnel` in a child shell requires npm package resolution + network handshake with overloaded public `localtunnel.me` servers.
  3. Live terminal tests revealed that this process takes **37 to 42 seconds** on Windows.
  4. Because `TunnelManager` had a hardcoded `timeoutMs = 35000`, the timeout timer fired before the tunnel URL was printed, killing the process and throwing the error.
- **Resolution**:
  - Increased timeout threshold from 35,000ms to 45,000ms in `TunnelManager.ts`.
  - Added deterministic mock process testing in `test/tunnel-manager.test.ts` so Vitest never hangs or flakes on slow network tunnels.

---

#### 2. BUG-002: Localtunnel Anti-Phishing Interstitial Page (Image 2)
- **Symptom**: When visiting the shareable link on a desktop browser, the user is intercepted with:
  > `You are about to visit: https://cuddly-papers-warn.loca.lt. This tunnel is hosted by: 152.58.163.30. This website is served for free via localtunnel... To continue, enter the IP shown above.`
- **Is this a bug or version mismatch?**:
  **It is an upstream anti-abuse design barrier on Localtunnel's public network, NOT a version mismatch.**
- **Root Cause**:
  1. In 2022, Localtunnel (`loca.lt`) introduced a mandatory interstitial screen to prevent phishing abuse on free tunnels.
  2. The page requires every human visitor to manually enter the host's public IP address before loading the application.
  3. This completely breaks LaunchWizard's core promise of a "1-click instant share link for mobile phone testing or sharing with clients" because mobile camera scans are blocked by the IP challenge form.
- **Resolution & Mitigation**:
  - Cloudflare Quick Tunnels (`trycloudflare.com`) do NOT have interstitial challenge pages.
  - The extension now guides developers to install Cloudflare Quick Tunnels:
    ```powershell
    winget install --id Cloudflare.cloudflared
    ```
    Once installed, LaunchWizard automatically routes through Cloudflare with zero interstitial barriers.

---

#### 3. BUG-003: 502 Bad Gateway on Mobile / Browser (Image 1)
- **Symptom**: Accessing the tunnel URL on a mobile device returns a black screen with:
  > `Bad Gateway`
- **Is this a bug or version mismatch?**:
  **It is an architectural networking bug in LaunchWizard's localtunnel command invocation, NOT a version mismatch.**
- **Root Cause**:
  1. By default, running `npx localtunnel --port <port>` forwards incoming requests to `localhost:<port>`.
  2. On Windows 10/11, `localhost` resolves to the IPv6 loopback address `::1`.
  3. Modern web dev servers (Vite 5+, Next.js, Astro) bind exclusively to the IPv4 loopback address `127.0.0.1` unless explicitly started with `--host 0.0.0.0`.
  4. When Localtunnel attempts to forward incoming HTTP requests from the mobile device to `[::1]:<port>`, the connection is immediately rejected (`ECONNREFUSED`), causing Localtunnel's edge proxy to return `502 Bad Gateway`.
  5. A secondary contributor: if the local dev server is stopped or crashes during tunnel creation, Localtunnel has no target backend to communicate with and outputs "Bad Gateway".
- **Resolution**:
  - Modified `TunnelManager.ts` to explicitly bind Localtunnel to IPv4:
    ```typescript
    const cmd = `npx --yes localtunnel --port ${port} --local-host 127.0.0.1`;
    ```
  - Added port reachability check (`TunnelManager.checkLocalPortReachable(port)`) prior to tunnel launch to warn the user if the local dev server is offline.

---

## 🛠️ Developer Self-Check & Workaround Guide

To get clean, instant tunnels immediately on Windows without Localtunnel friction:

1. **Install Cloudflared (Recommended)**:
   ```powershell
   winget install --id Cloudflare.cloudflared
   ```
2. **Verify Installation**:
   ```powershell
   where.exe cloudflared
   ```
3. **Launch dev server with IPv4 binding**:
   ```powershell
   npm run dev -- --host 127.0.0.1
   ```
4. **Trigger LaunchWizard Live Preview**:
   Click **Launch** in the VS Code Status Bar or Pre-Flight Deck.
