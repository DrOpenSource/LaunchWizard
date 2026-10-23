import { spawn, execSync, ChildProcess } from 'node:child_process';
import * as net from 'node:net';
import * as dns from 'node:dns/promises';
import { EventEmitter } from 'node:events';
import { QrGenerator } from './QrGenerator.js';
import { LinkGuardProxy, type VisitorEntry } from './LinkGuardProxy.js';
import { killProcessTree } from './ProcessRunner.js';
import type { TunnelInfo, TunnelProvider } from '../shared/types.js';

export interface TunnelOptions {
  port: number;
  provider?: TunnelProvider;
  timeoutMs?: number;
  allowFallback?: boolean;
  /** Cancels a start that is still connecting. */
  signal?: AbortSignal;
  /** Loopback address the dev server answers on ('127.0.0.1' or '::1'); detected when omitted. */
  targetHost?: string;
  /** Called each time a different provider is tried, for progress messages. */
  onProviderAttempt?: (provider: TunnelProvider) => void;
  /** Called with short progress messages ("waiting for the link to go live…"). */
  onStage?: (message: string) => void;
  /** Pro: passcode protection and/or visitor log through a local proxy. */
  guard?: { passcode?: string; logVisitors: boolean };
  /** Pro: stop the link automatically after this many minutes. */
  expiresInMinutes?: number;
  /** Pro: run a named Cloudflare Tunnel on the user's own domain (provider 'custom'). */
  namedTunnel?: { name: string; hostname: string };
  label?: string;
}

type ChildLike = ChildProcess | (EventEmitter & { pid?: number; kill: (signal?: NodeJS.Signals) => boolean; stdout?: EventEmitter | null; stderr?: EventEmitter | null; exitCode?: number | null });

class TunnelCancelledError extends Error {
  constructor() {
    super('Tunnel start was cancelled.');
    this.name = 'AbortError';
  }
}

/**
 * One public link (one local port). Tracks every process it spawned, so a late
 * "exit" from a replaced process can never clear the state of the live one.
 */
class TunnelSession {
  public info: TunnelInfo;
  private readonly children = new Set<ChildLike>();
  private activeChild: ChildLike | null = null;
  private proxy: LinkGuardProxy | null = null;
  private expiryTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(public readonly id: string, private readonly options: TunnelOptions) {
    this.info = {
      id,
      label: options.label,
      url: '',
      localPort: options.port,
      provider: options.provider ?? 'cloudflare',
      qrCodeSvg: '',
      startedAt: Date.now(),
      uptimeSeconds: 0,
      status: 'starting',
    };
  }

