# ADR-004: Zero-IDE Core Isolation (`src/core/` vs `src/extension/`)

- **Status**: Accepted
- **Date**: 2026-10-10
- **Deciders**: Dr. Shubham Kashyap & Antigravity AI Agent

---

## 1. Context & Problem Statement

Tightly coupling business logic (compiler output parsing, error translation, QR code generation, tunnel orchestration, licensing checks) with VS Code extension APIs (`vscode.window`, `vscode.workspace`, `vscode.WebviewView`) makes unit testing difficult, requires heavy IDE integration harnesses, and prevents reusing the engine in CLI tools, GitHub Actions, or web dashboards.

---

## 2. Decision

Strictly enforce an architectural separation of concerns between `src/core/` and `src/extension/`:

```
LaunchWizard/src/
├── core/                  # ZERO IDE DEPENDENCIES (Pure Node / TypeScript)
│   ├── PreFlightEngine.ts # Child process tsc & bundler runner
│   ├── ErrorTranslator.ts # Translation glossary & error mapping
│   ├── AutoHealer.ts      # Deterministic AST & regex patch generator
│   ├── TunnelManager.ts   # Process lifecycle & URL extractor
│   ├── QrGenerator.ts     # In-IDE ASCII & SVG QR generator
│   ├── LicenseManager.ts  # Key verification & Gumroad API client
│   └── FrameworkDetector.ts # Project file inspection
│
├── extension/             # VS CODE SPECIFIC INTEGRATION ONLY
│   ├── extension.ts       # Extension lifecycle & command dispatcher
│   ├── StatusBar.ts       # Status bar item controller
│   ├── PreFlightDeckView.ts # WebviewViewProvider & HTML deck
│   └── CodeActions.ts     # Inline lightbulb quick-fix provider
│
└── shared/                # Universal types and constants
    ├── types.ts           # Shared data contracts
    └── glossary.ts        # Error dictionary
```

- **Rule**: No file in `src/core/` or `src/shared/` may import from `'vscode'`.
- All tests in `test/` run against `src/core/` and execute in standard Node.js without requiring a VS Code extension host.

---

## 3. Consequences

### Positive
- Blazing-fast unit test runs (<3.5s for 41 tests in Vitest).
- Clean code architecture with clear boundaries.
- Reusable in future CLI or web environments (e.g. `npx launchwizard preflight`).

### Negative / Tradeoffs
- Extension layer must mediate between VS Code objects (like `vscode.Uri` or `vscode.WorkspaceFolder`) and core primitives (strings, numbers).
