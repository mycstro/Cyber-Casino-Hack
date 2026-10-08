import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    maxWorkers: 2,
    include: ['tests/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
