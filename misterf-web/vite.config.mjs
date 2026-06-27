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
        assignments: path.resolve('src/client/assignments/index.js'),
        chat: path.resolve('src/client/chat/index.js'),
        chatrooms: path.resolve('src/client/chatrooms/main.js'),
        'client-error-telemetry': path.resolve(
          'src/client/telemetry/clientErrorReporter.js',
        ),
        'practice-modules': path.resolve('src/client/practiceModules/index.js'),
        resources: path.resolve('src/client/resources/index.js'),
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
