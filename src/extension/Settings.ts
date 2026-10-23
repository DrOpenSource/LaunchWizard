import * as vscode from 'vscode';

/** Typed access to the `launchwizard.*` settings declared in package.json. */
export class Settings {
  private static get config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('launchwizard');
  }

  public static get preflightTimeoutMs(): number {
    return Math.max(10, this.config.get<number>('preflightTimeoutSeconds', 60)) * 1000;
  }

  public static get checkOnSave(): boolean {
    return this.config.get<boolean>('checkOnSave', true);
  }

  public static get healOnSave(): boolean {
    return this.config.get<boolean>('healOnSave', true);
  }

  public static get logVisitors(): boolean {
    return this.config.get<boolean>('share.logVisitors', true);
  }

  public static get defaultExpiryMinutes(): number {
    return Math.max(0, this.config.get<number>('share.defaultExpiryMinutes', 0));
  }

  public static get secretGuard(): boolean {
    return this.config.get<boolean>('secretGuard', true);
  }

  public static get bundleBudgetKb(): number {
    return Math.max(0, this.config.get<number>('bundleBudgetKb', 250));
  }

  public static get customDomainHostname(): string {
    return this.config.get<string>('customDomain.hostname', '');
  }

  public static async setCustomDomainHostname(hostname: string): Promise<void> {
    await this.config.update('customDomain.hostname', hostname, vscode.ConfigurationTarget.Global);
  }

  public static async setHealOnSave(on: boolean): Promise<void> {
    await this.config.update('healOnSave', on, vscode.ConfigurationTarget.Global);
  }
}
