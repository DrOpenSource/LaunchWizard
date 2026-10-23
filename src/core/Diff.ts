/**
 * Minimal line-based unified diff (LCS) for previewing auto-heal patches.
 * Files above MAX_LINES fall back to a single whole-file hunk to keep memory bounded.
 */
export class Diff {
  private static readonly MAX_LINES = 4000;

  /**
   * The smallest single replacement that turns `original` into `modified`
   * (common prefix and suffix are kept), so editors keep cursor and scroll position.
   */
  public static minimalReplace(original: string, modified: string): { start: number; end: number; text: string } {
    let start = 0;
    const maxStart = Math.min(original.length, modified.length);
    while (start < maxStart && original[start] === modified[start]) start++;
    let endOrig = original.length;
    let endMod = modified.length;
    while (endOrig > start && endMod > start && original[endOrig - 1] === modified[endMod - 1]) {
      endOrig--;
      endMod--;
    }
    return { start, end: endOrig, text: modified.slice(start, endMod) };
  }

  public static unified(original: string, modified: string, fileName: string, context = 3): string {
    const a = original.split(/\r?\n/);
    const b = modified.split(/\r?\n/);
    const header = [`--- a/${fileName}`, `+++ b/${fileName}`];

    if (original === modified) {
      return header.join('\n');
    }

    if (a.length > this.MAX_LINES || b.length > this.MAX_LINES) {
      return [
        ...header,
        `@@ -1,${a.length} +1,${b.length} @@`,
        ...a.map((l) => `-${l}`),
        ...b.map((l) => `+${l}`),
      ].join('\n');
    }

    const ops = this.lineOps(a, b);
    return [...header, ...this.toHunks(ops, context)].join('\n');
  }

  private static lineOps(a: string[], b: string[]): Array<{ kind: ' ' | '-' | '+'; text: string; aLine: number; bLine: number }> {
    const n = a.length;
    const m = b.length;
    // lcs[i][j] = LCS length of a[i..] and b[j..]
    const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }

    const ops: Array<{ kind: ' ' | '-' | '+'; text: string; aLine: number; bLine: number }> = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        ops.push({ kind: ' ', text: a[i], aLine: i + 1, bLine: j + 1 });
        i++;
        j++;
      } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
        ops.push({ kind: '-', text: a[i], aLine: i + 1, bLine: j + 1 });
        i++;
      } else {
        ops.push({ kind: '+', text: b[j], aLine: i + 1, bLine: j + 1 });
        j++;
      }
    }
    while (i < n) {
      ops.push({ kind: '-', text: a[i], aLine: i + 1, bLine: j + 1 });
      i++;
    }
    while (j < m) {
      ops.push({ kind: '+', text: b[j], aLine: i + 1, bLine: j + 1 });
      j++;
    }
    return ops;
  }

  private static toHunks(
    ops: Array<{ kind: ' ' | '-' | '+'; text: string; aLine: number; bLine: number }>,
    context: number
  ): string[] {
    const lines: string[] = [];
    const changed = ops.map((op, idx) => (op.kind !== ' ' ? idx : -1)).filter((idx) => idx >= 0);
    let cursor = 0;

    while (cursor < changed.length) {
      const start = Math.max(0, changed[cursor] - context);
      let end = Math.min(ops.length - 1, changed[cursor] + context);
      while (cursor + 1 < changed.length && changed[cursor + 1] - context <= end + 1) {
        cursor++;
        end = Math.min(ops.length - 1, changed[cursor] + context);
      }

      const slice = ops.slice(start, end + 1);
      const aStart = slice[0].aLine;
      const bStart = slice[0].bLine;
      const aCount = slice.filter((op) => op.kind !== '+').length;
      const bCount = slice.filter((op) => op.kind !== '-').length;
      lines.push(`@@ -${aStart},${aCount} +${bStart},${bCount} @@`);
      for (const op of slice) {
        lines.push(`${op.kind}${op.text}`);
      }
      cursor++;
    }
    return lines;
  }
}
