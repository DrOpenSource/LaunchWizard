import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ['src/extension/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  minify: !watch,
  logLevel: 'info',
};

/** Stand-alone checker for the Pre-Push Gate git hook (core only, no VS Code APIs). */
const cliOptions = {
  ...buildOptions,
  entryPoints: ['src/cli/preflight.ts'],
  outfile: 'dist/cli.js',
  external: [],
  sourcemap: false,
};

async function main() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    const cliCtx = await esbuild.context(cliOptions);
    await Promise.all([ctx.watch(), cliCtx.watch()]);
    console.log('Watching for changes...');
  } else {
    await Promise.all([esbuild.build(buildOptions), esbuild.build(cliOptions)]);
    console.log('Build complete.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
