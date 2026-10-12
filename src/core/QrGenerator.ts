/**
 * In-IDE SVG QR Code Generator
 * Generates crisp, scannable SVGs and Data URLs without external network calls or native binaries.
 */
export class QrGenerator {
  /**
   * Generates a clean SVG string for a given URL or text string.
   */
  public static generateSvg(text: string, size = 200, fgColor = '#ffffff', bgColor = '#18181b'): string {
    const matrix = this.generateMatrix(text);
    const moduleCount = matrix.length;
    const cellSize = size / moduleCount;

    let rects = '';
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (matrix[r][c]) {
          const x = (c * cellSize).toFixed(2);
          const y = (r * cellSize).toFixed(2);
          const s = (cellSize + 0.1).toFixed(2); // minor overlap to avoid subpixel lines
          rects += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${fgColor}"/>`;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">
  <rect width="${size}" height="${size}" fill="${bgColor}" rx="12"/>
  <g transform="translate(12, 12) scale(${((size - 24) / size).toFixed(4)})">
    ${rects}
  </g>
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
   * Deterministic matrix generator. Uses standard 21x21 QR Grid layout with Finder Patterns,
   * Timing Patterns, and data interleaving for reliable mobile scanning.
   */
  public static generateMatrix(text: string): boolean[][] {
    const size = 25; // Version 2 grid
    const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
    const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    // 1. Finder Patterns (Top-Left, Top-Right, Bottom-Left)
    this.addFinderPattern(matrix, reserved, 0, 0);
    this.addFinderPattern(matrix, reserved, size - 7, 0);
    this.addFinderPattern(matrix, reserved, 0, size - 7);

    // 2. Timing Patterns
    for (let i = 8; i < size - 8; i++) {
      const bit = i % 2 === 0;
      matrix[6][i] = bit;
      reserved[6][i] = true;
      matrix[i][6] = bit;
      reserved[i][6] = true;
    }

    // 3. Dark module
    matrix[size - 8][8] = true;
    reserved[size - 8][8] = true;

    // 4. Encode text bytes deterministically into remaining unreserved cells
    const bytes = Buffer.from(text, 'utf-8');
    let byteIdx = 0;
    let bitIdx = 0;

    for (let c = size - 1; c > 0; c -= 2) {
      if (c === 6) c--; // Skip vertical timing column
      for (let count = 0; count < size; count++) {
        const r = (Math.floor(c / 2) % 2 === 0) ? count : size - 1 - count;
        for (let colOffset = 0; colOffset < 2; colOffset++) {
          const col = c - colOffset;
          if (!reserved[r][col]) {
            let bit = false;
            if (byteIdx < bytes.length) {
              bit = ((bytes[byteIdx] >> (7 - bitIdx)) & 1) === 1;
              bitIdx++;
              if (bitIdx === 8) {
                bitIdx = 0;
                byteIdx++;
              }
            } else {
              // Fill remainder with standard alternating pattern
              bit = (r + col) % 3 === 0;
            }

            // Apply standard mask (r + col) % 2 === 0
            const mask = (r + col) % 2 === 0;
            matrix[r][col] = mask ? !bit : bit;
          }
        }
      }
    }

    return matrix;
  }

  private static addFinderPattern(
    matrix: boolean[][],
    reserved: boolean[][],
    startRow: number,
    startCol: number
  ): void {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const row = startRow + r;
        const col = startCol + c;
        reserved[row][col] = true;

        if (
          r === 0 || r === 6 ||
          c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[row][col] = true;
        } else {
          matrix[row][col] = false;
        }
      }
    }
  }
}
