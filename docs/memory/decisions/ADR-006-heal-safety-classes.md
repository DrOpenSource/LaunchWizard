# ADR-006: Heal Safety Classes, Editor-Based Edits, and No "Make It Public" Fixes

- **Status**: Accepted
- **Date**: 2026-10-23
- **Deciders**: Dr. Shubham Kashyap & Claude (Claude Code)

---

## 1. Context

The audit found three problems with auto-healing (B2, B3):

- The env-prefix healer renamed server variables to `NEXT_PUBLIC_` / `VITE_`. That leaves the value undefined, and following through publishes a secret to every visitor.
- Fixes were written straight to disk: no preview, no confirmation, no editor undo, and an in-memory rollback that no UI could reach.
- Three of five healers could never be triggered.

Pro also needed a real "auto-fix on save".

## 2. Decision

1. **Safety classes** (`AutoHealer.SAFETY`):
   - `safe` (may run automatically on save): `add-use-client`, `fix-import-case`, `quote-env-value`.
   - `review` (always previewed, never automatic): `fix-tsconfig-include`, `optional-chaining` (changes runtime behaviour), `prefix-next-public`, `fix-vite-env`.
2. **No bulk "make it public"**: env findings are explain-only in the pre-flight check. The per-line lightbulb offers a prefix only for non-secret-looking names (`EnvRules.isSecretLikeName`) and says to rename the variable in `.env` too.
3. **Edits go through the editor**: core returns patches; the extension applies a minimal `WorkspaceEdit` (common prefix/suffix kept), so Ctrl+Z works and unsaved buffers are respected. A file that changed since the patch was generated is skipped.
4. **Preview first** for "Fix All": a modal lists the files, with a diff view on request.
5. **Persistent undo point**: one checkpoint file in `globalStorage`. "Undo Last Fix" restores only files still identical to what the fix wrote; files edited since are reported, never overwritten.
6. **Auto-fix on save (Pro)**: `safe` healers only, scanned on the saved file alone, asks for consent once, offers "Undo" and "Don't Fix This File".
7. `'use client'` is never added to files that must stay server components (`metadata`, `generateMetadata`, async default exports, `next/headers`, `server-only`).

## 3. Consequences

- ✅ No fix can publish a secret or silently destroy work.
- ✅ Every reachable healer is tested (`test/file-heal-scanner.test.ts`, `test/extension.test.ts`).
- ⚠️ Fewer automatic fixes than the original marketing promised; the rest get explanations. New healers must declare a safety class.
