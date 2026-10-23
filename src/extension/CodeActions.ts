import * as vscode from 'vscode';
import { AutoHealer } from '../core/AutoHealer.js';
import { Diff } from '../core/Diff.js';
import { EnvRules } from '../core/EnvRules.js';
import { FileHealScanner } from '../core/FileHealScanner.js';
import { FrameworkDetector } from '../core/FrameworkDetector.js';
import type { PreFlightError, SupportedFramework } from '../shared/types.js';

const TITLES: Record<string, string> = {
  'add-use-client': "Add 'use client' to the top of this file",
  'fix-import-case': 'Match the import to the real file name',
  'quote-env-value': 'Quote this value so "#" is kept',
};

/**
 * Inline lightbulb fixes. They only appear for the framework the project actually uses (B8),
 * and never offer to make a secret-looking variable public.
 */
export class LaunchWizardCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];
  private readonly frameworks = new Map<string, SupportedFramework>();

  /** Called when a package.json is saved, since dependencies decide the framework. */
  public invalidate(): void {
    this.frameworks.clear();
  }

  private frameworkFor(root: string): SupportedFramework {
    let fw = this.frameworks.get(root);
    if (!fw) {
      fw = FrameworkDetector.detect(root).framework;
      this.frameworks.set(root, fw);
    }
    return fw;
  }

  public provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection): vscode.CodeAction[] {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder || document.uri.scheme !== 'file') return [];
    const root = folder.uri.fsPath;
    const framework = this.frameworkFor(root);
    const text = document.getText();
    const actions: vscode.CodeAction[] = [];

    // 1. Deterministic healers on these lines
    const findings = FileHealScanner.scanFile(document.uri.fsPath, text, { projectRoot: root, framework }).filter(
      (f) => f.line - 1 >= range.start.line && f.line - 1 <= range.end.line
    );
    for (const finding of findings) {
      const action = this.fixFor(document, root, finding, TITLES[finding.healerId ?? ''] ?? finding.proposedFix ?? 'Apply fix');
      if (action) actions.push(action);
    }

    // 2. Env variable naming (explicit, per-line, never for secret-looking names)
    const lineText = document.lineAt(range.start.line).text;
    const env = lineText.match(/process\.env\.([A-Z0-9_]+)/);
    if (env && !EnvRules.isAlwaysAvailable(env[1]) && !EnvRules.isSecretLikeName(env[1])) {
      const varName = env[1];
      const isClient = /^\s*['"]use client['"]/m.test(text);
      if (framework === 'nextjs' && isClient && !varName.startsWith('NEXT_PUBLIC_')) {
        const action = this.fixFor(document, root, this.envFinding(document, range.start.line, varName, 'prefix-next-public', `Environment variable "${varName}"`), `Make "${varName}" public as NEXT_PUBLIC_${varName} (rename it in .env too)`);
        if (action) actions.push(action);
      } else if (framework === 'vite') {
        const action = this.fixFor(document, root, this.envFinding(document, range.start.line, varName, 'fix-vite-env', `process.env.${varName}`), `Use import.meta.env.VITE_${varName} (rename it in .env too)`);
        if (action) actions.push(action);
      }
    }

    return actions;
  }

  private envFinding(document: vscode.TextDocument, line: number, varName: string, healerId: string, rawMessage: string): PreFlightError {
    return { file: document.uri.fsPath, line: line + 1, column: 1, code: 'ENV', rawMessage, severity: 'error', healerId, healData: { varName } };
  }

  private fixFor(document: vscode.TextDocument, root: string, finding: PreFlightError, title: string): vscode.CodeAction | null {
    const [patch] = AutoHealer.generatePatches(root, [{ ...finding, file: document.uri.fsPath }], () => document.getText());
    if (!patch) return null;
    const change = Diff.minimalReplace(patch.originalContent, patch.patchedContent);
    const action = new vscode.CodeAction(`🪄 LaunchWizard: ${title}`, vscode.CodeActionKind.QuickFix);
    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(document.uri, new vscode.Range(document.positionAt(change.start), document.positionAt(change.end)), change.text);
    action.isPreferred = AutoHealer.safetyOf(finding.healerId) === 'safe';
    return action;
  }
}
