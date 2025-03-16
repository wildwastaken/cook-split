import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/cooksplit/', // served at allenliu.dev/cooksplit
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
