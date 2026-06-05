#!/usr/bin/env node
/**
 * render.ts — Render Mermaid diagrams with Fabric styling to SVG.
 *
 * Usage:
 *   npx tsx render.ts <input.mmd> [output.svg]
 *   npx tsx render.ts <input.mmd> --dark       # render dark theme
 *   npx tsx render.ts <input.mmd> --both       # render both light and dark
 *
 * The input file should contain a Mermaid flowchart definition using
 * :::ClassName annotations for Fabric item types.
 *
 * Adapted from microsoft/fabric-jumpstart (MIT license).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import * as ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── CLI args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

if (positional.length === 0) {
  console.log(`
Usage:
  npx tsx render.ts <input.mmd> [output.svg]

Options:
  --dark     Render dark theme only
  --both     Render both light (_light.svg) and dark (_dark.svg)
  --light    Render light theme only (default)

Example:
  npx tsx render.ts my-diagram.mmd
  npx tsx render.ts my-diagram.mmd output.svg --dark
  npx tsx render.ts my-diagram.mmd --both
`);
  process.exit(0);
}

const inputFile = path.resolve(positional[0]);
const hasBoth = flags.includes('--both');
const isDarkOnly = flags.includes('--dark');

if (!fs.existsSync(inputFile)) {
  console.error(`❌ File not found: ${inputFile}`);
  process.exit(1);
}

const chart = fs.readFileSync(inputFile, 'utf8');
const baseName = path.basename(inputFile, path.extname(inputFile));
const outDir = path.dirname(positional[1] ? path.resolve(positional[1]) : inputFile);

// ── Load data ────────────────────────────────────────────────────────────
const iconsPath = path.join(__dirname, 'data', 'fabric-item-icons.json');
if (!fs.existsSync(iconsPath)) {
  console.error('❌ Icon data not found. Run: npx tsx generate-icons.ts');
  process.exit(1);
}

const itemIcons = JSON.parse(fs.readFileSync(iconsPath, 'utf8'));

import { ITEM_DISPLAY_NAMES } from './fabric-items.js';

// ── Transpile enhance.ts for browser injection ───────────────────────────
const enhanceSrc = fs.readFileSync(path.join(__dirname, 'enhance.ts'), 'utf8');
const strippedTs = enhanceSrc
  .replace(/^import\s+.*;\s*$/gm, '')
  .replace(/^export\s+/gm, '')
  .replace(/^declare\s+const\s+.*;\s*$/gm, '');

const { outputText: enhanceScript } = ts.transpileModule(strippedTs, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.None,
    removeComments: false,
    strict: false,
  },
});

// ── Render ───────────────────────────────────────────────────────────────
interface RenderJob {
  isDark: boolean;
  outFile: string;
}

function buildJobs(): RenderJob[] {
  if (hasBoth) {
    return [
      { isDark: false, outFile: path.join(outDir, `${baseName}_light.svg`) },
      { isDark: true, outFile: path.join(outDir, `${baseName}_dark.svg`) },
    ];
  }
  const dark = isDarkOnly;
  const suffix = positional[1] ? '' : (dark ? '_dark' : '_light');
  const outFile = positional[1]
    ? path.resolve(positional[1])
    : path.join(outDir, `${baseName}${suffix}.svg`);
  return [{ isDark: dark, outFile }];
}

async function main(): Promise<void> {
  const jobs = buildJobs();

  console.log(`🎨 Rendering ${inputFile}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();

  // Load Mermaid
  const mermaidJs = fs.readFileSync(
    path.join(__dirname, 'node_modules/mermaid/dist/mermaid.min.js'),
    'utf8'
  );

  await page.setContent(`<!DOCTYPE html>
    <html><head><style>body{margin:0;padding:0;}</style></head>
    <body><div id="container"></div></body></html>`);

  await page.evaluate(mermaidJs);

  // Inject enhance dependencies and script
  await page.evaluate(
    (icons: Record<string, string>, displayNames: Record<string, string>, enhScript: string) => {
      (window as Record<string, unknown>).itemIcons = icons;
      (window as Record<string, unknown>).itemDisplayNames = displayNames;

      const script = document.createElement('script');
      script.textContent = `
        const itemIcons = window.itemIcons;
        const itemDisplayNames = window.itemDisplayNames;
        ${enhScript}
        window.enhanceDiagram = enhanceDiagram;
      `;
      document.head.appendChild(script);
    },
    itemIcons,
    ITEM_DISPLAY_NAMES,
    enhanceScript
  );

  for (const job of jobs) {
    try {
      const svg = await page.evaluate(
        async (chartSrc: string, dark: boolean) => {
          const mermaid = (window as Record<string, unknown>).mermaid as {
            initialize: (cfg: Record<string, unknown>) => void;
            render: (id: string, chart: string) => Promise<{ svg: string }>;
          };
          const enhance = (window as { enhanceDiagram?: (root: SVGSVGElement, chart: string, isDark: boolean) => void }).enhanceDiagram;

          mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            themeVariables: {
              primaryColor: dark ? '#2a2a32' : '#f5f8fa',
              primaryTextColor: dark ? '#e0e0e0' : '#242424',
              primaryBorderColor: dark ? '#4a4a55' : '#c8c8c8',
              lineColor: dark ? '#5a8a9a' : '#219580',
              fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: '13px',
            },
            flowchart: {
              useMaxWidth: false,
              htmlLabels: true,
              curve: 'basis',
              padding: 22,
              nodeSpacing: 70,
              rankSpacing: 85,
            },
          });

          const id = `diagram-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const container = document.getElementById('container')!;
          // Strip :::Type from subgraph lines (Mermaid doesn't support it natively)
          const mermaidChart = chartSrc.replace(/^(\s*subgraph\s+.+?):::(\w+)\s*$/gm, '$1');
          const { svg } = await mermaid.render(id, mermaidChart);
          container.innerHTML = svg;

          const svgEl = container.querySelector('svg') as SVGSVGElement;
          if (svgEl && enhance) {
            enhance(svgEl, chartSrc, dark);
          }

          return container.innerHTML;
        },
        chart,
        job.isDark
      );

      fs.writeFileSync(job.outFile, svg);
      console.log(`  ✓ ${path.relative(process.cwd(), job.outFile)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
      console.error(`  ✗ ${job.outFile}: ${msg}`);
    }
  }

  await browser.close();
  console.log('✅ Done');
}

main();
