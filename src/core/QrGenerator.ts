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
