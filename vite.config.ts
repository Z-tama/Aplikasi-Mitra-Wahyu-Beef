import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'safari13',
    cssTarget: 'safari13',
  },
  esbuild: {
    target: 'safari13',
  },
});
