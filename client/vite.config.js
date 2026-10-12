import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev proxy forwards /api to Express, so the browser only ever talks to one origin (no CORS setup needed).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3001' } },
});
