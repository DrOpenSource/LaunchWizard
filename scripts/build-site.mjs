import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');

console.log('🚀 Preparing public/ directory for Cloudflare deployment...');

// Recreate public directory
if (fs.existsSync(publicDir)) {
  fs.rmSync(publicDir, { recursive: true, force: true });
}
fs.mkdirSync(publicDir, { recursive: true });

// Copy static site files
const filesToCopy = [
  'index.html',
  'privacy.html',
  'eula.html',
  'EULA.md',
  'PRIVACY.md',
  'LICENSE'
];

for (const file of filesToCopy) {
  const src = path.join(rootDir, file);
  const dest = path.join(publicDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  ✓ Copied ${file}`);
  }
}

// Copy only the current release package (never stray experiment or old builds)
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const currentVsix = `${pkg.name}-${pkg.version}.vsix`;
if (fs.existsSync(path.join(rootDir, currentVsix))) {
  fs.copyFileSync(path.join(rootDir, currentVsix), path.join(publicDir, currentVsix));
  console.log(`  ✓ Copied ${currentVsix}`);
} else {
  console.warn(`  ⚠ ${currentVsix} not found; the download link on the site will 404`);
}

// Copy assets folder (Gumroad marketing images are not part of the site)
const srcAssets = path.join(rootDir, 'assets');
const destAssets = path.join(publicDir, 'assets');
if (fs.existsSync(srcAssets)) {
  fs.cpSync(srcAssets, destAssets, {
    recursive: true,
    filter: (src) => !path.basename(src).startsWith('gumroad'),
  });
  console.log('  ✓ Copied assets/');
}

console.log('✅ public/ directory ready for Cloudflare deployment (launchwizard.taqnik.in)!');
