#!/usr/bin/env tsx
/**
 * Build script for MCP Eval Reporter UI
 *
 * Compiles React + TypeScript to standalone JS bundle
 * Processes Tailwind CSS
 * Copies HTML template
 */

import * as esbuild from 'esbuild';
import { execSync } from 'child_process';
import { mkdirSync, copyFileSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UI_SRC = join(__dirname, 'ui-src');
const UI_DIST = join(__dirname, 'ui-dist');

async function build() {
  console.log('🎭 Building MCP Eval Reporter UI...\n');

  // Clean dist directory
  if (existsSync(UI_DIST)) {
    console.log('🧹 Cleaning ui-dist/');
    rmSync(UI_DIST, { recursive: true });
  }

  // Create dist directory
  mkdirSync(UI_DIST, { recursive: true });

  // Step 1: Bundle React app with esbuild
  console.log('⚛️  Compiling React + TypeScript...');
  await esbuild.build({
    entryPoints: [join(UI_SRC, 'App.tsx')],
    bundle: true,
    outfile: join(UI_DIST, 'app.js'),
    format: 'iife',
    globalName: 'MCPEvalApp',
    minify: true,
    sourcemap: false,
    target: ['es2020'],
    jsx: 'automatic',
    jsxImportSource: 'react',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });
  console.log('✅ React app compiled\n');

  // Step 2: Process Tailwind CSS
  console.log('🎨 Processing Tailwind CSS...');
  try {
    execSync(
      `npx tailwindcss -i ${join(UI_SRC, 'styles.css')} -o ${join(UI_DIST, 'styles.css')} --minify`,
      { stdio: 'inherit' }
    );
    console.log('✅ Tailwind CSS processed\n');
  } catch (error) {
    console.error('❌ Tailwind CSS processing failed:', error);
    process.exit(1);
  }

  // Step 3: Copy HTML template
  console.log('📄 Copying HTML template...');
  copyFileSync(join(UI_SRC, 'index.html'), join(UI_DIST, 'index.html'));
  console.log('✅ HTML template copied\n');

  console.log('🎉 Build complete!');
  console.log(`📦 Output: ${UI_DIST}\n`);
}

build().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
