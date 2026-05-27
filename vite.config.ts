import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures relative paths when built for Electron
  test: {
    exclude: [...configDefaults.exclude, '.claude/worktrees/**'],
  },
});
