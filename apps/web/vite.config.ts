import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/conversations': 'http://localhost:3000',
      '/workspace': 'http://localhost:3000',
      '/canvas': 'http://localhost:3000',
      '/notifications': 'http://localhost:3000',
      '/todos': 'http://localhost:3000',
      '/agent-catalog': 'http://localhost:3000',
      '/agent-sessions': 'http://localhost:3000',
      '/folders': 'http://localhost:3000',
      '/events': 'http://localhost:3000',
      '/api': 'http://localhost:7860',
    },
  },
});
