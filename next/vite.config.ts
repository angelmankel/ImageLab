import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// The next UI. Served from /imagelab/next/ on the pod (nginx try_files under lab/next/), so the base
// is relative like the main app's. `@` is the MAIN app's src (logic reuse: stores, comfy, civitai,
// FullscreenImage…), `~` is this app's own src. No node_modules here: deps resolve from ../node_modules.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
      '~': path.resolve(__dirname, 'src'),
    },
    dedupe: ['react', 'react-dom', 'zustand', '@mantine/core', '@mantine/hooks'],
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  server: { port: 5220, host: true },
});
