import { defineConfig } from 'tsup';

export default defineConfig([
  // Library build
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: false,
    outDir: 'dist',
    tsconfig: './tsconfig.build.json',
  },
  // CLI build
  {
    entry: ['src/cli/index.ts'],
    format: ['esm'],
    dts: false,
    splitting: false,
    sourcemap: false,
    treeshake: true,
    minify: false,
    outDir: 'dist/cli',
    tsconfig: './tsconfig.build.json',
    shims: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
