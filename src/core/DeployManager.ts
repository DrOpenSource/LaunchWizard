import * as fs from 'node:fs';
import * as path from 'node:path';
import { runProcess, type RunResult } from './ProcessRunner.js';
import { BundleAnalyzer } from './BundleAnalyzer.js';
import type { FrameworkInfo } from '../shared/types.js';

export type DeployTarget = 'vercel' | 'cloudflare-pages';

export interface DeployCredentials {
  token: string;
  /** Cloudflare only. */
  accountId?: string;
}

export interface DeployRequest {
  target: DeployTarget;
  projectRoot: string;
  info: FrameworkInfo;
  production: boolean;
  credentials: DeployCredentials;
  projectName: string;
  gitBranch?: string;
  signal?: AbortSignal;
  onOutput?: (chunk: string) => void;
  timeoutMs?: number;
}

export interface DeployResult {
  success: boolean;
  url?: string;
  message: string;
  outputTail: string;
}

export interface CommandSpec {
  command: string;
  args: string[];
}

/**
 * Pro "BYOK 1-Click Deploy": deploys with the official Vercel / Wrangler CLIs using the user's
 * own free account token. Tokens travel in environment variables, never on the command line.
 * Costs the maintainer nothing; uses the user's free Vercel Hobby / Cloudflare Pages plan.
 */
export class DeployManager {
  public static readonly PAGES_PRODUCTION_BRANCH = 'main';

  public static sanitizeProjectName(name: string): string {
    const cleaned = name
      .toLowerCase()
      .replace(/^@[^/]+\//, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 58);
    return cleaned || 'launchwizard-app';
  }

  public static vercelCommand(production: boolean): CommandSpec {
    return { command: 'npx', args: ['--yes', 'vercel@latest', 'deploy', '--yes', ...(production ? ['--prod'] : [])] };
  }

  public static pagesBranch(production: boolean, gitBranch?: string): string {
    if (production) return this.PAGES_PRODUCTION_BRANCH;
    const branch = (gitBranch ?? '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    // Deploying a preview from "main" would publish to production on Pages, so use a separate branch name.
    return !branch || branch === this.PAGES_PRODUCTION_BRANCH || branch === 'HEAD' ? 'launchwizard-preview' : branch.slice(0, 28);
  }

  public static pagesCommands(outputDir: string, projectName: string, branch: string): { create: CommandSpec; deploy: CommandSpec } {
    return {
      create: { command: 'npx', args: ['--yes', 'wrangler@4', 'pages', 'project', 'create', projectName, `--production-branch=${this.PAGES_PRODUCTION_BRANCH}`] },
      deploy: { command: 'npx', args: ['--yes', 'wrangler@4', 'pages', 'deploy', outputDir, `--project-name=${projectName}`, `--branch=${branch}`, '--commit-dirty=true'] },
    };
  }

  public static parseDeployUrl(target: DeployTarget, output: string): string | null {
    const pattern = target === 'vercel'
      ? /https:\/\/[a-z0-9.-]+\.vercel\.app/gi
      : /https:\/\/[a-z0-9.-]+\.pages\.dev/gi;
    const matches = output.match(pattern);
    return matches ? matches[matches.length - 1] : null;
  }

  /** Returns a plain-English reason the deploy can't run, or null when it can. */
  public static validate(req: Pick<DeployRequest, 'target' | 'credentials' | 'info' | 'projectRoot'>): string | null {
    if (!req.credentials.token) {
      return `No ${req.target === 'vercel' ? 'Vercel' : 'Cloudflare'} token is connected. Run "LaunchWizard: Connect ${req.target === 'vercel' ? 'Vercel' : 'Cloudflare'} Account" first.`;
    }
    if (req.target === 'cloudflare-pages') {
      if (!req.credentials.accountId) {
        return 'Cloudflare Pages needs your Account ID as well as the token. Reconnect your Cloudflare account.';
      }
      if (req.info.framework === 'nextjs' && !this.isNextStaticExport(req.projectRoot)) {
        return 'This Next.js app uses server features that plain Cloudflare Pages cannot run. Deploy it to Vercel instead (free Hobby plan), or set output: "export" in next.config for a static site.';
      }
    }
    return null;
  }

  public static isNextStaticExport(projectRoot: string): boolean {
    for (const name of ['next.config.js', 'next.config.mjs', 'next.config.ts', 'next.config.cjs']) {
      try {
        if (/output\s*:\s*['"]export['"]/.test(fs.readFileSync(path.join(projectRoot, name), 'utf-8'))) return true;
      } catch {
        // Not present
      }
    }
    return false;
  }

  public static async deploy(req: DeployRequest): Promise<DeployResult> {
    const invalid = this.validate(req);
    if (invalid) return { success: false, message: invalid, outputTail: '' };

    const timeoutMs = req.timeoutMs ?? 15 * 60 * 1000;
    const baseEnv = { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' };
    const run = (spec: CommandSpec, env: NodeJS.ProcessEnv): Promise<RunResult> =>
      runProcess(spec.command, spec.args, { cwd: req.projectRoot, env, timeoutMs, shell: true, signal: req.signal, onOutput: req.onOutput });

    if (req.target === 'vercel') {
      const result = await run(this.vercelCommand(req.production), { ...baseEnv, VERCEL_TOKEN: req.credentials.token });
      return this.finish('vercel', result);
    }

    // Cloudflare Pages deploys a finished static build.
    const outputDir = BundleAnalyzer.outputDirFor(req.projectRoot, req.info.framework === 'nextjs' ? 'nextjs' : req.info.framework);
    const staticDir = req.info.framework === 'nextjs' ? (fs.existsSync(path.join(req.projectRoot, 'out')) ? 'out' : null) : outputDir;
    if (!staticDir) {
      return { success: false, message: 'No build output folder was found. Run the production build first (LaunchWizard does this automatically before deploying).', outputTail: '' };
    }

    const env = { ...baseEnv, CLOUDFLARE_API_TOKEN: req.credentials.token, CLOUDFLARE_ACCOUNT_ID: req.credentials.accountId };
    const name = this.sanitizeProjectName(req.projectName);
    const commands = this.pagesCommands(staticDir, name, this.pagesBranch(req.production, req.gitBranch));
    // Creating an existing project fails harmlessly; the deploy step reports real problems.
    await run(commands.create, env);
    const result = await run(commands.deploy, env);
    return this.finish('cloudflare-pages', result);
  }

  private static finish(target: DeployTarget, result: RunResult): DeployResult {
    const output = `${result.stdout}\n${result.stderr}`.replace(/\x1b\[[0-9;]*m/g, '');
    const outputTail = output.split(/\r?\n/).filter((l) => l.trim()).slice(-20).join('\n');
    if (result.aborted) return { success: false, message: 'Deploy cancelled.', outputTail };
    if (result.timedOut) return { success: false, message: 'The deploy timed out. Check the log and your connection.', outputTail };
    if (result.spawnError) return { success: false, message: `Could not start the deploy tool: ${result.spawnError}. Is Node.js/npm on your PATH?`, outputTail };

    const url = this.parseDeployUrl(target, output);
    if (result.code === 0 && url) {
      return { success: true, url, message: 'Deployed.', outputTail };
    }
    if (/invalid token|not authorized|authentication error|unauthorized|code: 10000/i.test(output)) {
      return { success: false, message: 'The provider rejected your token. Create a new token and reconnect your account.', outputTail };
    }
    return { success: false, message: `The deploy failed (exit code ${result.code}). See the log for details.`, outputTail };
  }
}
