import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    manifest: true,
    outDir: path.resolve('public/build'),
    rollupOptions: {
      input: {
        chat: path.resolve('src/client/chat/index.js'),
      },
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: 'entries/[name]-[hash].js',
      },
    },
    sourcemap: true,
    target: 'es2020',
  },
});
