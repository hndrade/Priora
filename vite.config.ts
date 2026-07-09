import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site from /<repo-name>/, so the base path must
// match the repository name. Override with VITE_BASE for custom domains.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/Priora/',
});