  public async start(): Promise<TunnelInfo> {
    const { port, timeoutMs = 45000, allowFallback = true } = this.options;
    TunnelManager.emitChange(this.info);

    const targetHost = this.options.targetHost ?? (await TunnelManager.detectLocalHost(port)) ?? '127.0.0.1';
    let tunnelHost = targetHost;
    let tunnelPort = port;

    if (this.options.guard) {
      this.proxy = new LinkGuardProxy({
        targetHost,
        targetPort: port,
        passcode: this.options.guard.passcode,
        logVisitors: this.options.guard.logVisitors,
      });
      this.proxy.on('visitor', () => {
        this.info.visitorCount = this.proxy?.visitors().length ?? 0;
        TunnelManager.emitChange(this.info, 'visitor');
      });
      tunnelPort = await this.proxy.start();
      tunnelHost = '127.0.0.1';
    }

    let provider: TunnelProvider = this.options.namedTunnel ? 'custom' : this.options.provider ?? TunnelManager.pickProvider();
    let url: string;
    for (;;) {
      if (this.stopped) throw new TunnelCancelledError();
      this.info.provider = provider;
      try {
        url = await this.attempt(provider, tunnelHost, tunnelPort, timeoutMs);
        break;
      } catch (err) {
        const cancelled = err instanceof TunnelCancelledError || this.options.signal?.aborted || this.stopped;
        const next = !cancelled && allowFallback && provider !== 'custom' ? TunnelManager.getNextFallbackProvider(provider) : null;
        if (!next) {
          this.fail(err instanceof Error ? err.message : String(err));
          throw err;
        }
        provider = next;
        this.options.onProviderAttempt?.(provider);
      }
    }

    // A brand-new trycloudflare.com hostname takes ~5-30 s to resolve everywhere. Opening it
    // earlier makes the OS cache "not found" for minutes, so announce the link only once it resolves.
    let dnsPending = false;
    if (provider === 'cloudflare') {
      this.options.onStage?.('waiting for the link to go live worldwide…');
      dnsPending = !(await TunnelManager.waitForPublicDns(new URL(url).hostname, 45000, this.options.signal));
      if (this.stopped || this.options.signal?.aborted) throw new TunnelCancelledError();
    }

    const shareUrl = this.proxy ? this.proxy.shareUrl(url) : url;
    this.info = {
      dnsPending,
      ...this.info,
      url,
      shareUrl,
      provider,
      qrCodeSvg: QrGenerator.generateSvg(shareUrl),
      startedAt: Date.now(),
      status: 'active',
      isProtected: this.proxy?.isProtected ?? false,
      passcode: this.options.guard?.passcode,
      visitorCount: 0,
    };

    if (this.options.expiresInMinutes && this.options.expiresInMinutes > 0) {
      this.info.expiresAt = Date.now() + this.options.expiresInMinutes * 60000;
      this.expiryTimer = setTimeout(() => {
        this.stop();
        TunnelManager.emitChange(this.info, 'expired');
      }, this.options.expiresInMinutes * 60000);
    }

    TunnelManager.emitChange(this.info);
    return this.info;
  }

  private attempt(provider: TunnelProvider, host: string, port: number, timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let done = false;
      let stderrTail = '';
      const signal = this.options.signal;

      const child = TunnelManager.launchProcess(provider, port, host, this.options.namedTunnel) as ChildLike;
      this.children.add(child);
      this.activeChild = child;

      const finish = (err: Error | null, url?: string) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (err) {
          this.killChild(child);
          reject(err);
        } else {
          resolve(url!);
        }
      };

      const timer = setTimeout(
        () => finish(new Error(`Timed out waiting for ${provider} tunnel to start after ${timeoutMs}ms.`)),
        timeoutMs
      );
      const onAbort = () => finish(new TunnelCancelledError());
      if (signal) {
        if (signal.aborted) {
          setImmediate(onAbort);
        } else {
          signal.addEventListener('abort', onAbort, { once: true });
        }
      }

      const onData = (data: Buffer) => {
        const text = data.toString();
        const url = provider === 'custom'
          ? (/Registered tunnel connection/i.test(text) ? `https://${this.options.namedTunnel!.hostname}` : null)
          : TunnelManager.extractTunnelUrl(text);
        if (url) finish(null, url);
      };

      child.stdout?.on('data', onData);
      child.stderr?.on('data', (data: Buffer) => {
        stderrTail = (stderrTail + data.toString()).slice(-2000);
        onData(data);
      });

      child.on('error', (err: Error) => finish(new Error(`Failed to spawn ${provider} tunnel process: ${err.message}`)));

      child.on('exit', (code: number | null) => {
        this.children.delete(child);
        if (!done) {
          const lastLine = stderrTail.trim().split('\n').pop();
          finish(new Error(`Tunnel process exited prematurely with code ${code}${lastLine ? `: ${lastLine}` : ''}.`));
          return;
        }
        // Only the live process may change the session's state.
        if (child === this.activeChild && !this.stopped) {
          this.fail('The preview link closed unexpectedly. Start it again to get a new link.');
        }
      });
    });
  }

  private fail(message: string): void {
    this.clearExpiry();
    this.proxy?.stop();
    this.proxy = null;
    this.info = { ...this.info, status: 'error', error: message };
    TunnelManager.emitChange(this.info);
  }

  public stop(): boolean {
    const hadWork = this.children.size > 0 || this.info.status === 'active' || this.info.status === 'starting';
    this.stopped = true;
    this.clearExpiry();
    for (const child of this.children) {
      this.killChild(child);
    }
    this.children.clear();
    this.activeChild = null;
    this.proxy?.stop();
    this.proxy = null;
    this.info = { ...this.info, status: 'stopped' };
    TunnelManager.emitChange(this.info);
    return hadWork;
  }

  public visitors(): VisitorEntry[] {
    return this.proxy?.visitors() ?? [];
  }

  private clearExpiry(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  private killChild(child: ChildLike): void {
    if (child instanceof ChildProcess) {
      if (child.exitCode === null && child.signalCode === null) {
        // Shell/npx launches spawn grandchildren that a plain kill() would orphan.
        killProcessTree(child.pid);
      }
    } else {
      child.kill();
    }
  }
}

