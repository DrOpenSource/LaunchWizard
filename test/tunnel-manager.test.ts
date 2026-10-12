import { describe, it, expect } from 'vitest';
import { TunnelManager } from '../src/core/TunnelManager.js';
import { QrGenerator } from '../src/core/QrGenerator.js';

import * as http from 'node:http';

describe('TunnelManager & QrGenerator', () => {
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

  it('starts and stops a live localtunnel when cloudflared is unavailable', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('LaunchWizard OK');
    });

    await new Promise<void>((resolve) => server.listen(48291, resolve));

    try {
      const tunnel = await TunnelManager.startTunnel({ port: 48291, timeoutMs: 15000 });
      expect(tunnel.status).toBe('active');
      expect(tunnel.url).toMatch(/^https:\/\//);
      expect(tunnel.localPort).toBe(48291);
      expect(tunnel.qrCodeSvg).toContain('<svg');

      const stopped = TunnelManager.stopTunnel();
      expect(stopped).toBe(true);
      expect(TunnelManager.getStatus().status).toBe('idle');
    } finally {
      TunnelManager.stopTunnel();
      server.close();
    }
  }, 25000);
});
