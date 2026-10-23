import * as fs from 'node:fs';
import * as path from 'node:path';
import { Diff } from './Diff.js';
import { FileHealScanner } from './FileHealScanner.js';
import type { AutoHealPatch, AutoHealResult, HealSafety, PreFlightError } from '../shared/types.js';

/** A recorded heal that can be undone, as long as the files were not edited afterwards. */
export interface HealCheckpoint {
  createdAt: number;
  files: Array<{ filePath: string; before: string; after: string }>;
}

export interface RollbackPlan {
  restore: Array<{ filePath: string; content: string }>;
  /** Files changed again after the heal; restoring them would discard the user's newer edits. */
  conflicts: string[];
}

export class AutoHealer {
  /**
   * Which healers may run without a preview. Changes that alter runtime behaviour
   * (optional chaining) or project-wide config (tsconfig include) always need review.
   */
  public static readonly SAFETY: Record<string, HealSafety> = {
    'add-use-client': 'safe',
    'fix-import-case': 'safe',
    'quote-env-value': 'safe',
    'fix-tsconfig-include': 'review',
    'optional-chaining': 'review',
    'prefix-next-public': 'review',
    'fix-vite-env': 'review',
  };

  /**
   * In-memory rollback registry used by applyPatches (the IDE-free path).
   * Maps file path to original file content before mutation.
   */
  private static rollbackHistory: Map<string, string> = new Map();

  public static safetyOf(healerId: string | undefined): HealSafety {
    return (healerId && this.SAFETY[healerId]) || 'review';
  }

