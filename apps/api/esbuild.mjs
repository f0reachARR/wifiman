// esbuild.mjs - Production build script
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outdir: 'dist',
  external: ['postgres', 'nodemailer'],
  sourcemap: true,
});
