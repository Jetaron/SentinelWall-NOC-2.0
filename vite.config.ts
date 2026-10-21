import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: true,
    },
    build: {
      chunkSizeWarningLimit: 800,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-charts',
                test: /node_modules[\\/](chart\.js|react-chartjs-2)/,
              },
              {
                name: 'vendor-pdf',
                test: /node_modules[\\/](jspdf|html2canvas|canvg)/,
              },
              {
                name: 'vendor-motion',
                test: /node_modules[\\/](motion|framer-motion)/,
              },
              {
                name: 'vendor-icons',
                test: /node_modules[\\/]lucide-react/,
              },
              {
                name: 'vendor-core',
                test: /node_modules[\\/](react|react-dom|scheduler)/,
              },
            ],
          },
        },
      },
    },
  };
});