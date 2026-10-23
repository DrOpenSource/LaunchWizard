import * as http from 'node:http';
import * as net from 'node:net';
import * as crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

export interface LinkGuardOptions {
  targetHost: string;
  targetPort: number;
  /** When set, visitors must open the tokenized share link or type this passcode. */
  passcode?: string;
  logVisitors: boolean;
  maxLogEntries?: number;
}

export type VisitorDevice = 'phone' | 'tablet' | 'desktop' | 'bot' | 'unknown';

export interface VisitorEntry {
  at: number;
  ip: string;
  device: VisitorDevice;
  browser: string;
  path: string;
}

const COOKIE = 'lw_session';
const LOGIN_PATH = '/__launchwizard/login';
const MAX_FAILED_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

/**
 * A tiny local reverse proxy that sits between the public tunnel and the dev server.
 * It adds optional passcode protection and a visitor log. Everything runs on the
 * developer's machine: no server, no account, no cost.
 */
export class LinkGuardProxy extends EventEmitter {
  public readonly token = crypto.randomBytes(18).toString('base64url');
  private server: http.Server | null = null;
  private log: VisitorEntry[] = [];
  private failedAttempts = new Map<string, number[]>();
  private readonly sockets = new Set<net.Socket>();

  constructor(private readonly options: LinkGuardOptions) {
    super();
  }

  public get isProtected(): boolean {
    return Boolean(this.options.passcode);
  }

