# ADR-005: Gumroad-Only Licensing (No License Server)

- **Status**: Accepted
- **Date**: 2026-10-23
- **Deciders**: Dr. Shubham Kashyap & Claude (Claude Code)
- **Supersedes**: the offline `SHIP-PRO-` HMAC keys from v0.1.0

---

## 1. Context

The 2026-10-22 audit found Pro could be unlocked for free: any well-formed key was accepted offline, stored keys were never re-checked, and the HMAC secret for `SHIP-PRO-` keys shipped inside the extension. The advertised 3-machine limit was not enforced.

The maintainer's hard constraint: **$0 running cost**. No paid servers or APIs. There were no buyers yet and no `SHIP-PRO-` keys had ever been issued.

## 2. Options considered

| Option | Cost | Enforces 3 machines | Self-service seat release | Ops |
| --- | --- | --- | --- | --- |
| A. Gumroad license API from the extension | $0 | Yes (Gumroad `uses` count) | No (manual reset) | None |
| B. Cloudflare Worker (free plan) holding the seller token, signing tokens | $0 (100k req/day; over the limit requests fail, never billed) | Yes | Yes | A Worker, secrets, KV to maintain |
| C. Keep offline HMAC keys | $0 | No | n/a | None, but trivially forgeable |

## 3. Decision

**Option A.** `LicenseManager` calls `POST /v2/licenses/verify`:

1. Activation: a read-only verify (`increment_uses_count=false`) checks the seat count; a new machine then verifies once with `increment_uses_count=true`. A 4th machine is refused without spending a seat. Re-activating the same machine never spends a seat (a hash of `vscode.env.machineId` is stored locally).
2. Weekly read-only re-check; refunded / charged-back / disputed purchases drop to Free.
3. 30-day offline grace from the last successful check; then Pro pauses (free features unaffected).
4. Never grant Pro for a key that was never verified online.
5. The license lives in VS Code SecretStorage. `SHIP-PRO-` keys, the HMAC secret and `generateOfflineKey` are deleted.

## 4. Consequences

- ✅ $0, no infrastructure, nothing to keep running.
- ✅ No secrets in the extension bundle.
- ⚠️ Seat resets are manual (`docs/SUPPORT.md`, Gumroad `decrement_uses_count` with the maintainer's own token).
- ⚠️ Any client-side check can be patched out. Acceptable at $9.99: the goal is to keep honest users honest.
- 🔁 Revisit Option B only if manual seat resets become a real support burden. It would still cost $0.