  /**
   * Generates non-destructive patches and diffs for a set of PreFlightErrors without mutating files.
   * Several findings in one file are combined into a single patch.
   */
  public static generatePatches(
    projectRoot: string,
    errors: PreFlightError[],
    readFile: (fullPath: string) => string | undefined = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : undefined)
  ): AutoHealPatch[] {
    const byFile = new Map<string, PreFlightError[]>();
    for (const err of errors) {
      if (!err.healerId) continue;
      const fullPath = path.isAbsolute(err.file) ? err.file : path.join(projectRoot, err.file);
      const list = byFile.get(fullPath) ?? [];
      list.push(err);
      byFile.set(fullPath, list);
    }

    const patches: AutoHealPatch[] = [];
    for (const [fullPath, fileErrors] of byFile) {
      const original = readFile(fullPath);
      if (original === undefined) continue;

      let patched = original;
      const descriptions: string[] = [];
      // Bottom-up so line-based fixes don't shift earlier line numbers;
      // the line-1 'use client' insertion shifts everything, so it always runs last.
      const sortKey = (e: PreFlightError) => (e.healerId === 'add-use-client' ? -Infinity : e.line);
      const ordered = [...fileErrors].sort((a, b) => sortKey(b) - sortKey(a));
      for (const err of ordered) {
        const result = this.applyHealer(patched, err);
        if (result && result.content !== patched) {
          patched = result.content;
          descriptions.push(result.description);
        }
      }

      if (patched !== original) {
        patches.push({
          filePath: fullPath,
          description: descriptions.reverse().join('; '),
          diff: this.generateDiff(original, patched, path.basename(fullPath)),
          originalContent: original,
          patchedContent: patched,
        });
      }
    }

    return patches;
  }

  private static applyHealer(content: string, err: PreFlightError): { content: string; description: string } | null {
    switch (err.healerId) {
      case 'add-use-client':
        return { content: this.applyUseClientFix(content), description: `Add "'use client';" directive to top of file` };

      case 'fix-import-case': {
        const spec = err.healData?.spec;
        const fixedSpec = err.healData?.fixedSpec;
        if (!spec || !fixedSpec) return null;
        return {
          content: this.applyImportCaseFix(content, err.line, spec, fixedSpec),
          description: `Fix import letter case: "${spec}" → "${fixedSpec}"`,
        };
      }

      case 'quote-env-value': {
        const key = err.healData?.key;
        if (!key) return null;
        return { content: this.applyEnvQuoteFix(content, err.line), description: `Quote the value of ${key} so "#" is kept` };
      }

      case 'prefix-next-public': {
        const varName = err.rawMessage.match(/Environment variable "([^"]+)"/)?.[1];
        if (!varName) return null;
        return { content: this.applyNextPublicPrefix(content, varName), description: `Prefix "${varName}" with "NEXT_PUBLIC_" for client access` };
      }

      case 'fix-vite-env': {
        const varName = err.rawMessage.match(/process\.env\.([A-Z0-9_]+)/)?.[1];
        if (!varName) return null;
        return { content: this.applyViteEnvFix(content, varName), description: `Replace process.env.${varName} with import.meta.env.VITE_${varName}` };
      }

      case 'optional-chaining': {
        const propName = err.rawMessage.match(/Property '([^']+)' does not exist/)?.[1];
        if (!propName) return null;
        return { content: this.applyOptionalChaining(content, err.line, propName), description: `Add safe optional chaining (?.) before ".${propName}"` };
      }

      case 'fix-tsconfig-include':
        return { content: this.applyTsConfigIncludeFix(content), description: `Add standard include globs ("src/**/*", "app/**/*") to tsconfig.json` };

      default:
        return null;
    }
  }

  /**
   * Applies generated patches to disk, saving original content to the rollback history.
   * The VS Code extension does NOT use this: it applies patches through the editor so Ctrl+Z works.
   */
  public static applyPatches(patches: AutoHealPatch[]): AutoHealResult {
    const errors: string[] = [];
    let healedCount = 0;

    for (const patch of patches) {
      try {
        this.rollbackHistory.set(patch.filePath, patch.originalContent);
        fs.writeFileSync(patch.filePath, patch.patchedContent, 'utf-8');
        healedCount += 1;
      } catch (err) {
        errors.push(`Failed to patch ${path.basename(patch.filePath)}: ${String(err)}`);
      }
    }

    return {
      success: errors.length === 0,
      healedCount,
      patches,
      errors,
    };
  }

  /**
   * Rolls back modified files to their exact pre-patch states.
   */
  public static rollback(targetFilePath?: string): boolean {
    if (targetFilePath) {
      const original = this.rollbackHistory.get(targetFilePath);
      if (original !== undefined) {
        try {
          fs.writeFileSync(targetFilePath, original, 'utf-8');
          this.rollbackHistory.delete(targetFilePath);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }

    let allSucceeded = true;
    for (const [filePath, content] of this.rollbackHistory.entries()) {
      try {
        fs.writeFileSync(filePath, content, 'utf-8');
      } catch {
        allSucceeded = false;
      }
    }
    this.rollbackHistory.clear();
    return allSucceeded;
  }

  public static getRollbackCount(): number {
    return this.rollbackHistory.size;
  }

  public static createCheckpoint(patches: AutoHealPatch[], now = Date.now()): HealCheckpoint {
    return {
      createdAt: now,
      files: patches.map((p) => ({ filePath: p.filePath, before: p.originalContent, after: p.patchedContent })),
    };
  }

  /**
   * Decides which files can be safely restored from a checkpoint.
   * A file edited again since the heal is reported as a conflict instead of being overwritten.
   */
  public static planRollback(checkpoint: HealCheckpoint, readCurrent: (filePath: string) => string | undefined): RollbackPlan {
    const plan: RollbackPlan = { restore: [], conflicts: [] };
    for (const file of checkpoint.files) {
      const current = readCurrent(file.filePath);
      if (current === undefined) {
        plan.conflicts.push(file.filePath);
      } else if (this.normalizeEol(current) === this.normalizeEol(file.after)) {
        plan.restore.push({ filePath: file.filePath, content: file.before });
      } else if (this.normalizeEol(current) !== this.normalizeEol(file.before)) {
        plan.conflicts.push(file.filePath);
      }
    }
    return plan;
  }

  private static normalizeEol(text: string): string {
    return text.replace(/\r\n/g, '\n');
  }

  // --- Specialized deterministic patch transformers ---

  public static applyUseClientFix(content: string): string {
    if (/^\s*['"]use client['"]/m.test(content)) {
      return content;
    }

    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    if (content.startsWith('#!')) {
      const firstNewline = content.indexOf('\n');
      const shebang = content.slice(0, firstNewline + 1);
      const rest = content.slice(firstNewline + 1);
      return `${shebang}'use client';${eol}${eol}${rest}`;
    }

    return `'use client';${eol}${eol}${content}`;
  }

  public static applyImportCaseFix(content: string, lineNum: number, spec: string, fixedSpec: string): string {
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    const lines = content.split(/\r?\n/);
    const idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return content;
    for (const quote of ["'", '"']) {
      const target = `${quote}${spec}${quote}`;
      if (lines[idx].includes(target)) {
        lines[idx] = lines[idx].replace(target, `${quote}${fixedSpec}${quote}`);
        return lines.join(eol);
      }
    }
    return content;
  }

  public static applyEnvQuoteFix(content: string, lineNum: number): string {
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    const lines = content.split(/\r?\n/);
    const idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return content;
    const parsed = FileHealScanner.parseUnquotedEnvLine(lines[idx]);
    if (!parsed) return content;
    let quoted: string;
    if (!parsed.value.includes('"')) {
      quoted = `"${parsed.value}"`;
    } else if (!parsed.value.includes("'")) {
      quoted = `'${parsed.value}'`;
    } else {
      return content;
    }
    lines[idx] = `${parsed.prefix}${quoted}${parsed.suffix}`;
    return lines.join(eol);
  }

  public static applyNextPublicPrefix(content: string, varName: string): string {
    const target = `process.env.${varName}`;
    const replacement = `process.env.NEXT_PUBLIC_${varName}`;
    return content.split(target).join(replacement);
  }

  public static applyViteEnvFix(content: string, varName: string): string {
    const target = `process.env.${varName}`;
    const replacement = `import.meta.env.VITE_${varName}`;
    return content.split(target).join(replacement);
  }

  public static applyOptionalChaining(content: string, lineNum: number, propName: string): string {
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    const lines = content.split(/\r?\n/);
    const targetIdx = lineNum - 1;

    if (targetIdx >= 0 && targetIdx < lines.length) {
      const line = lines[targetIdx];
      const targetDot = `.${propName}`;
      const safeDot = `?.${propName}`;
      if (line.includes(targetDot) && !line.includes(safeDot)) {
        lines[targetIdx] = line.replace(targetDot, safeDot);
        return lines.join(eol);
      }
    }

    return content;
  }

  public static applyTsConfigIncludeFix(content: string): string {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      parsed.include = ['src/**/*', 'app/**/*', 'pages/**/*'];
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }

  /**
   * Generates a readable unified diff of the whole change.
   */
  public static generateDiff(original: string, modified: string, fileName: string): string {
    return Diff.unified(original, modified, fileName);
  }
}
