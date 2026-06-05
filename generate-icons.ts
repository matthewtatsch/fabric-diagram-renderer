/**
 * generate-icons.ts
 * Reads SVG icons from @fabric-msft/svg-icons and generates a JSON file
 * with base64-encoded data URIs for each Fabric item type.
 *
 * Run: npx tsx generate-icons.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { FABRIC_ITEM_ICON_MAP } from './fabric-items.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try both possible paths (varies by package version)
const distSvg = path.resolve(__dirname, 'node_modules/@fabric-msft/svg-icons/dist/svg');
const rootSvg = path.resolve(__dirname, 'node_modules/@fabric-msft/svg-icons/svg');
const iconsDir = fs.existsSync(distSvg) ? distSvg : rootSvg;

if (!fs.existsSync(iconsDir)) {
  console.error('❌ @fabric-msft/svg-icons not found. Run: npm install');
  process.exit(1);
}

const result: Record<string, string> = {};

for (const [itemType, svgFile] of Object.entries(FABRIC_ITEM_ICON_MAP)) {
  const svgPath = path.join(iconsDir, svgFile);
  if (fs.existsSync(svgPath)) {
    const b64 = fs.readFileSync(svgPath).toString('base64');
    result[itemType] = `data:image/svg+xml;base64,${b64}`;
  } else {
    console.warn(`  ⚠ Missing icon for ${itemType}: ${svgFile}`);
  }
}

const outPath = path.join(__dirname, 'data', 'fabric-item-icons.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`✅ Generated fabric-item-icons.json (${Object.keys(result).length} icons)`);
