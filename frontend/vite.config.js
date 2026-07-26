import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

// Independently built federation REMOTE. The Core shell loads remoteEntry.js at runtime.
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'result_analysis',
      filename: 'remoteEntry.js',
      exposes: { './Module': './src/expose.js' },
      shared: ['react', 'react-dom', 'react-router-dom', 'axios'],
    }),
  ],
  server: {
    port: 3009,
    cors: true,
    proxy: {
      '/api': {
        target:
          process.env.VITE_API_URL ||
          'https://medical-stock-system-backend.onrender.com',
        changeOrigin: true,

      },
    },
  },
  build: { target: 'esnext', modulePreload: false, cssCodeSplit: false },
});
