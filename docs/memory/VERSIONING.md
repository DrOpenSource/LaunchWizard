# 🏷️ LaunchWizard — Versioning & Release Governance

## 1. Semantic Versioning Specification

LaunchWizard adheres to **Semantic Versioning 2.0.0** (`MAJOR.MINOR.PATCH`):

- **MAJOR** (`1.0.0`): Breaking changes to the core engine, removal of supported frameworks, or incompatible extension manifest changes.
- **MINOR** (`0.2.0`): Substantial new features (e.g. rebrand from ShipWizard to LaunchWizard, new auto-healer strategies, BYOK cloud integrations) while maintaining backwards compatibility.
- **PATCH** (`0.2.1`, `0.2.2`): Bug fixes, QR code visual tuning, timeout adjustments, tunnel connection resilience, and documentation updates.

---

## 2. Release Gates & Verification Checklist

Before ANY version bump or VSIX packaging is executed, the following gate must be passed with **zero errors**:

```
[npm run compile] ──> [npm test] ──> [npm run build] ──> [package vsix]
     (0 TS errors)       (100% Vitest)    (esbuild ok)      (.vsix output)
```

1. **TypeScript Compilation Check**:
   ```powershell
   npm run compile
   ```
   Must output `tsc -p ./ --noEmit` with exit code `0`.

2. **Full Unit Test Verification**:
   ```powershell
   npm test
   ```
   All test suites (Framework Detector, Pre-Flight Engine, Error Translator, Auto-Healer, QR Generator, Tunnel Manager, License Manager) must pass 100%. No skipped or flaky network tests.

3. **Extension Bundling**:
   ```powershell
   npm run build
   ```
   Must produce a minified, valid `dist/extension.js` and `dist/extension.js.map` via esbuild.

4. **Marketing Site Build & Test**:
   ```powershell
   npm run build:site
   ```
   Must generate clean static assets in `public/` and verify cross-links.

5. **Package VSIX**:
   ```powershell
   npm run package
   ```
   Must produce `launchwizard-<version>.vsix` without unbundled devDependencies.

---

## 3. Release Version History

| Version | Date | Key Changes & Milestones |
|---|---|---|
| **v0.2.2** | 2026-10-14 | Tunnel resilience & OpenSSH fallback release: added zero-interstitial OpenSSH (`localhost.run`) fallback to eliminate Localtunnel drop-offs; bound localtunnel to `--local-host 127.0.0.1` to prevent IPv6 [::1] 502 Bad Gateway; increased spawn timeout to 45s; automatic cascade fallback; 44/44 Vitest tests passing; packaged `launchwizard-0.2.2.vsix`. |
| **v0.2.1** | 2026-10-14 | Fixed QR code generation: replaced placeholder ASCII/mock SVG with real, scannable QR code generation verified via `jsqr` unit tests; updated Gumroad product URLs. |
| **v0.2.0** | 2026-10-13 | Formal rebrand from **ShipWizard** to **LaunchWizard** across extension manifest, webview, status bar, and documentation; preserved backwards compatibility for stored `shipwizard.licenseKey`. |
| **v0.1.0** | 2026-10-10 | Initial prototype: Framework detector, TypeScript compiler runner, Cloudflare tunnel integration, Gumroad license verification. |

---

## 4. Backwards Compatibility & License State Migration

When renaming configuration settings or global state keys (as occurred during the ShipWizard -> LaunchWizard rebrand):
- The extension MUST check both the new key (`launchwizard.licenseKey`) and the legacy key (`shipwizard.licenseKey`) to prevent paid users from losing their Pro activation.
- See implementation in [`src/extension/extension.ts:18-21`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/ShipWizard/src/extension/extension.ts#L18-L21).
