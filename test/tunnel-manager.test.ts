import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TunnelManager } from '../src/core/TunnelManager.js';
import { QrGenerator } from '../src/core/QrGenerator.js';
import * as http from 'node:http';
import { EventEmitter } from 'node:events';

describe('TunnelManager & QrGenerator', () => {
  // Real DNS waits are covered by the live smoke test; unit tests use fake hostnames.
  beforeEach(() => {
    vi.spyOn(TunnelManager, 'waitForPublicDns').mockResolvedValue(true);
  });

  it('extracts Cloudflare Quick Tunnel URLs from stdout stream', () => {
    const output = [
      '2026-10-10T12:00:00Z INF +--------------------------------------------------------------------------------------------+',
      '2026-10-10T12:00:00Z INF |  Your quick Tunnel has been created! Visit it at:                                         |',
      '2026-10-10T12:00:00Z INF |  https://purple-falcon-testing-123.trycloudflare.com                                       |',
      '2026-10-10T12:00:00Z INF +--------------------------------------------------------------------------------------------+',
    ].join('\n');

    const url = TunnelManager.extractTunnelUrl(output);
    expect(url).toBe('https://purple-falcon-testing-123.trycloudflare.com');
  });

  it('extracts Localtunnel and Localhost.run fallback URLs', () => {
    const ltOutput = 'your url is: https://smart-rabbit-99.loca.lt';
    expect(TunnelManager.extractTunnelUrl(ltOutput)).toBe('https://smart-rabbit-99.loca.lt');

    const lhrOutput = 'Connect via https://dev-preview.lhr.life';
    expect(TunnelManager.extractTunnelUrl(lhrOutput)).toBe('https://dev-preview.lhr.life');
  });

  it('returns null when no valid tunnel URL is present in stream', () => {
    const rawOutput = 'Starting cloudflared agent... connecting to edge servers...';
    expect(TunnelManager.extractTunnelUrl(rawOutput)).toBeNull();
  });

  it('generates crisp scannable SVG QR code with finder patterns', () => {
    const testUrl = 'https://cool-app-preview.trycloudflare.com';
    const svg = QrGenerator.generateSvg(testUrl, 240);

    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('viewBox="0 0 240 240"');
    expect(svg).toContain('<rect');
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  it('generates valid base64 data URI for QR codes', () => {
    const testUrl = 'https://mobile-vibe.trycloudflare.com';
    const dataUrl = QrGenerator.generateDataUrl(testUrl);

    expect(dataUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const decoded = Buffer.from(dataUrl.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf-8');
    expect(decoded).toContain('<svg');
  });

  it('reports idle status when no tunnel is running and stops cleanly', () => {
    TunnelManager.stopTunnel();
    const status = TunnelManager.getStatus();
    expect(status.status).toBe('idle');
    expect(status.url).toBe('');
    expect(status.localPort).toBe(0);
  });

  it('checks if cloudflared binary is available returning boolean', () => {
    const isAvailable = TunnelManager.isCloudflaredAvailable();
    expect(typeof isAvailable).toBe('boolean');
  });

  it('detects when local port is reachable vs unreachable', async () => {
    const unreachable = await TunnelManager.checkLocalPortReachable(49999);
    expect(unreachable).toBe(false);

    const server = http.createServer((_req, res) => res.end('ok'));
    await new Promise<void>((resolve) => server.listen(49998, resolve));
    try {
      const reachable = await TunnelManager.checkLocalPortReachable(49998);
      expect(reachable).toBe(true);
    } finally {
      server.close();
    }
  });

  it('manages tunnel lifecycle, URL resolution, and clean shutdown', async () => {
    const fakeChild = new EventEmitter() as any;
    fakeChild.stdout = new EventEmitter();
    fakeChild.stderr = new EventEmitter();
    fakeChild.pid = 99999;
    fakeChild.kill = vi.fn();

    // Emit the URL only once the process has actually been launched (provider and host detection run first).
    const launchSpy = vi.spyOn(TunnelManager as any, 'launchProcess').mockImplementation(() => {
      setTimeout(() => {
        fakeChild.stdout.emit('data', Buffer.from('your url is: https://test-mock-preview.loca.lt\n'));
      }, 10);
      return fakeChild;
    });

    try {
      const tunnelPromise = TunnelManager.startTunnel({ port: 3000, timeoutMs: 5000 });

      const tunnel = await tunnelPromise;
      expect(tunnel.status).toBe('active');
      expect(tunnel.url).toBe('https://test-mock-preview.loca.lt');
      expect(tunnel.localPort).toBe(3000);
      expect(tunnel.qrCodeSvg).toContain('<svg');

      const stopped = TunnelManager.stopTunnel();
      expect(stopped).toBe(true);
      expect(TunnelManager.getStatus().status).toBe('idle');
    } finally {
      launchSpy.mockRestore();
      TunnelManager.stopTunnel();
    }
  });

  it('checks if ssh binary is available returning boolean', () => {
    const isSsh = TunnelManager.isSshAvailable();
    expect(typeof isSsh).toBe('boolean');
  });

  it('manages zero-interstitial localhost.run tunnel via OpenSSH and generates valid QR code', async () => {
    const fakeChild = new EventEmitter() as any;
    fakeChild.stdout = new EventEmitter();
    fakeChild.stderr = new EventEmitter();
    fakeChild.pid = 99998;
    fakeChild.kill = vi.fn();

    const launchSpy = vi.spyOn(TunnelManager as any, 'launchProcess').mockImplementation((provider) => {
      expect(provider).toBe('localhost.run');
      // Simulate localhost.run stdout once the process exists (host detection runs first).
      setTimeout(() => {
        fakeChild.stdout.emit('data', Buffer.from('f95a5479518502.lhr.life tunneled with tls termination, https://f95a5479518502.lhr.life\n'));
      }, 10);
      return fakeChild;
    });

    try {
      const tunnelPromise = TunnelManager.startTunnel({ port: 5173, provider: 'localhost.run', timeoutMs: 5000 });

      const tunnel = await tunnelPromise;
      expect(tunnel.status).toBe('active');
      expect(tunnel.provider).toBe('localhost.run');
      expect(tunnel.url).toBe('https://f95a5479518502.lhr.life');
      expect(tunnel.localPort).toBe(5173);
      expect(tunnel.qrCodeSvg).toContain('<svg');

      const stopped = TunnelManager.stopTunnel();
      expect(stopped).toBe(true);
    } finally {
      launchSpy.mockRestore();
      TunnelManager.stopTunnel();
    }
  });

  it('cascades fallback to localhost.run when cloudflare process exits prematurely', async () => {
    const cfChild = new EventEmitter() as any;
    cfChild.stdout = new EventEmitter();
    cfChild.stderr = new EventEmitter();
    cfChild.pid = 99991;
    cfChild.kill = vi.fn();

    const lhrChild = new EventEmitter() as any;
    lhrChild.stdout = new EventEmitter();
    lhrChild.stderr = new EventEmitter();
    lhrChild.pid = 99992;
    lhrChild.kill = vi.fn();

    const cfAvailableSpy = vi.spyOn(TunnelManager, 'isCloudflaredAvailable').mockReturnValue(true);
    const sshSpy = vi.spyOn(TunnelManager, 'isSshAvailable').mockReturnValue(true);
    let calls = 0;
    // Events fire only after each process is launched, so host detection timing can't race them.
    const launchSpy = vi.spyOn(TunnelManager as any, 'launchProcess').mockImplementation((provider) => {
      calls++;
      if (provider === 'cloudflare') {
        setTimeout(() => cfChild.emit('exit', 1), 10);
        return cfChild;
      }
      setTimeout(() => lhrChild.stdout.emit('data', Buffer.from('Connect via https://dev-fallback.lhr.life\n')), 10);
      return lhrChild;
    });

    try {
      const tunnelPromise = TunnelManager.startTunnel({ port: 3000, provider: 'cloudflare', timeoutMs: 5000 });

      const tunnel = await tunnelPromise;
      expect(calls).toBe(2);
      expect(tunnel.status).toBe('active');
      expect(tunnel.url).toBe('https://dev-fallback.lhr.life');
      expect(tunnel.provider).toBe('localhost.run');

      TunnelManager.stopTunnel();
    } finally {
      cfAvailableSpy.mockRestore();
      sshSpy.mockRestore();
      launchSpy.mockRestore();
      TunnelManager.stopTunnel();
    }
  });

  const makeChild = (pid: number) => {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.pid = pid;
    child.kill = vi.fn();
    return child;
  };

  it('B4: a late exit from a timed-out process cannot orphan the fallback tunnel', async () => {
    const cfChild = makeChild(1);
    const lhrChild = makeChild(2);
    const sshSpy = vi.spyOn(TunnelManager, 'isSshAvailable').mockReturnValue(true);
    const launchSpy = vi.spyOn(TunnelManager as any, 'launchProcess').mockImplementation((provider) => {
      if (provider === 'cloudflare') return cfChild;
      setTimeout(() => lhrChild.stdout.emit('data', Buffer.from('https://late-exit.lhr.life\n')), 10);
      return lhrChild;
    });

    try {
      // Cloudflare never prints a URL, so it times out and we fall back.
      const tunnel = await TunnelManager.startTunnel({ port: 3001, provider: 'cloudflare', timeoutMs: 100, targetHost: '127.0.0.1' });
      expect(tunnel.provider).toBe('localhost.run');

      // The killed Cloudflare process reports its exit only now.
      cfChild.emit('exit', 1);
      expect(TunnelManager.getStatus().status).toBe('active');

      expect(TunnelManager.stopTunnel()).toBe(true);
      expect(lhrChild.kill).toHaveBeenCalled();
      expect(TunnelManager.getStatus().status).toBe('idle');
    } finally {
      sshSpy.mockRestore();
      launchSpy.mockRestore();
      TunnelManager.stopAll();
    }
  });

  it('B6: a start can be cancelled while connecting', async () => {
    const child = makeChild(3);
    const launchSpy = vi.spyOn(TunnelManager as any, 'launchProcess').mockReturnValue(child);
    const controller = new AbortController();
    try {
      const promise = TunnelManager.startTunnel({ port: 3002, provider: 'cloudflare', timeoutMs: 5000, signal: controller.signal, targetHost: '127.0.0.1' });
      setTimeout(() => controller.abort(), 20);
      await expect(promise).rejects.toThrow(/cancelled/);
      expect(child.kill).toHaveBeenCalled();
      expect(launchSpy).toHaveBeenCalledTimes(1);
    } finally {
      launchSpy.mockRestore();
      TunnelManager.stopAll();
    }
  });

  it('B7/B10: forwards to IPv6 when needed and reports an unexpected close', async () => {
    const child = makeChild(4);
    const changes: string[] = [];
    const listener = (info: { status: string }) => changes.push(info.status);
    TunnelManager.events.on('change', listener);
    const launchSpy = vi.spyOn(TunnelManager as any, 'launchProcess').mockImplementation((_p, _port, host) => {
      expect(host).toBe('::1');
      setTimeout(() => child.stdout.emit('data', Buffer.from('https://v6-test.trycloudflare.com\n')), 10);
      return child;
    });
    try {
      await TunnelManager.startTunnel({ port: 3003, provider: 'cloudflare', targetHost: '::1', timeoutMs: 5000 });
      child.emit('exit', 1);
      const status = TunnelManager.getStatus();
      expect(status.status).toBe('error');
      expect(status.error).toContain('closed unexpectedly');
      expect(changes).toEqual(expect.arrayContaining(['starting', 'active', 'error']));
    } finally {
      TunnelManager.events.off('change', listener);
      launchSpy.mockRestore();
      TunnelManager.stopAll();
    }
  });

  it('expires a link automatically', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const child = makeChild(5);
    const launchSpy = vi.spyOn(TunnelManager as any, 'launchProcess').mockImplementation(() => {
      setTimeout(() => child.stdout.emit('data', Buffer.from('https://expiring.trycloudflare.com\n')), 1);
      return child;
    });
    try {
      const promise = TunnelManager.startTunnel({ port: 3004, provider: 'cloudflare', targetHost: '127.0.0.1', expiresInMinutes: 30, timeoutMs: 5000 });
      await vi.advanceTimersByTimeAsync(5);
      const tunnel = await promise;
      expect(tunnel.expiresAt).toBeGreaterThan(Date.now());
      await vi.advanceTimersByTimeAsync(30 * 60000);
      expect(TunnelManager.getStatus().status).toBe('idle');
      expect(child.kill).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      launchSpy.mockRestore();
      TunnelManager.stopAll();
    }
  });

  it('runs extra tunnels for multi-port sharing independently', async () => {
    const children = [makeChild(6), makeChild(7)];
    let n = 0;
    const launchSpy = vi.spyOn(TunnelManager as any, 'launchProcess').mockImplementation(() => {
      const child = children[n];
      const id = n++;
      setTimeout(() => child.stdout.emit('data', Buffer.from(`https://port-${id}.trycloudflare.com\n`)), 5);
      return child;
    });
    try {
      await TunnelManager.startTunnel({ port: 3005, provider: 'cloudflare', targetHost: '127.0.0.1' });
      await TunnelManager.startExtraTunnel('api', { port: 8000, provider: 'cloudflare', targetHost: '127.0.0.1', label: 'API' });
      expect(TunnelManager.listTunnels().map((t) => t.url).sort()).toEqual(['https://port-0.trycloudflare.com', 'https://port-1.trycloudflare.com']);
      TunnelManager.stopTunnel('api');
      expect(TunnelManager.listTunnels()).toHaveLength(1);
      expect(children[1].kill).toHaveBeenCalled();
      expect(children[0].kill).not.toHaveBeenCalled();
    } finally {
      launchSpy.mockRestore();
      TunnelManager.stopAll();
    }
  });

  it("waits for public DNS on Cloudflare links and flags a slow one instead of failing", async () => {
    vi.mocked(TunnelManager.waitForPublicDns).mockResolvedValueOnce(false);
    const child = makeChild(8);
    const stages: string[] = [];
    const launchSpy = vi.spyOn(TunnelManager as any, "launchProcess").mockImplementation(() => {
      setTimeout(() => child.stdout.emit("data", Buffer.from("https://slow-dns.trycloudflare.com\n")), 5);
      return child;
    });
    try {
      const t = await TunnelManager.startTunnel({ port: 3006, provider: "cloudflare", targetHost: "127.0.0.1", onStage: (m) => stages.push(m) });
      expect(TunnelManager.waitForPublicDns).toHaveBeenCalledWith("slow-dns.trycloudflare.com", 45000, undefined);
      expect(t.status).toBe("active");
      expect(t.dnsPending).toBe(true);
      expect(stages[0]).toContain("go live");
    } finally {
      launchSpy.mockRestore();
      TunnelManager.stopAll();
    }
  });
});



