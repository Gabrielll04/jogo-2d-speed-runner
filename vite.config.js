import { defineConfig } from 'vite';

// Build pensado para rodar OFFLINE: caminhos relativos (base './') para que o
// dist/ funcione servido de qualquer pasta pelo server.js.
export default defineConfig({
  base: './',
  build: {
    target: 'es2019',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Nomes curtos e estaveis: facilita copiar o dist/ no pendrive.
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },
  server: {
    host: true,
    port: 5173
  }
});
