# ADR-007: Zero-Cost Pro Features (BYOK Deploy, Local Link Proxy, Named Tunnels)

- **Status**: Accepted
- **Date**: 2026-10-23
- **Deciders**: Dr. Shubham Kashyap & Claude (Claude Code)

---

## 1. Context

Five advertised Pro features had no code. The maintainer can't pay for infrastructure, so every Pro feature must run on the user's machine or on the user's own free accounts.

## 2. Decision

| Feature | How it works at $0 |
| --- | --- |
| BYOK deploy | Official CLIs via `npx` (`vercel@latest deploy --yes`, `wrangler@4 pages deploy`). Tokens from SecretStorage, passed as `VERCEL_TOKEN` / `CLOUDFLARE_API_TOKEN` env vars, never argv. Pre-flight gate + Secret Leak Guard first; preview by default; production needs a second confirmation. Pages previews never use the production branch. Next.js server apps are steered to Vercel. |
| Private links, expiry, visitor log | `LinkGuardProxy`: a local `node:http` reverse proxy between the tunnel and the dev server. Token-in-URL (for QR) or passcode form → HttpOnly cookie; WebSockets forwarded for hot reload; 10 failed passcodes per IP per 10 min → 429. Visitor log kept in memory only. |
| Multi-port sharing | `TunnelManager` is session-based (`primary` + extra sessions), each tracking its own processes. |
| Custom subdomains | Named Cloudflare Tunnel in the user's own account (`cloudflared tunnel login/create/route dns/run`). Apex domains refused; existing DNS records never overwritten. |
| Team cards, reports, QR PNG | Generated locally (Markdown / Slack / HTML; PNG encoded with `zlib`). |
| Secret Leak Guard, Pre-Push Gate, Dependency Health, Bundle Budget | Local regex scan; a git hook calling a bundled stand-alone checker (`dist/cli.js`, copied into `.git/launchwizard/`); `npm`/`pnpm` audit + outdated; gzip-measured client output compared with the last build. |

Also: before announcing a Cloudflare Quick Tunnel link, wait until its hostname resolves on `1.1.1.1` three times in a row. A live test showed new hostnames take ~5–30 s, and opening one earlier makes Windows cache "not found" for minutes.

## 3. Consequences

- ✅ Every Pro feature costs the maintainer nothing to run.
- ⚠️ Deploy and custom subdomains depend on third-party CLIs and the user's accounts; marked "beta" until verified against live accounts.
- ⚠️ The visitor log only exists for Pro links (the proxy is only inserted for Pro), so free links keep their original behaviour.
