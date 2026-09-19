import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures assets are loaded properly on GitHub Pages
  server: {
    watch: {
      ignored: [
        '**/Google_Sans/**',
        '**/Banner/**',
        '**/public/fonts/**',
        '**/public/banner.mp4',
        '**/dist/**',
        '**/.git/**',
      ],
    },
  },
});
