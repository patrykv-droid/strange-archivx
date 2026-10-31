import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';
export default defineConfig({
  plugins: [react(), viteSingleFile(), {
    name: 'inline-favicon',
    transformIndexHtml(html) {
      const icon = 'data:image/svg+xml,' + encodeURIComponent(readFileSync('public/favicon.svg', 'utf8'));
      return html.replace('href="/favicon.svg"', `href="${icon}"`);
    },
  }],
  build: { outDir: 'dist-standalone', emptyOutDir: true },
});
