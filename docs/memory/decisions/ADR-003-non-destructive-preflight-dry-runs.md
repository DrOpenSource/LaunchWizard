# ADR-003: Non-Destructive In-Memory Dry Runs and Shadow Rollback Architecture

- **Status**: Accepted
- **Date**: 2026-10-10
- **Deciders**: Dr. Shubham Kashyap & Antigravity AI Agent

---

## 1. Context & Problem Statement

Automated fixing tools that modify source code without safety nets risk corrupting user files, stripping comments, or introducing syntax regressions. Vibe coders are particularly vulnerable to AI code modification tools that silently mutate files, leading to lost progress and developer distrust.

---

## 2. Decision

1. **Non-Destructive Pre-Flight Inspection**:
   - Pre-flight checks must never modify files on disk during inspection.
   - Pre-flight runs `tsc --noEmit` and framework build dry-runs using isolated child processes.
   - All errors are parsed into structured memory models without touching user source trees.

2. **Shadow Rollback Architecture (`AutoHealer.ts`)**:
   - Before applying any automated patch, `AutoHealer` takes a full in-memory snapshot of the target file's content (`rollbackMap.set(patch.filePath, originalContent)`).
   - Patches are validated for clean replacement.
   - If an error occurs, or if the user requests an undo, `AutoHealer.rollback(filePath)` restores the exact pre-heal file content with zero byte differences.
   - Rollback state is reported to the UI deck so the user knows an undo checkpoint is active.

---

## 3. Consequences

### Positive
- Zero risk of source file destruction during pre-flight checks.
- 100% reversible auto-healing gives developers confidence to click "1-Click Auto-Heal".
- Tested and verified via `test/auto-healer.test.ts`.

### Negative / Tradeoffs
- Rollback map is currently stored in-memory per extension session; shutting down the IDE clears the in-memory rollback stack (though GitWizard covers persistent git rollback).
