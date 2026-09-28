import fs from 'fs';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

// Brand (see src/lib/brand.ts): the HTML title/meta and a couple of static
// files in public/ mention the organisation by name, so rewrite them for
// non-C9MYR builds.
const brandName = process.env.VITE_BRAND_NAME || 'C9MYR';
const brandKey = brandName.toUpperCase().startsWith('C6') ? 'c6' : 'c9';
const outDir = path.resolve(import.meta.dirname, 'dist/public');
const brandFiles = ['privacy.html', 'push-sw.js'];

function brand(): Plugin {
  return {
    name: 'brand',
    transformIndexHtml: (html) => html.replaceAll('C9MYR', brandName),
    closeBundle() {
      for (const file of ['favicon.ico', 'favicon-16.png', 'favicon-32.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
        fs.copyFileSync(path.join(outDir, 'brands', brandKey, file), path.join(outDir, file));
      }
      if (brandName === 'C9MYR') return;
      for (const file of brandFiles) {
        const target = path.join(outDir, file);
        if (fs.existsSync(target)) fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replaceAll('C9MYR', brandName));
      }
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    brand(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir,
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
