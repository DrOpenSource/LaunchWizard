import { spawn, execSync, type ChildProcess } from 'node:child_process';
import * as http from 'node:http';
import { QrGenerator } from './QrGenerator.js';
import type { TunnelInfo } from '../shared/types.js';

export interface TunnelOptions {
  port: number;
  provider?: 'cloudflare' | 'localtunnel';
  timeoutMs?: number;
}

export class TunnelManager {
  private static activeProcess: ChildProcess | null = null;
  private static currentTunnel: TunnelInfo | null = null;

  /**
   * Checks whether the cloudflared binary is installed and present in system PATH.
   */
  public static isCloudflaredAvailable(): boolean {
    try {
      const cmd = process.platform === 'win32' ? 'where.exe cloudflared' : 'which cloudflared';
      execSync(cmd, { stdio: 'ignore', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns current active tunnel information, or idle status if none running.
   */
  public static getStatus(): TunnelInfo {
    if (!this.currentTunnel || this.currentTunnel.status === 'stopped') {
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
      ...this.currentTunnel,
      uptimeSeconds: Math.floor((Date.now() - this.currentTunnel.startedAt) / 1000),
    };
  }

  /**
   * Starts a zero-config tunnel pointing to localPort (Cloudflare Quick Tunnel or Localtunnel fallback).
   */
  public static async startTunnel(options: TunnelOptions): Promise<TunnelInfo> {
    // If a tunnel is already active on the same port, return it
    if (this.currentTunnel && this.currentTunnel.status === 'active' && this.currentTunnel.localPort === options.port) {
      return this.getStatus();
    }

    // Stop existing tunnel if switching ports
    if (this.activeProcess) {
      this.stopTunnel();
    }

    const { port, timeoutMs = 25000 } = options;

    const preferredProvider: 'cloudflare' | 'localtunnel' =
      options.provider || (this.isCloudflaredAvailable() ? 'cloudflare' : 'localtunnel');

    return this.spawnTunnelWithProvider(preferredProvider, port, timeoutMs, !options.provider);
  }

  private static launchProcess(provider: 'cloudflare' | 'localtunnel', port: number): ChildProcess {
    if (provider === 'cloudflare') {
      return spawn('cloudflared', ['tunnel', '--url', `http://127.0.0.1:${port}`], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }

    // Localtunnel via npx (zero account, zero local installation required)
    const cmd = `npx --yes localtunnel --port ${port}`;
    return spawn(cmd, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  private static spawnTunnelWithProvider(
    provider: 'cloudflare' | 'localtunnel',
    port: number,
    timeoutMs: number,
    allowFallback: boolean
  ): Promise<TunnelInfo> {
    return new Promise<TunnelInfo>((resolve, reject) => {
      let isResolved = false;
      let stderrBuffer = '';

      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          this.stopTunnel();
          reject(new Error(`Timed out waiting for ${provider} tunnel to start after ${timeoutMs}ms.`));
        }
      }, timeoutMs);

      try {
        const child = this.launchProcess(provider, port);
        this.activeProcess = child;

        this.currentTunnel = {
          url: '',
          localPort: port,
          provider,
          qrCodeSvg: '',
          startedAt: Date.now(),
          uptimeSeconds: 0,
          status: 'starting',
        };

        const handleOutput = (data: Buffer) => {
          const text = data.toString();
          const capturedUrl = this.extractTunnelUrl(text);

          if (capturedUrl && !isResolved) {
            clearTimeout(timeout);
            isResolved = true;

            const qrCodeSvg = QrGenerator.generateSvg(capturedUrl);

            this.currentTunnel = {
              url: capturedUrl,
              localPort: port,
              provider,
              qrCodeSvg,
              startedAt: Date.now(),
              uptimeSeconds: 0,
              status: 'active',
            };

            resolve(this.currentTunnel);
          }
        };

        child.stdout?.on('data', handleOutput);
        child.stderr?.on('data', (data: Buffer) => {
          stderrBuffer += data.toString();
          handleOutput(data);
        });

        child.on('error', (err) => {
          if (!isResolved) {
            clearTimeout(timeout);
            isResolved = true;
            this.currentTunnel = null;
            this.activeProcess = null;

            if (allowFallback && provider === 'cloudflare') {
              this.spawnTunnelWithProvider('localtunnel', port, timeoutMs, false)
                .then(resolve)
                .catch(reject);
              return;
            }

            reject(new Error(`Failed to spawn ${provider} tunnel process: ${err.message}`));
          }
        });

        child.on('exit', (code) => {
          this.currentTunnel = null;
          this.activeProcess = null;
          if (!isResolved) {
            clearTimeout(timeout);
            isResolved = true;

            if (allowFallback && provider === 'cloudflare') {
              this.spawnTunnelWithProvider('localtunnel', port, timeoutMs, false)
                .then(resolve)
                .catch(reject);
              return;
            }

            const errTail = stderrBuffer.trim() ? `: ${stderrBuffer.trim().split('\n').pop()}` : '';
            reject(new Error(`Tunnel process exited prematurely with code ${code}${errTail}.`));
          }
        });
      } catch (err) {
        clearTimeout(timeout);
        this.currentTunnel = null;
        this.activeProcess = null;

        if (allowFallback && provider === 'cloudflare') {
          this.spawnTunnelWithProvider('localtunnel', port, timeoutMs, false)
            .then(resolve)
            .catch(reject);
          return;
        }

        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /**
   * Gracefully stops the active tunnel and terminates child process tree.
   */
  public static stopTunnel(): boolean {
    if (!this.activeProcess) {
      if (this.currentTunnel) {
        this.currentTunnel.status = 'stopped';
      }
      return false;
    }

    try {
      if (process.platform === 'win32' && this.activeProcess.pid) {
        try {
          execSync(`taskkill /pid ${this.activeProcess.pid} /T /F`, { stdio: 'ignore' });
        } catch {
          this.activeProcess.kill();
        }
      } else {
        this.activeProcess.kill();
      }
      this.activeProcess = null;
      if (this.currentTunnel) {
        this.currentTunnel.status = 'stopped';
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extracts public HTTPS tunnel URLs from stdout/stderr streams.
   */
  public static extractTunnelUrl(output: string): string | null {
    // 1. Cloudflare Quick Tunnel (trycloudflare.com)
    const cfMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/i);
    if (cfMatch) {
      return cfMatch[0];
    }

    // 2. Localtunnel fallback (loca.lt)
    const ltMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.loca\.lt/i);
    if (ltMatch) {
      return ltMatch[0];
    }

    // 3. Localhost.run fallback (lhr.life)
    const lhrMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.lhr\.life/i);
    if (lhrMatch) {
      return lhrMatch[0];
    }

    return null;
  }

  /**
   * Health-checks the local dev server before launching the tunnel to avoid dead links.
   */
  public static checkLocalPortReachable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}`, () => {
        resolve(true);
      });
      req.on('error', () => {
        resolve(false);
      });
      req.setTimeout(1200, () => {
        req.destroy();
        resolve(false);
      });
    });
  }
}
