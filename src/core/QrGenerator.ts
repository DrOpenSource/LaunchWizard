import * as zlib from 'node:zlib';
import qrcode from 'qrcode-generator';

/**
 * In-IDE SVG QR Code Generator
 * Produces standards-compliant QR codes (ISO/IEC 18004) that phone cameras can scan.
 * Runs fully offline: no network calls or native binaries.
 */
export class QrGenerator {
  /** Quiet zone (blank border) in modules. The QR spec requires 4 for reliable scanning. */
  private static readonly QUIET_ZONE = 4;

  /**
   * Generates a clean SVG string for a given URL or text string.
   * Default colours are dark-on-light: some phone scanners cannot read inverted codes.
   */
  public static generateSvg(text: string, size = 200, fgColor = '#000000', bgColor = '#ffffff'): string {
    const matrix = this.generateMatrix(text);
    const quiet = this.QUIET_ZONE;
    const totalModules = matrix.length + quiet * 2;
    const cellSize = size / totalModules;

    let rects = '';
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix.length; c++) {
        if (matrix[r][c]) {
          const x = ((c + quiet) * cellSize).toFixed(2);
          const y = ((r + quiet) * cellSize).toFixed(2);
          const s = (cellSize + 0.1).toFixed(2); // minor overlap to avoid subpixel lines
          rects += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${fgColor}"/>`;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">
  <rect width="${size}" height="${size}" fill="${bgColor}" rx="12"/>
  ${rects}
</svg>`;
  }

  /**
   * Generates a base64 data:image/svg+xml URI.
   */
  public static generateDataUrl(text: string, size = 200): string {
    const svg = this.generateSvg(text, size);
    const base64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  }

  /**
   * Generates a black-on-white PNG (for team preview cards: chat apps and email don't render SVG).
   * Encoded by hand with zlib so no image library is needed.
   */
  public static generatePng(text: string, scale = 8): Buffer {
    const matrix = this.generateMatrix(text);
    const quiet = this.QUIET_ZONE;
    const modules = matrix.length + quiet * 2;
    const size = modules * scale;

    // One filter byte (0 = none) per row, then 8-bit grayscale pixels.
    const raw = Buffer.alloc((size + 1) * size, 255);
    for (let y = 0; y < size; y++) {
      raw[y * (size + 1)] = 0;
      const r = Math.floor(y / scale) - quiet;
      for (let x = 0; x < size; x++) {
        const c = Math.floor(x / scale) - quiet;
        if (r >= 0 && c >= 0 && r < matrix.length && c < matrix.length && matrix[r][c]) {
          raw[y * (size + 1) + 1 + x] = 0;
        }
      }
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 0; // grayscale
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      this.pngChunk('IHDR', ihdr),
      this.pngChunk('IDAT', zlib.deflateSync(raw)),
      this.pngChunk('IEND', Buffer.alloc(0)),
    ]);
  }

  private static crcTable: Uint32Array | null = null;

  private static pngChunk(type: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(this.crc32(typeAndData), 0);
    return Buffer.concat([length, typeAndData, crc]);
  }

  private static crc32(buf: Buffer): number {
    if (!this.crcTable) {
      this.crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
          c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        this.crcTable[n] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (const byte of buf) {
      crc = this.crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  /**
   * Encodes text as a QR module matrix (true = dark module), without the quiet zone.
   * Uses automatic version selection and error correction level M (~15% recovery).
   */
  public static generateMatrix(text: string): boolean[][] {
    const qr = qrcode(0, 'M');
    qr.addData(text, 'Byte');
    qr.make();

    const count = qr.getModuleCount();
    const matrix: boolean[][] = [];
    for (let r = 0; r < count; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < count; c++) {
        row.push(qr.isDark(r, c));
      }
      matrix.push(row);
    }
    return matrix;
  }
}
