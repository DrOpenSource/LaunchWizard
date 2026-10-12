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
}

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

export interface TunnelInfo {
  url: string;
  localPort: number;
  provider: 'cloudflare' | 'custom';
  qrCodeSvg: string;
  startedAt: number;
  uptimeSeconds: number;
  status: TunnelStatus;
  error?: string;
}

export type LicenseTier = 'free' | 'pro';

export interface LicenseState {
  tier: LicenseTier;
  key?: string;
  activeMachines?: number;
  activatedAt?: number;
  isActivated: boolean;
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
