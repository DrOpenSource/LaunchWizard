/**
 * Stand-alone pre-flight checker used by the Pre-Push Gate git hook.
 * Bundled to dist/cli.js (core only, no VS Code APIs) and copied into .git/launchwizard/.
 *
 *   node preflight.cjs --root <project> [--hook] [--timeout <seconds>]
 *
 * Exit codes: 0 = clean (or the check could not run: fail open), 1 = build blockers found.
 */
import { PreFlightEngine } from '../core/PreFlightEngine.js';
import { ErrorTranslator } from '../core/ErrorTranslator.js';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main(): Promise<number> {
  const root = arg('--root') ?? process.cwd();
  const hookMode = process.argv.includes('--hook');
  const timeoutSeconds = Number(arg('--timeout') ?? 120);

  process.stdout.write('🚀 LaunchWizard pre-flight check...\n');
  const report = await PreFlightEngine.run({ projectRoot: root, timeoutMs: timeoutSeconds * 1000 });

  if (report.passed) {
    process.stdout.write(`✅ ${report.summaryText}\n`);
    return 0;
  }

  process.stdout.write(`\n🚨 ${report.summaryText}\n\n`);
  for (const card of ErrorTranslator.translateBatch(report.errors).slice(0, 15)) {
    const where = `${card.original.file}:${card.original.line}`;
    process.stdout.write(`  ${card.badge}  ${card.friendlyTitle}  (${where})\n`);
    process.stdout.write(`     ${card.original.rawMessage}\n`);
    process.stdout.write(`     → ${card.actionPrompt}\n\n`);
  }
  if (report.errors.length > 15) {
    process.stdout.write(`  …and ${report.errors.length - 15} more. Open the LaunchWizard sidebar for the full list.\n\n`);
  }
  if (hookMode) {
    process.stdout.write('Push stopped by LaunchWizard Pre-Push Gate. Fix the blockers above, or push anyway with: git push --no-verify\n');
  }
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    // Never block a push because the checker itself crashed.
    process.stderr.write(`LaunchWizard: pre-flight check could not run (${err instanceof Error ? err.message : String(err)}). Allowing the push.\n`);
    process.exit(0);
  });
