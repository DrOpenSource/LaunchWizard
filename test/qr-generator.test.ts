import { describe, it, expect } from 'vitest';
import jsQR from 'jsqr';
import { QrGenerator } from '../src/core/QrGenerator.js';

/** Rasterizes the generator's own SVG output (white page, dark <rect> modules) into RGBA pixels. */
function rasterizeSvg(svg: string, size: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  const rectRe = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="#000000"\/>/g;
  for (const m of svg.matchAll(rectRe)) {
    const x0 = Math.floor(Number(m[1]));
    const y0 = Math.floor(Number(m[2]));
    const x1 = Math.min(size, Math.ceil(Number(m[1]) + Number(m[3])));
    const y1 = Math.min(size, Math.ceil(Number(m[2]) + Number(m[4])));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * size + x) * 4;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
      }
    }
  }
  return pixels;
}

function decode(svg: string, size: number): string | null {
  return jsQR(rasterizeSvg(svg, size), size, size)?.data ?? null;
}

describe('QrGenerator (real, scannable QR codes)', () => {
  const urls = [
    'https://launchwizard.taqnik.in',
    'https://purple-falcon-testing-123.trycloudflare.com',
    'https://smart-rabbit-99.loca.lt/preview?token=abc123&utm_source=qr&redirect=%2Fdashboard%2Fsettings%3Ftab%3Dbilling',
  ];

  for (const url of urls) {
    it(`decodes back to the exact text: ${url.slice(0, 40)}…`, () => {
      const size = 480;
      expect(decode(QrGenerator.generateSvg(url, size), size)).toBe(url);
    });
  }

  it('still decodes at the default size used by the sidebar', () => {
    const url = 'https://cool-app-preview.trycloudflare.com';
    // The default 200px rendering is small, so scan it at 2x the way a screen would be photographed.
    expect(decode(QrGenerator.generateSvg(url, 400), 400)).toBe(url);
  });

  it('uses a valid QR grid size (21 + 4 per version)', () => {
    const matrix = QrGenerator.generateMatrix('https://launchwizard.taqnik.in');
    expect((matrix.length - 21) % 4).toBe(0);
    expect(matrix.every((row) => row.length === matrix.length)).toBe(true);
  });

  it('leaves the required 4-module quiet zone around the code', () => {
    const size = 400;
    const svg = QrGenerator.generateSvg('https://launchwizard.taqnik.in', size);
    const modules = QrGenerator.generateMatrix('https://launchwizard.taqnik.in').length + 8;
    const xs = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="[\d.]+"/g)].map((m) => Number(m[1]));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual((size / modules) * 4 - 0.01);
  });

  it('renders dark modules on a light background by default (scanner-friendly)', () => {
    const svg = QrGenerator.generateSvg('hello');
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('fill="#ffffff"');
  });

  it('negative control: a code with its finder patterns erased does not decode', () => {
    const size = 480;
    const svg = QrGenerator.generateSvg('https://launchwizard.taqnik.in', size);
    const pixels = rasterizeSvg(svg, size);
    // Whiten the top-left finder pattern region.
    const cell = size / (QrGenerator.generateMatrix('https://launchwizard.taqnik.in').length + 8);
    for (let y = 0; y < cell * 12; y++) {
      for (let x = 0; x < cell * 12; x++) {
        const i = (y * size + x) * 4;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
      }
    }
    expect(jsQR(pixels, size, size)).toBeNull();
  });
});
