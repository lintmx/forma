import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'playground',
  base: '/dev/',
  plugins: [react()],
  build: { outDir: '../dist/playground', emptyOutDir: false },
});
