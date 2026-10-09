import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server:{proxy:{'/api':'http://127.0.0.1:3001'}},
  preview:{proxy:{'/api':'http://127.0.0.1:3001'}},
  test: {
    environment: 'jsdom',
    maxWorkers: 2,
    include: ['tests/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
