import type { PreFlightReport, TranslatedError } from '../shared/types.js';
import type { GitSnapshot } from './GitInfo.js';

export interface PreviewCardInput {
  projectName: string;
  url: string;
  git: GitSnapshot;
  report?: PreFlightReport | null;
  isProtected?: boolean;
  passcode?: string;
  expiresAt?: number;
  extraLinks?: Array<{ label: string; url: string }>;
  now?: number;
}

export interface ReportExportInput {
  projectName: string;
  report: PreFlightReport;
  translated: TranslatedError[];
  git: GitSnapshot;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Pro "Team Preview Cards" and "Shareable Pre-Flight Report": text you paste into Slack,
 * a pull request, or an email. Generated locally; nothing is uploaded.
 */
export class ShareCards {
  public static buildStatus(report?: PreFlightReport | null): string {
    if (!report) return 'Not checked yet';
    if (report.passed) {
      return report.warnings.length ? `Passing, ${report.warnings.length} advisory warning(s)` : 'Passing';
    }
    return `${report.errors.length} build blocker(s)`;
  }

  private static expiryText(expiresAt?: number, now = Date.now()): string | null {
    if (!expiresAt) return null;
    const minutes = Math.max(0, Math.round((expiresAt - now) / 60000));
    return minutes >= 60 ? `in ${Math.floor(minutes / 60)} h ${minutes % 60} min` : `in ${minutes} min`;
  }

  /** GitHub / Notion / Discord flavoured Markdown. */
  public static previewCardMarkdown(input: PreviewCardInput): string {
    const lines = [`### 🚀 ${input.projectName}: live preview`, '', `**Open:** ${input.url}`];
    for (const extra of input.extraLinks ?? []) {
      lines.push(`**${extra.label}:** ${extra.url}`);
    }
    if (input.isProtected && input.passcode) {
      lines.push(`**Passcode:** \`${input.passcode}\` (not needed if you use the link above)`);
    }
    const branch = input.git.branch ? `\`${input.git.branch}\`` : null;
    const commit = input.git.commit ? `\`${input.git.commit}\`${input.git.commitMessage ? ` ${input.git.commitMessage}` : ''}` : null;
    if (branch) lines.push(`**Branch:** ${branch}${input.git.dirty ? ' (with uncommitted changes)' : ''}`);
    if (commit) lines.push(`**Commit:** ${commit}`);
    lines.push(`**Build check:** ${this.buildStatus(input.report)}`);
    const expiry = this.expiryText(input.expiresAt, input.now);
    lines.push(expiry ? `**Link expires:** ${expiry}` : '**Link:** temporary, stops when the developer closes it');
    lines.push('', '_Shared with LaunchWizard. Scan the attached QR code to open it on a phone._');
    return lines.join('\n');
  }

  /** Slack "mrkdwn" flavour (single asterisks, <url|text> links). */
  public static previewCardSlack(input: PreviewCardInput): string {
    const lines = [`*🚀 ${input.projectName}: live preview*`, `*Open:* <${input.url}|${input.url.replace(/\?.*$/, '')}>`];
    for (const extra of input.extraLinks ?? []) {
      lines.push(`*${extra.label}:* <${extra.url}>`);
    }
    if (input.isProtected && input.passcode) lines.push(`*Passcode:* \`${input.passcode}\``);
    if (input.git.branch) lines.push(`*Branch:* \`${input.git.branch}\`${input.git.commit ? ` @ \`${input.git.commit}\`` : ''}`);
    lines.push(`*Build check:* ${this.buildStatus(input.report)}`);
    const expiry = this.expiryText(input.expiresAt, input.now);
    if (expiry) lines.push(`*Link expires:* ${expiry}`);
    return lines.join('\n');
  }

  public static reportMarkdown(input: ReportExportInput): string {
    const { report } = input;
    const when = new Date(report.timestamp).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    const lines = [
      `## Pre-flight report: ${input.projectName}`,
      '',
      `**Result:** ${report.passed ? '✅ Ready to ship' : `🚨 ${report.errors.length} build blocker(s)`}  `,
      `**Framework:** ${report.frameworkName} · **Checked:** ${when} · **Took:** ${(report.durationMs / 1000).toFixed(1)} s  `,
    ];
    if (input.git.branch) {
      lines.push(`**Branch:** \`${input.git.branch}\`${input.git.commit ? ` @ \`${input.git.commit}\`` : ''}${input.git.dirty ? ' (uncommitted changes)' : ''}`);
    }
    lines.push('');

    if (input.translated.length > 0) {
      lines.push('| | Problem | Where | What to do |', '| --- | --- | --- | --- |');
      for (const card of input.translated) {
        const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
        lines.push(`| ${card.badge} | **${cell(card.friendlyTitle)}**: ${cell(card.original.rawMessage)} | \`${card.original.file}:${card.original.line}\` | ${cell(card.actionPrompt)} |`);
      }
      lines.push('');
    }
    if (report.warnings.length > 0) {
      lines.push(`<details><summary>${report.warnings.length} advisory warning(s)</summary>`, '');
      for (const w of report.warnings) {
        lines.push(`- \`${w.file}:${w.line}\` ${w.rawMessage}`);
      }
      lines.push('', '</details>', '');
    }
    lines.push('_Generated by [LaunchWizard](https://launchwizard.taqnik.in)._');
    return lines.join('\n');
  }

  public static reportHtml(input: ReportExportInput): string {
    const { report } = input;
    const rows = input.translated
      .map(
        (c) => `<tr><td>${escapeHtml(c.badge)}</td><td><strong>${escapeHtml(c.friendlyTitle)}</strong><br>${escapeHtml(c.original.rawMessage)}</td><td><code>${escapeHtml(`${c.original.file}:${c.original.line}`)}</code></td><td>${escapeHtml(c.actionPrompt)}</td></tr>`
      )
      .join('\n');
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pre-flight report: ${escapeHtml(input.projectName)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:960px;margin:32px auto;padding:0 16px;color:#1d1d1f;background:#fff}
h1{font-size:1.4rem}.ok{color:#1a7f37}.bad{color:#c62828}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;vertical-align:top;text-align:left;font-size:.9rem}
th{background:#f5f5f7}code{font-size:.85rem}footer{margin-top:24px;color:#6e6e73;font-size:.8rem}</style></head>
<body><h1>Pre-flight report: ${escapeHtml(input.projectName)}</h1>
<p class="${report.passed ? 'ok' : 'bad'}"><strong>${report.passed ? '✅ Ready to ship' : `🚨 ${report.errors.length} build blocker(s)`}</strong></p>
<p>${escapeHtml(report.frameworkName)} · ${escapeHtml(new Date(report.timestamp).toUTCString())}${input.git.branch ? ` · branch <code>${escapeHtml(input.git.branch)}</code>` : ''}${input.git.commit ? ` @ <code>${escapeHtml(input.git.commit)}</code>` : ''}</p>
${rows ? `<table><thead><tr><th></th><th>Problem</th><th>Where</th><th>What to do</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>No build blockers found.</p>'}
<footer>Generated by LaunchWizard</footer></body></html>`;
  }
}
