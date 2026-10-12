import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AutoHealPatch, AutoHealResult, PreFlightError } from '../shared/types.js';

export class AutoHealer {
  /**
   * In-memory rollback registry to guarantee zero code corruption.
   * Maps file path to original file content before mutation.
   */
  private static rollbackHistory: Map<string, string> = new Map();

  /**
   * Generates non-destructive patches and diffs for a set of PreFlightErrors without mutating files.
   */
  public static generatePatches(
    projectRoot: string,
    errors: PreFlightError[]
  ): AutoHealPatch[] {
    const patches: AutoHealPatch[] = [];
    const touchedFiles = new Set<string>();

    for (const err of errors) {
      if (!err.healerId) {
        continue;
      }

      const fullPath = path.isAbsolute(err.file)
        ? err.file
        : path.join(projectRoot, err.file);

      if (!fs.existsSync(fullPath)) {
        continue;
      }

      // Avoid duplicate conflicting patches on the same file in one batch
      if (touchedFiles.has(fullPath)) {
        continue;
      }

      const original = fs.readFileSync(fullPath, 'utf-8');
      let patched = original;
      let description = '';

      switch (err.healerId) {
        case 'add-use-client': {
          patched = this.applyUseClientFix(original);
          description = `Add "'use client';" directive to top of file`;
          break;
        }

        case 'prefix-next-public': {
          // Extract varName from error message or proposed fix
          const match = err.rawMessage.match(/Environment variable "([^"]+)"/);
          const varName = match ? match[1] : '';
          if (varName) {
            patched = this.applyNextPublicPrefix(original, varName);
            description = `Prefix "${varName}" with "NEXT_PUBLIC_" for client access`;
          }
          break;
        }

        case 'fix-vite-env': {
          const match = err.rawMessage.match(/process\.env\.([A-Z0-9_]+)/);
          const varName = match ? match[1] : '';
          if (varName) {
            patched = this.applyViteEnvFix(original, varName);
            description = `Replace process.env.${varName} with import.meta.env.VITE_${varName}`;
          }
          break;
        }

        case 'optional-chaining': {
          const match = err.rawMessage.match(/Property '([^']+)' does not exist/);
          const propName = match ? match[1] : '';
          if (propName) {
            patched = this.applyOptionalChaining(original, err.line, propName);
            description = `Add safe optional chaining (?.) before ".${propName}"`;
          }
          break;
        }

        case 'fix-tsconfig-include': {
          patched = this.applyTsConfigIncludeFix(original);
          description = `Add standard include globs ("src/**/*", "app/**/*") to tsconfig.json`;
          break;
        }
      }

      if (patched !== original) {
        touchedFiles.add(fullPath);
        const diff = this.generateDiff(original, patched, path.basename(fullPath));
        patches.push({
          filePath: fullPath,
          description,
          diff,
          originalContent: original,
          patchedContent: patched,
        });
      }
    }

    return patches;
  }

  /**
   * Applies generated patches to disk, saving original content to the rollback history.
   */
  public static applyPatches(patches: AutoHealPatch[]): AutoHealResult {
    const errors: string[] = [];
    let healedCount = 0;

    for (const patch of patches) {
      try {
        // Save to rollback history before touching disk
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

    // Rollback all recorded files
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

  /**
   * Gets current rollback history count.
   */
  public static getRollbackCount(): number {
    return this.rollbackHistory.size;
  }

  // --- Specialized deterministic patch transformers ---

  public static applyUseClientFix(content: string): string {
    if (content.includes("'use client'") || content.includes('"use client"')) {
      return content;
    }

    // If starts with shebang, place after it
    if (content.startsWith('#!')) {
      const firstNewline = content.indexOf('\n');
      const shebang = content.slice(0, firstNewline + 1);
      const rest = content.slice(firstNewline + 1);
      return `${shebang}'use client';\n\n${rest}`;
    }

    return `'use client';\n\n${content}`;
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
    const lines = content.split(/\r?\n/);
    const targetIdx = lineNum - 1;

    if (targetIdx >= 0 && targetIdx < lines.length) {
      const line = lines[targetIdx];
      const targetDot = `.${propName}`;
      const safeDot = `?.${propName}`;
      if (line.includes(targetDot) && !line.includes(safeDot)) {
        lines[targetIdx] = line.replace(targetDot, safeDot);
        return lines.join('\n');
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
   * Generates a simple, readable unified diff string.
   */
  public static generateDiff(original: string, modified: string, fileName: string): string {
    return [
      `--- a/${fileName}`,
      `+++ b/${fileName}`,
      `@@ -1 +1 @@`,
      `- (Original: ${original.slice(0, 40).replace(/\r?\n/g, ' ')}...)`,
      `+ (Patched: ${modified.slice(0, 40).replace(/\r?\n/g, ' ')}...)`,
    ].join('\n');
  }
}
