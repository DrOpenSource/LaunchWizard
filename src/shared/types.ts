export type SupportedFramework =
  | 'nextjs'
  | 'vite'
  | 'remix'
  | 'astro'
  | 'sveltekit'
  | 'nuxt'
  | 'cra'
  | 'vanilla-ts'
  | 'unknown';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface FrameworkInfo {
  framework: SupportedFramework;
  displayName: string;
  version?: string;
  packageManager: PackageManager;
  hasTypeScript: boolean;
  devScript?: string;
  buildScript?: string;
  defaultPort: number;
}

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface PreFlightError {
  file: string;
  line: number;
  column: number;
  code: string;
  rawMessage: string;
  severity: DiagnosticSeverity;
  healerId?: string;
  proposedFix?: string;
  /** Extra inputs a healer needs, e.g. the corrected import specifier. */
  healData?: Record<string, string>;
}

/** 'safe' healers may run automatically on save; 'review' healers always need a preview first. */
export type HealSafety = 'safe' | 'review';

export interface PreFlightReport {
  framework: SupportedFramework;
  frameworkName: string;
  packageManager: PackageManager;
  hasTypeScript: boolean;
  passed: boolean;
  errors: PreFlightError[];
  warnings: PreFlightError[];
  durationMs: number;
  timestamp: number;
  summaryText: string;
}

export interface TranslatedError {
  original: PreFlightError;
  badge: string;
  friendlyTitle: string;
  explanation: string;
  whyItBreaks: string;
  actionPrompt: string;
  autoFixAvailable: boolean;
}

export type TunnelStatus = 'idle' | 'starting' | 'active' | 'error' | 'stopped';

export type TunnelProvider = 'cloudflare' | 'localhost.run' | 'localtunnel' | 'custom';

export interface TunnelInfo {
  url: string;
  localPort: number;
  provider: TunnelProvider;
  qrCodeSvg: string;
  startedAt: number;
  uptimeSeconds: number;
  status: TunnelStatus;
  error?: string;
  /** Session key: 'primary' or the extra port's label. */
  id?: string;
  label?: string;
  /** The link to hand out (carries the access token for passcode-protected links). */
  shareUrl?: string;
  isProtected?: boolean;
  passcode?: string;
  expiresAt?: number;
  visitorCount?: number;
  /** The public hostname didn't resolve in time; the link may need another minute. */
  dnsPending?: boolean;
}

export type LicenseTier = 'free' | 'pro';

export interface LicenseState {
  tier: LicenseTier;
  /** Masked for display, e.g. "6F0E…17E7". */
  key?: string;
  activatedAt?: number;
  isActivated: boolean;
  lastVerifiedAt?: number;
  /** Pro keeps working offline until this time; then it pauses until the next successful check. */
  graceEndsAt?: number;
  /** Machines this key has been activated on, as counted by Gumroad. */
  uses?: number;
  maxMachines: number;
  /** A key is stored but has not been re-checked within the grace period. */
  paused: boolean;
}

export interface AutoHealPatch {
  filePath: string;
  description: string;
  diff: string;
  originalContent: string;
  patchedContent: string;
}

export interface AutoHealResult {
  success: boolean;
  healedCount: number;
  patches: AutoHealPatch[];
  errors: string[];
}
