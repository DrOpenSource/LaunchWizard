import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import * as net from 'node:net';
import { LinkGuardProxy } from '../src/core/LinkGuardProxy.js';

interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

const request = (port: number, path: string, opts: { method?: string; headers?: http.OutgoingHttpHeaders; body?: string } = {}): Promise<Reply> =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: opts.method ?? 'GET', headers: opts.headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });

describe('LinkGuardProxy', () => {
  let devServer: http.Server;
  let devPort: number;
  let lastCookieSeen: string | undefined;

  beforeAll(async () => {
    devServer = http.createServer((req, res) => {
      lastCookieSeen = req.headers.cookie;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`dev:${req.url}`);
    });
    devServer.on('upgrade', (_req, socket) => {
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
      socket.end();
    });
    await new Promise<void>((r) => devServer.listen(0, '127.0.0.1', r));
    devPort = (devServer.address() as net.AddressInfo).port;
  });

  afterAll(() => devServer.close());

  it('passes traffic through and logs page visits by device', async () => {
    const proxy = new LinkGuardProxy({ targetHost: '127.0.0.1', targetPort: devPort, logVisitors: true });
    const port = await proxy.start();
    try {
      const reply = await request(port, '/about', {
        headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile Safari/604.1', 'cf-connecting-ip': '203.0.113.9' },
      });
      expect(reply.body).toBe('dev:/about');
      await request(port, '/app.js', { headers: { accept: '*/*' } });
      const visits = proxy.visitors();
      expect(visits).toHaveLength(1);
      expect(visits[0]).toMatchObject({ device: 'phone', browser: 'Safari', ip: '203.0.113.9', path: '/about' });
      expect(proxy.shareUrl('https://x.trycloudflare.com')).toBe('https://x.trycloudflare.com');
    } finally {
      proxy.stop();
    }
  });

  it('blocks visitors without the token or passcode', async () => {
    const proxy = new LinkGuardProxy({ targetHost: '127.0.0.1', targetPort: devPort, passcode: '4821-7730', logVisitors: false });
    const port = await proxy.start();
    try {
      const blocked = await request(port, '/', { headers: { accept: 'text/html' } });
      expect(blocked.status).toBe(401);
      expect(blocked.body).toContain('This preview is private');
      expect(blocked.body).not.toContain('dev:');

      const ws = await request(port, '/hmr', { headers: { connection: 'Upgrade', upgrade: 'websocket' } }).catch(() => ({ status: 401 }) as Reply);
      expect(ws.status).toBe(401);
    } finally {
      proxy.stop();
    }
  });

  it('lets the tokenized share link in and strips the token and cookie', async () => {
    const proxy = new LinkGuardProxy({ targetHost: '127.0.0.1', targetPort: devPort, passcode: '4821-7730', logVisitors: false });
    const port = await proxy.start();
    try {
      const share = new URL(proxy.shareUrl('https://x.trycloudflare.com/shop'));
      const enter = await request(port, `${share.pathname}${share.search}`);
      expect(enter.status).toBe(302);
      expect(enter.headers.location).toBe('/shop');
      const cookie = (enter.headers['set-cookie'] ?? [])[0].split(';')[0];
      expect(enter.headers['set-cookie']?.[0]).toContain('HttpOnly');

      const page = await request(port, '/shop', { headers: { cookie: `${cookie}; theme=dark` } });
      expect(page.body).toBe('dev:/shop');
      expect(lastCookieSeen).toBe('theme=dark');

      const wrong = await request(port, '/?lw=not-the-token', { headers: { accept: 'text/html' } });
      expect(wrong.status).toBe(401);
    } finally {
      proxy.stop();
    }
  });

  it('accepts the passcode form and rate-limits guessing', async () => {
    const proxy = new LinkGuardProxy({ targetHost: '127.0.0.1', targetPort: devPort, passcode: '4821-7730', logVisitors: false });
    const port = await proxy.start();
    const post = (passcode: string) =>
      request(port, '/__launchwizard/login', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: `passcode=${encodeURIComponent(passcode)}`,
      });
    try {
      const ok = await post('4821-7730');
      expect(ok.status).toBe(302);
      expect(ok.headers['set-cookie']?.[0]).toContain('lw_session=');

      for (let i = 0; i < 10; i++) {
        expect((await post('0000')).status).toBe(401);
      }
      expect((await post('4821-7730')).status).toBe(429);
    } finally {
      proxy.stop();
    }
  });

  it('shows a friendly page when the dev server is down', async () => {
    const proxy = new LinkGuardProxy({ targetHost: '127.0.0.1', targetPort: 1, logVisitors: false });
    const port = await proxy.start();
    try {
      const reply = await request(port, '/');
      expect(reply.status).toBe(502);
      expect(reply.body).toContain("local server isn't responding");
    } finally {
      proxy.stop();
    }
  });

  it('classifies devices including link-preview bots', () => {
    expect(LinkGuardProxy.deviceOf('Slackbot-LinkExpanding 1.0')).toBe('bot');
    expect(LinkGuardProxy.deviceOf('Mozilla/5.0 (iPad; CPU OS 17_0)')).toBe('tablet');
    expect(LinkGuardProxy.deviceOf('Mozilla/5.0 (Windows NT 10.0) Chrome/120')).toBe('desktop');
  });
});
