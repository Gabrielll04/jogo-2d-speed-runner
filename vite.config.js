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
    port: 5173,
    // O Vite nao tem a API do placar: ela vive no server.js. Este proxy faz
    // com que, durante o "npm run dev", /api/* caia no server.js da porta
    // 3000 - assim da pra testar o placar sem gerar build.
    // (No evento, quem serve o jogo e o proprio server.js e nada disso entra.)
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
