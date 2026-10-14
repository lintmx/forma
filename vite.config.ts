import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'playground',
  base: '/dev/',
  plugins: [react()],
  build: { outDir: '../dist/playground', emptyOutDir: false },
});
