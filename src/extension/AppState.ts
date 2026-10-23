import * as vscode from 'vscode';
import type { PreFlightError, PreFlightReport, TranslatedError } from '../shared/types.js';

export interface ToolResults {
  build?: { success: boolean; message: string; at: number; cards: TranslatedError[] };
  bundle?: { summary: string; overBudget: boolean; grew: boolean; at: number };
  deps?: { message: string; serious: number; at: number };
  secrets?: { count: number; at: number };
  deploy?: { url: string; target: string; production: boolean; qrCodeSvg: string; at: number };
}

/** Shared results the status bar, sidebar and commands read from. */
export class AppState implements vscode.Disposable {
  public report: PreFlightReport | null = null;
  public translated: TranslatedError[] = [];
  public translatedWarnings: TranslatedError[] = [];
  public results: ToolResults = {};
  public checking = false;

  private readonly emitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.emitter.event;

  public setReport(report: PreFlightReport, translated: TranslatedError[], translatedWarnings: TranslatedError[]): void {
    this.report = report;
    this.translated = translated;
    this.translatedWarnings = translatedWarnings;
    this.emitter.fire();
  }

  public setChecking(checking: boolean): void {
    this.checking = checking;
    this.emitter.fire();
  }

  public setResult<K extends keyof ToolResults>(key: K, value: ToolResults[K]): void {
    this.results = { ...this.results, [key]: value };
    this.emitter.fire();
  }

  /** All current findings (pre-flight blockers, warnings, and build-check errors) for "Fix All". */
  public allFindings(): PreFlightError[] {
    return [
      ...(this.report?.errors ?? []),
      ...(this.report?.warnings ?? []),
      ...(this.results.build?.cards.map((c) => c.original) ?? []),
    ];
  }

  public changed(): void {
    this.emitter.fire();
  }

  public dispose(): void {
    this.emitter.dispose();
  }
}
