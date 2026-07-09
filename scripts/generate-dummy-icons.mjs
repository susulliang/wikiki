import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ICONS_DIR = path.join(ROOT, 'src-tauri', 'icons');

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

const icons = [
  '32x32.png',
  '128x128.png',
  '128x128@2x.png',
  'icon.icns',
  'icon.ico',
  'icon.png',
  'Square310x310Logo.png',
  'Square150x150Logo.png',
  'Square107x107Logo.png',
  'Square89x89Logo.png',
  'Square71x71Logo.png',
  'Square44x44Logo.png',
  'StoreLogo.png',
  'BadgeLogo.png'
];

// A 1x1 transparent PNG as a fallback
const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');

for (const icon of icons) {
  const iconPath = path.join(ICONS_DIR, icon);
  if (!fs.existsSync(iconPath) || fs.statSync(iconPath).size === 0) {
    // Create a dummy file if it doesn't exist or is empty
    fs.writeFileSync(iconPath, dummyPng);
    console.log(`Created dummy icon: ${icon}`);
  }
}
