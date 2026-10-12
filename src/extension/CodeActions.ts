import * as vscode from 'vscode';

export class ShipWizardCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    _context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const lineText = document.lineAt(range.start.line).text;

    // 1. Missing 'use client'
    if (
      (lineText.includes('useState') || lineText.includes('useEffect') || lineText.includes('onClick')) &&
      !document.getText().includes("'use client'")
    ) {
      const fix = new vscode.CodeAction(
        "🪄 ShipWizard: Add 'use client' directive to line 1",
        vscode.CodeActionKind.QuickFix
      );
      fix.edit = new vscode.WorkspaceEdit();
      fix.edit.insert(document.uri, new vscode.Position(0, 0), "'use client';\n\n");
      fix.isPreferred = true;
      actions.push(fix);
    }

    // 2. Client secret leak / missing NEXT_PUBLIC_
    const secretMatch = lineText.match(/process\.env\.([A-Z0-9_]+)/);
    if (
      secretMatch &&
      !secretMatch[1].startsWith('NEXT_PUBLIC_') &&
      secretMatch[1] !== 'NODE_ENV' &&
      document.getText().includes("'use client'")
    ) {
      const varName = secretMatch[1];
      const fix = new vscode.CodeAction(
        `🪄 ShipWizard: Prefix "${varName}" with "NEXT_PUBLIC_"`,
        vscode.CodeActionKind.QuickFix
      );
      fix.edit = new vscode.WorkspaceEdit();
      const colStart = lineText.indexOf(`process.env.${varName}`);
      const colEnd = colStart + `process.env.${varName}`.length;
      fix.edit.replace(
        document.uri,
        new vscode.Range(range.start.line, colStart, range.start.line, colEnd),
        `process.env.NEXT_PUBLIC_${varName}`
      );
      fix.isPreferred = true;
      actions.push(fix);
    }

    // 3. Vite client env mistake
    if (lineText.includes('process.env.') && !lineText.includes('NODE_ENV')) {
      const viteMatch = lineText.match(/process\.env\.([A-Z0-9_]+)/);
      if (viteMatch) {
        const varName = viteMatch[1];
        const fix = new vscode.CodeAction(
          `🪄 ShipWizard: Convert to import.meta.env.VITE_${varName}`,
          vscode.CodeActionKind.QuickFix
        );
        fix.edit = new vscode.WorkspaceEdit();
        const colStart = lineText.indexOf(`process.env.${varName}`);
        const colEnd = colStart + `process.env.${varName}`.length;
        fix.edit.replace(
          document.uri,
          new vscode.Range(range.start.line, colStart, range.start.line, colEnd),
          `import.meta.env.VITE_${varName}`
        );
        actions.push(fix);
      }
    }

    return actions;
  }
}
