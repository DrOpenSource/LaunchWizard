/**
 * Rules for deciding whether an environment variable may safely be exposed to browser code.
 * Shared by the pre-flight audit, the 1-click healers, and the inline lightbulbs.
 */
export class EnvRules {
  private static readonly SECRET_NAME_PATTERN = /SECRET|KEY|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|AUTH|SIGNING|SALT|DATABASE_URL|DB_URL|CONNECTION_STRING|DSN/i;

  /** Server-only variables that are always fine to read anywhere. */
  private static readonly ALWAYS_AVAILABLE = new Set(['NODE_ENV']);

  /**
   * True when a variable name looks like a secret.
   * Adding a public prefix (NEXT_PUBLIC_ / VITE_) to such a variable would publish it to every visitor.
   */
  public static isSecretLikeName(name: string): boolean {
    const bare = name.replace(/^(NEXT_PUBLIC_|VITE_)/, '');
    return this.SECRET_NAME_PATTERN.test(bare);
  }

  public static isAlwaysAvailable(name: string): boolean {
    return this.ALWAYS_AVAILABLE.has(name);
  }
}
