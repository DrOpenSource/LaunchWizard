import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runProcess } from './ProcessRunner.js';

export interface SetupStep {
  ok: boolean;
  message: string;
}

/**
 * Pro "Custom Subdomains": a named Cloudflare Tunnel on the user's own domain
 * (e.g. preview.example.com). Requires a domain managed in the user's free Cloudflare account;
 * Cloudflare Tunnel itself is free, so this costs the maintainer nothing.
 */
export class NamedTunnelSetup {
  public static certPath(): string {
    return process.env.TUNNEL_ORIGIN_CERT ?? path.join(os.homedir(), '.cloudflared', 'cert.pem');
  }

  public static isLoggedIn(): boolean {
    return fs.existsSync(this.certPath());
  }

  /** A subdomain of a real domain, e.g. "preview.example.com" (apex domains are refused to protect live sites). */
  public static validateHostname(hostname: string): string | null {
    const h = hostname.trim().toLowerCase();
    if (!/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(h)) {
      return 'Enter a hostname like preview.example.com.';
    }
    if (h.split('.').length < 3) {
      return 'Use a subdomain (like preview.example.com), not the main domain: pointing the main domain at your laptop would take your real site offline.';
    }
    return null;
  }

  public static tunnelNameFor(hostname: string): string {
    return `launchwizard-${hostname.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.slice(0, 63);
  }

  /** Opens the Cloudflare login page in the browser and waits for the user to authorize a domain. */
  public static async login(signal?: AbortSignal): Promise<SetupStep> {
    const result = await runProcess('cloudflared', ['tunnel', 'login'], { cwd: os.homedir(), timeoutMs: 5 * 60 * 1000, signal });
    if (result.spawnError) return { ok: false, message: 'cloudflared is not installed. Install it first (winget install Cloudflare.cloudflared / brew install cloudflared).' };
    if (this.isLoggedIn()) return { ok: true, message: 'Cloudflare login complete.' };
    return { ok: false, message: result.timedOut ? 'Cloudflare login timed out. Try again and approve the domain in the browser.' : 'Cloudflare login did not finish.' };
  }

  public static parseTunnelList(json: string): Array<{ id: string; name: string }> {
    try {
      const data = JSON.parse(json) as Array<{ id: string; name: string; deleted_at?: string }>;
      return data.filter((t) => !t.deleted_at || t.deleted_at.startsWith('0001')).map((t) => ({ id: t.id, name: t.name }));
    } catch {
      return [];
    }
  }

  /** Creates the named tunnel unless it already exists. */
  public static async ensureTunnel(name: string, signal?: AbortSignal): Promise<SetupStep> {
    const list = await runProcess('cloudflared', ['tunnel', 'list', '--output', 'json'], { cwd: os.homedir(), timeoutMs: 60000, signal });
    if (this.parseTunnelList(list.stdout).some((t) => t.name === name)) {
      return { ok: true, message: `Using existing tunnel "${name}".` };
    }
    const created = await runProcess('cloudflared', ['tunnel', 'create', name], { cwd: os.homedir(), timeoutMs: 60000, signal });
    return created.code === 0
      ? { ok: true, message: `Created tunnel "${name}".` }
      : { ok: false, message: `Could not create the tunnel: ${(created.stderr || created.stdout).trim().split('\n').pop()}` };
  }

  /**
   * Points the hostname at the tunnel. Never overwrites an existing DNS record:
   * that record could belong to a live site.
   */
  public static async routeDns(name: string, hostname: string, signal?: AbortSignal): Promise<SetupStep> {
    const result = await runProcess('cloudflared', ['tunnel', 'route', 'dns', name, hostname], { cwd: os.homedir(), timeoutMs: 60000, signal });
    return this.interpretRoute(result.code, `${result.stdout}\n${result.stderr}`, hostname);
  }

  public static interpretRoute(code: number | null, output: string, hostname: string): SetupStep {
    if (code === 0 || /already configured to route to your tunnel/i.test(output)) {
      return { ok: true, message: `${hostname} now points to your tunnel.` };
    }
    if (/already exists/i.test(output)) {
      return { ok: false, message: `A DNS record for ${hostname} already exists and LaunchWizard won't overwrite it. Pick a different subdomain, or delete that record in the Cloudflare dashboard if you no longer need it.` };
    }
    return { ok: false, message: `Could not point ${hostname} at the tunnel: ${output.trim().split('\n').pop()}` };
  }
}
