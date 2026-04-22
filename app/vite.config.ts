import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiPlugin } from './server/api.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  plugins: [apiPlugin()],
});
