# 🛡️ Privacy Policy — LaunchWizard

> **Last Updated: October 2026**

We believe developer tools should operate with total transparency and zero surveillance. **LaunchWizard** is built from the ground up as an offline-first, local-only developer pre-flight engine.

---

## 1. Zero Telemetry & Zero Data Collection

- **No Remote Transmission of Code**: LaunchWizard executes pre-flight build checks (`tsc --noEmit`, AST audits) **strictly locally on your computer**.
- **No Source Code Uploads**: Your files, secrets, components, and project structure are **never transmitted to any remote servers, analytics trackers, or third-party endpoints**.
- **Local AST Scanning**: Parsing and auto-healing of source code occurs entirely in-memory within your local editor process.

---

## 2. Public Preview Tunnels

- When you explicitly click "Launch Live Share Link", LaunchWizard spawns a local Cloudflare Quick Tunnel (`cloudflared`) to tunnel your local port to a temporary HTTPS URL (`*.trycloudflare.com`).
- Traffic flows directly between Cloudflare's edge network and your local machine. LaunchWizard does not intercept or log user traffic.

---

## 3. License Verification

- **Offline-First Cryptography**: LaunchWizard Pro Lifetime licenses ($9.99 One-Time) are validated locally using cryptographic checksums.
- When validating online with Gumroad, only your provided license key is submitted for validation. No codebase or environment details are sent.

---

## Contact
For privacy questions, visit: [launchwizard.taqnik.in](https://launchwizard.taqnik.in)
