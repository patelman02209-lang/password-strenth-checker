/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { InlineConfig } from 'vitest'
import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'

const vitestConfig: InlineConfig = {
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html', 'lcov'],
    include: ['src/**/*.{ts,tsx}'],
    exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
  },
}

const viteConfig: UserConfig = {
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
}

export default defineConfig({
  ...viteConfig,
  test: vitestConfig,
} as UserConfig & { test: InlineConfig })