  /** Starts listening on a random local port and returns it. */
  public start(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => this.handleRequest(req, res));
      server.on('upgrade', (req, socket, head) => this.handleUpgrade(req, socket as net.Socket, head));
      server.on('connection', (socket) => {
        this.sockets.add(socket);
        socket.on('close', () => this.sockets.delete(socket));
      });
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        this.server = server;
        resolve((server.address() as net.AddressInfo).port);
      });
    });
  }

  public stop(): void {
    for (const socket of this.sockets) {
      socket.destroy();
    }
    this.sockets.clear();
    this.server?.close();
    this.server = null;
  }

  public visitors(): VisitorEntry[] {
    return [...this.log];
  }

  /** The link to share. For protected links it carries the token so a QR scan opens directly. */
  public shareUrl(publicUrl: string): string {
    if (!this.isProtected) return publicUrl;
    const url = new URL(publicUrl);
    url.searchParams.set('lw', this.token);
    return url.toString();
  }

  // --- HTTP --------------------------------------------------------------------

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? '/', 'http://local');

    if (this.isProtected) {
      if (url.pathname === LOGIN_PATH && req.method === 'POST') {
        this.handleLogin(req, res);
        return;
      }

      const queryToken = url.searchParams.get('lw');
      if (queryToken !== null) {
        if (this.safeEqual(queryToken, this.token)) {
          url.searchParams.delete('lw');
          const location = url.pathname + (url.search || '');
          res.writeHead(302, { 'Set-Cookie': this.sessionCookie(), Location: location, 'Cache-Control': 'no-store' });
          res.end();
          return;
        }
      }

      if (!this.isAuthenticated(req)) {
        this.sendLoginPage(req, res, 401);
        return;
      }
    }

    this.recordVisit(req);
    this.forward(req, res);
  }

  private forward(req: http.IncomingMessage, res: http.ServerResponse): void {
    const headers = this.forwardHeaders(req);
    const upstream = http.request(
      {
        host: this.options.targetHost,
        port: this.options.targetPort,
        method: req.method,
        path: req.url,
        headers,
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      }
    );
    upstream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
      }
      res.end(this.page('Preview paused', "The developer's local server isn't responding right now. Try again in a moment."));
    });
    req.pipe(upstream);
  }

  private forwardHeaders(req: http.IncomingMessage): http.OutgoingHttpHeaders {
    const headers: http.OutgoingHttpHeaders = { ...req.headers };
    if (typeof headers.cookie === 'string') {
      const kept = headers.cookie
        .split(';')
        .map((c) => c.trim())
        .filter((c) => c && !c.startsWith(`${COOKIE}=`));
      if (kept.length > 0) {
        headers.cookie = kept.join('; ');
      } else {
        delete headers.cookie;
      }
    }
    headers['x-forwarded-proto'] = 'https';
    if (req.headers.host) {
      headers['x-forwarded-host'] = req.headers.host;
    }
    return headers;
  }

  // --- WebSocket (hot reload) ---------------------------------------------------

  private handleUpgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer): void {
    if (this.isProtected && !this.isAuthenticated(req)) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      return;
    }

    const upstream = net.connect(this.options.targetPort, this.options.targetHost, () => {
      const headers = this.forwardHeaders(req);
      const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
      for (const [name, value] of Object.entries(headers)) {
        if (value === undefined) continue;
        for (const v of Array.isArray(value) ? value : [value]) {
          lines.push(`${name}: ${v}`);
        }
      }
      upstream.write(lines.join('\r\n') + '\r\n\r\n');
      if (head.length > 0) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    this.sockets.add(upstream);
    upstream.on('close', () => this.sockets.delete(upstream));
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
  }

  // --- Auth ---------------------------------------------------------------------

  private isAuthenticated(req: http.IncomingMessage): boolean {
    const cookie = req.headers.cookie ?? '';
    for (const part of cookie.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === COOKIE && this.safeEqual(rest.join('='), this.token)) {
        return true;
      }
    }
    return false;
  }

  private handleLogin(req: http.IncomingMessage, res: http.ServerResponse): void {
    const ip = this.clientIp(req);
    const now = Date.now();
    const recent = (this.failedAttempts.get(ip) ?? []).filter((t) => now - t < ATTEMPT_WINDOW_MS);
    if (recent.length >= MAX_FAILED_ATTEMPTS) {
      res.writeHead(429, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(this.page('Too many attempts', 'Please wait a few minutes before trying again.'));
      return;
    }

    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > 4096) req.destroy();
    });
    req.on('end', () => {
      const passcode = new URLSearchParams(body).get('passcode') ?? '';
      if (this.options.passcode && this.safeEqual(passcode.trim(), this.options.passcode)) {
        this.failedAttempts.delete(ip);
        res.writeHead(302, { 'Set-Cookie': this.sessionCookie(), Location: '/', 'Cache-Control': 'no-store' });
        res.end();
        return;
      }
      recent.push(now);
      this.failedAttempts.set(ip, recent);
      this.sendLoginPage(req, res, 401, 'That passcode is not right. Ask the developer for the current one.');
    });
  }

  private sessionCookie(): string {
    return `${COOKIE}=${this.token}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  }

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
  }

  private sendLoginPage(req: http.IncomingMessage, res: http.ServerResponse, status: number, error?: string): void {
    const wantsHtml = (req.headers.accept ?? '').includes('text/html') || req.method === 'POST';
    if (!wantsHtml) {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('This preview is private.');
      return;
    }
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(
      this.page(
        'This preview is private',
        `${error ? `<p class="err">${error}</p>` : '<p>Enter the passcode the developer gave you.</p>'}
        <form method="POST" action="${LOGIN_PATH}">
          <input name="passcode" type="password" autocomplete="off" autofocus placeholder="Passcode" aria-label="Passcode" />
          <button type="submit">Open preview</button>
        </form>`
      )
    );
  }

  private page(title: string, body: string): string {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#0f1115;color:#e8e8ea;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}
main{max-width:360px;width:100%;background:#1a1d24;border:1px solid #2a2e38;border-radius:14px;padding:24px}h1{font-size:1.2rem;margin:0 0 8px}p{color:#a3a7b3;margin:0 0 16px}
.err{color:#ff8a80}input,button{width:100%;box-sizing:border-box;padding:12px;border-radius:10px;font-size:1rem}input{border:1px solid #3a3f4b;background:#0f1115;color:#fff;margin-bottom:10px}
button{border:0;background:#0a6fe0;color:#fff;font-weight:600}small{display:block;margin-top:16px;color:#6c7080}</style></head>
<body><main><h1>🔒 ${title}</h1>${body}<small>Shared with LaunchWizard</small></main></body></html>`;
  }

  // --- Visitor log ----------------------------------------------------------------

  private recordVisit(req: http.IncomingMessage): void {
    if (!this.options.logVisitors || req.method !== 'GET') return;
    if (!(req.headers.accept ?? '').includes('text/html')) return;

    const entry: VisitorEntry = {
      at: Date.now(),
      ip: this.clientIp(req),
      device: LinkGuardProxy.deviceOf(req.headers['user-agent'] ?? ''),
      browser: LinkGuardProxy.browserOf(req.headers['user-agent'] ?? ''),
      path: (req.url ?? '/').split('?')[0],
    };
    this.log.unshift(entry);
    this.log = this.log.slice(0, this.options.maxLogEntries ?? 200);
    this.emit('visitor', entry);
  }

  private clientIp(req: http.IncomingMessage): string {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && cf) return cf;
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
    return req.socket.remoteAddress ?? 'unknown';
  }

  public static deviceOf(ua: string): VisitorDevice {
    if (!ua) return 'unknown';
    if (/bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|slack/i.test(ua)) return 'bot';
    if (/iPad|Tablet/i.test(ua)) return 'tablet';
    if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'phone';
    return 'desktop';
  }

  public static browserOf(ua: string): string {
    if (/Edg\//.test(ua)) return 'Edge';
    if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'Other';
  }
}
