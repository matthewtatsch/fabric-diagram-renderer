#!/usr/bin/env node
/**
 * CLI entrypoint for fabric-diagram-renderer.
 * Dispatches subcommands: render, generate-icons, init
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const [subcommand, ...rest] = process.argv.slice(2);

function usage() {
  console.log(`
fabric-diagram — Render Mermaid diagrams with Microsoft Fabric styling

Commands:
  render <file.mmd> [output.svg] [--dark|--light|--both]
      Render a .mmd file to styled SVG(s)

  generate-icons
      Rebuild icon data from @fabric-msft/svg-icons (run after npm install)

  init
      Copy a starter .mmd template to the current directory

Usage:
  fabric-diagram render architecture.mmd --both
  fabric-diagram render architecture.mmd output.svg --dark
  fabric-diagram init
`);
}

const tsxBin = path.join(__dirname, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

switch (subcommand) {
  case 'render': {
    const script = path.join(__dirname, 'render.ts');
    execSync(`"${tsxBin}" "${script}" ${rest.map(a => `"${a}"`).join(' ')}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    break;
  }
  case 'generate-icons': {
    const script = path.join(__dirname, 'generate-icons.ts');
    execSync(`"${tsxBin}" "${script}"`, { stdio: 'inherit', cwd: __dirname });
    break;
  }
  case 'init': {
    const template = path.join(__dirname, 'template.mmd');
    const dest = path.join(process.cwd(), 'architecture.mmd');
    const fs = await import('fs');
    if (fs.existsSync(dest)) {
      console.error(`❌ ${dest} already exists`);
      process.exit(1);
    }
    fs.copyFileSync(template, dest);
    console.log(`✅ Created architecture.mmd`);
    break;
  }
  default:
    usage();
    if (subcommand && subcommand !== '--help' && subcommand !== '-h') {
      process.exit(1);
    }
}
