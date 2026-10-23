import * as vscode from 'vscode';

/** The single "LaunchWizard" output channel: build logs, deploy logs, scan details. */
export class Log {
  private static channel: vscode.OutputChannel | null = null;

  public static get(): vscode.OutputChannel {
    if (!this.channel) {
      this.channel = vscode.window.createOutputChannel('LaunchWizard');
    }
    return this.channel;
  }

  public static line(text: string): void {
    this.get().appendLine(text);
  }

  public static section(title: string): void {
    this.get().appendLine('');
    this.get().appendLine(`── ${title} (${new Date().toLocaleTimeString()}) ──`);
  }

  public static show(): void {
    this.get().show(true);
  }

  public static dispose(): void {
    this.channel?.dispose();
    this.channel = null;
  }
}
