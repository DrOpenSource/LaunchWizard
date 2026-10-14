# ADR-002: Freemium Model with $9.99 One-Time Lifetime License vs Subscriptions

- **Status**: Accepted
- **Date**: 2026-10-11
- **Deciders**: Dr. Shubham Kashyap & Antigravity AI Agent

---

## 1. Context & Problem Statement

Developer tooling is saturated with SaaS subscriptions ($10–$30/month) that cause "subscription fatigue". Vibe coders, solo founders, and indie hackers resent recurring monthly charges for developer utilities, leading to high churn and negative sentiment.

At the same time, maintaining open-source software requires sustainable revenue to fund active development and support.

---

## 2. Decision

1. **Free Forever Tier**:
   - Pre-flight build checks (`tsc --noEmit`, bundler dry runs).
   - Plain-English error translations and diagnostics cards.
   - 1-Click manual tunnel creation (Cloudflare Quick Tunnels / fallbacks).
   - In-IDE mobile QR code generation.
   - Manual 1-click auto-healers for build blockers.
   - Zero nagging modals, artificial rate limits, or paywalled essentials.

2. **Pro Tier: $9.99 One-Time Lifetime License**:
   - Single flat payment of $9.99 sold via Gumroad.
   - Zero recurring subscriptions.
   - Unlocks:
     - Automated AST Auto-Healing on document save.
     - BYOK (Bring Your Own Key) zero-config cloud deployments (Cloudflare Pages, Vercel).
     - Custom tunnel subdomains and branded preview cards.
   - Validated both offline via cryptographic format validation (`LAUNCH-PRO-XXXX-XXXX` / `SHIP-PRO-XXXX-XXXX`) and online via Gumroad License Verification API.

---

## 3. Consequences

### Positive
- High impulse conversion from vibe coders who appreciate pay-once developer tools.
- Transparent, ethical pricing with zero hidden subscription renewal traps.
- Free tier delivers immense value out of the box, driving viral adoption and DrOpenSource ecosystem awareness.

### Negative / Tradeoffs
- Lifetime pricing does not yield recurring monthly ARR from individual users, meaning growth depends on top-of-funnel user expansion.
