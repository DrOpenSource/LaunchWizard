import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import type { PreFlightError, SupportedFramework } from '../shared/types.js';

export interface BundleSnapshot {
  at: number;
  outputDir: string;
  fileCount: number;
  totalBytes: number;
  jsBytes: number;
  jsGzipBytes: number;
  cssBytes: number;
  largest: Array<{ file: string; gzipBytes: number }>;
}

export interface BundleComparison {
  snapshot: BundleSnapshot;
  previous?: BundleSnapshot;
  growthPct?: number;
  overBudget: boolean;
  findings: PreFlightError[];
  summary: string;
}

/** Client-side output folders per framework (what visitors actually download). */
const OUTPUT_DIRS: Record<SupportedFramework, string[]> = {
  nextjs: ['.next/static', 'out'],
  vite: ['dist'],
  astro: ['dist'],
  sveltekit: ['.svelte-kit/output/client', 'build'],
  nuxt: ['.output/public', 'dist'],
  remix: ['build/client', 'public/build'],
  cra: ['build'],
  'vanilla-ts': ['dist', 'build', 'out'],
  unknown: ['dist', 'build', 'out'],
};

export const formatKb = (bytes: number): string => `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;

/**
 * Pro "Bundle Size Budget": measures what the browser downloads after a build and compares
 * it with the previous build and a budget. Local only.
 */
export class BundleAnalyzer {
  public static outputDirFor(projectRoot: string, framework: SupportedFramework): string | null {
    for (const dir of OUTPUT_DIRS[framework]) {
      if (fs.existsSync(path.join(projectRoot, dir))) return dir;
    }
    return null;
  }

  public static measure(projectRoot: string, framework: SupportedFramework, now = Date.now()): BundleSnapshot | null {
    const outputDir = this.outputDirFor(projectRoot, framework);
    if (!outputDir) return null;

    const files: string[] = [];
    this.collect(path.join(projectRoot, outputDir), files);
    const snapshot: BundleSnapshot = { at: now, outputDir, fileCount: 0, totalBytes: 0, jsBytes: 0, jsGzipBytes: 0, cssBytes: 0, largest: [] };
    const jsSizes: Array<{ file: string; gzipBytes: number }> = [];

    for (const file of files) {
      if (file.endsWith('.map')) continue;
      let size: number;
      try {
        size = fs.statSync(file).size;
      } catch {
        continue;
      }
      snapshot.fileCount++;
      snapshot.totalBytes += size;
      if (/\.(m?js|cjs)$/.test(file)) {
        snapshot.jsBytes += size;
        const gz = zlib.gzipSync(fs.readFileSync(file), { level: 6 }).length;
        snapshot.jsGzipBytes += gz;
        jsSizes.push({ file: path.relative(projectRoot, file).replace(/\\/g, '/'), gzipBytes: gz });
      } else if (file.endsWith('.css')) {
        snapshot.cssBytes += size;
      }
    }
    snapshot.largest = jsSizes.sort((a, b) => b.gzipBytes - a.gzipBytes).slice(0, 5);
    return snapshot;
  }

  /**
   * Compares with the previous build. Warns on >= 20% growth of gzipped JS, and on a budget overrun
   * (budgetKb = 0 disables the budget).
   */
  public static compare(snapshot: BundleSnapshot, previous: BundleSnapshot | undefined, budgetKb: number): BundleComparison {
    const findings: PreFlightError[] = [];
    let growthPct: number | undefined;
    if (previous && previous.jsGzipBytes > 0) {
      growthPct = ((snapshot.jsGzipBytes - previous.jsGzipBytes) / previous.jsGzipBytes) * 100;
      if (growthPct >= 20) {
        findings.push({
          file: snapshot.outputDir,
          line: 1,
          column: 1,
          code: 'BUNDLE_GROWTH',
          rawMessage: `Your JavaScript grew ${growthPct.toFixed(0)}% since the last build (${formatKb(previous.jsGzipBytes)} → ${formatKb(snapshot.jsGzipBytes)} gzipped). Biggest file now: ${snapshot.largest[0]?.file ?? 'n/a'}.`,
          severity: 'warning',
        });
      }
    }

    const overBudget = budgetKb > 0 && snapshot.jsGzipBytes > budgetKb * 1024;
    if (overBudget) {
      findings.push({
        file: snapshot.outputDir,
        line: 1,
        column: 1,
        code: 'BUNDLE_OVER_BUDGET',
        rawMessage: `Visitors download ${formatKb(snapshot.jsGzipBytes)} of gzipped JavaScript, over your ${budgetKb} KB budget. Large bundles load slowly on phones.`,
        severity: 'warning',
      });
    }

    const parts = [`${formatKb(snapshot.jsGzipBytes)} of JavaScript (gzipped) across ${snapshot.fileCount} files`];
    if (growthPct !== undefined) parts.push(`${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(0)}% vs last build`);
    if (budgetKb > 0) parts.push(overBudget ? `over the ${budgetKb} KB budget` : `within the ${budgetKb} KB budget`);
    return { snapshot, previous, growthPct, overBudget, findings, summary: parts.join(', ') + '.' };
  }

  private static collect(dir: string, out: string[], depth = 0): void {
    if (depth > 12 || out.length > 20000) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) this.collect(full, out, depth + 1);
      else out.push(full);
    }
  }
}
