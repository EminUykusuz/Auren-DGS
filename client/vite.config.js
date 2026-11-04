import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { compression } from 'vite-plugin-compression2';

export default defineConfig({
  plugins: [react(), compression({ algorithms: ['brotliCompress', 'gzip'], threshold: 1024, deleteOriginalAssets: false })],
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:5050' } },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 450,
    rollupOptions: {
      output: {
        // Ağır bağımlılıklar ayrı, uzun süre önbelleklenebilir parçalara bölünür
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/](recharts|d3-[^\\/]+|victory-vendor|internmap|decimal\.js-light|lodash[^\\/]*|recharts-scale|fast-equals|eventemitter3|tiny-invariant|react-smooth|react-transition-group)[\\/]/.test(id)) return 'vendor-charts';
          if (/[\\/]framer-motion[\\/]|[\\/]motion-dom[\\/]|[\\/]motion-utils[\\/]/.test(id)) return 'vendor-motion';
          if (/[\\/]lucide-react[\\/]/.test(id)) return 'vendor-icons';
          if (/[\\/](react-router|react-router-dom|@remix-run)[\\/]/.test(id)) return 'vendor-router';
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
        },
      },
    },
  },
});
