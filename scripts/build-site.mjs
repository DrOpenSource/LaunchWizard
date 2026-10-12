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
  'LICENSE',
  'shipwizard-0.1.0.vsix'
];

for (const file of filesToCopy) {
  const src = path.join(rootDir, file);
  const dest = path.join(publicDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  ✓ Copied ${file}`);
  }
}

// Copy assets folder
const srcAssets = path.join(rootDir, 'assets');
const destAssets = path.join(publicDir, 'assets');
if (fs.existsSync(srcAssets)) {
  fs.cpSync(srcAssets, destAssets, { recursive: true });
  console.log('  ✓ Copied assets/');
}

console.log('✅ public/ directory ready for Cloudflare deployment (shipwizard.taqnik.in)!');