export class TunnelManager {
  /** Emits 'change' (TunnelInfo, reason?) whenever any link starts, stops, fails, expires or gets a visitor. */
  public static readonly events = new EventEmitter();
  private static sessions = new Map<string, TunnelSession>();

  /**
   * Checks whether the cloudflared binary is installed and present in system PATH.
   */
  public static isCloudflaredAvailable(): boolean {
    return this.isOnPath('cloudflared');
  }

  /**
   * Checks whether the OpenSSH binary is installed and present in system PATH.
   * Windows 10/11 includes ssh.exe by default at C:\Windows\System32\OpenSSH\ssh.exe.
   */
  public static isSshAvailable(): boolean {
    return this.isOnPath('ssh');
  }

  private static isOnPath(binary: string): boolean {
    try {
      const cmd = process.platform === 'win32' ? `where.exe ${binary}` : `which ${binary}`;
      execSync(cmd, { stdio: 'ignore', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  public static emitChange(info: TunnelInfo, reason?: string): void {
    this.events.emit('change', info, reason);
  }

  /**
   * Returns the primary tunnel's information, or idle status if none is running.
   */
  public static getStatus(id = 'primary'): TunnelInfo {
    const session = this.sessions.get(id);
    if (!session || session.info.status === 'stopped') {
      return {
        url: '',
        localPort: 0,
        provider: 'cloudflare',
        qrCodeSvg: '',
        startedAt: 0,
        uptimeSeconds: 0,
        status: 'idle',
      };
    }

    return {
      ...session.info,
      uptimeSeconds: session.info.status === 'active' ? Math.floor((Date.now() - session.info.startedAt) / 1000) : 0,
    };
  }

  /** All links that are starting, active, or failed (for the deck). */
  public static listTunnels(): TunnelInfo[] {
    return [...this.sessions.keys()]
      .map((id) => this.getStatus(id))
      .filter((info) => info.status !== 'idle');
  }

  public static getVisitors(id = 'primary'): VisitorEntry[] {
    return this.sessions.get(id)?.visitors() ?? [];
  }

  /** Picks the best available provider: Cloudflare -> localhost.run (OpenSSH) -> localtunnel. */
  public static pickProvider(): TunnelProvider {
    if (this.isCloudflaredAvailable()) return 'cloudflare';
    if (this.isSshAvailable()) return 'localhost.run';
    return 'localtunnel';
  }

  /**
   * Starts (or returns) the primary shareable link for a local port.
   */
  public static async startTunnel(options: TunnelOptions): Promise<TunnelInfo> {
    return this.startSession('primary', options);
  }

  /** Pro multi-port sharing: an additional link alongside the primary one. */
  public static async startExtraTunnel(id: string, options: TunnelOptions): Promise<TunnelInfo> {
    if (id === 'primary') throw new Error('"primary" is reserved for the main link.');
    return this.startSession(id, options);
  }

  private static async startSession(id: string, options: TunnelOptions): Promise<TunnelInfo> {
    const existing = this.sessions.get(id);
    if (existing && existing.info.status === 'active' && existing.info.localPort === options.port && !options.guard && !options.namedTunnel) {
      return this.getStatus(id);
    }
    existing?.stop();

    const session = new TunnelSession(id, options);
    this.sessions.set(id, session);
    return session.start();
  }

  public static getNextFallbackProvider(current: TunnelProvider): TunnelProvider | null {
    if (current === 'cloudflare') {
      return this.isSshAvailable() ? 'localhost.run' : 'localtunnel';
    }
    if (current === 'localhost.run') {
      return 'localtunnel';
    }
    return null;
  }

  public static launchProcess(
    provider: TunnelProvider,
    port: number,
    host = '127.0.0.1',
    namedTunnel?: { name: string; hostname: string }
  ): ChildProcess {
    const hostForUrl = host.includes(':') ? `[${host}]` : host;

    if (provider === 'custom') {
      if (!namedTunnel) throw new Error('A named tunnel is required for custom domains.');
      return spawn('cloudflared', ['tunnel', '--no-autoupdate', 'run', '--url', `http://${hostForUrl}:${port}`, namedTunnel.name], {
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }

    if (provider === 'cloudflare') {
      return spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://${hostForUrl}:${port}`], {
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }

    if (provider === 'localhost.run') {
      const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null';
      return spawn('ssh', [
        '-o', 'StrictHostKeyChecking=no',
        '-o', `UserKnownHostsFile=${nullDevice}`,
        '-o', 'ServerAliveInterval=30',
        '-R', `80:${hostForUrl}:${port}`,
        'nokey@localhost.run',
      ], {
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }

    // Localtunnel via npx. The shell is needed for npx.cmd on Windows; port and host are values we generated.
    const cmd = `npx --yes localtunnel --port ${Number(port)} --local-host ${host.includes(':') ? '::1' : '127.0.0.1'}`;
    return spawn(cmd, {
      shell: true,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  /**
   * Stops a link and every process it started.
   */
  public static stopTunnel(id = 'primary'): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    const stopped = session.stop();
    this.sessions.delete(id);
    return stopped;
  }

  public static stopAll(): void {
    for (const id of [...this.sessions.keys()]) {
      this.stopTunnel(id);
    }
  }

  /**
   * Extracts public HTTPS tunnel URLs from stdout/stderr streams.
   */
  public static extractTunnelUrl(output: string): string | null {
    const cfMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/i);
    if (cfMatch) {
      return cfMatch[0];
    }

    const ltMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.loca\.lt/i);
    if (ltMatch) {
      return ltMatch[0];
    }

    const lhrMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.lhr\.life/i);
    if (lhrMatch) {
      return lhrMatch[0];
    }

    return null;
  }

  /**
   * Waits until a hostname resolves on Cloudflare's public resolver three times in a row
   * (propagation across resolver instances is uneven at first). Never queries the OS resolver,
   * so a too-early miss can't get cached on this machine. Returns false on timeout.
   */
  public static async waitForPublicDns(hostname: string, timeoutMs = 45000, signal?: AbortSignal): Promise<boolean> {
    const resolver = new dns.Resolver({ timeout: 2000, tries: 1 });
    resolver.setServers(['1.1.1.1', '1.0.0.1']);
    const deadline = Date.now() + timeoutMs;
    let streak = 0;
    while (Date.now() < deadline && !signal?.aborted) {
      try {
        await resolver.resolve4(hostname);
        streak++;
        if (streak >= 3) return true;
      } catch {
        streak = 0;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }

  /**
   * Finds which loopback address the dev server answers on. Dev servers bound to "localhost"
   * may listen on IPv6 ::1 only, in which case forwarding to 127.0.0.1 gives 502 errors.
   */
  public static async detectLocalHost(port: number): Promise<string | null> {
    if (await this.checkLocalPortReachable(port, '127.0.0.1')) return '127.0.0.1';
    if (await this.checkLocalPortReachable(port, '::1')) return '::1';
    return null;
  }

  /**
   * Health-checks the local dev server before launching the tunnel to avoid dead links.
   */
  public static checkLocalPortReachable(port: number, host = '127.0.0.1'): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1200);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, host);
    });
  }
}
