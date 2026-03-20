import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/js/**/*.test.js'],
    // Each file gets its own isolated jsdom environment so global state
    // from window.eval() in one file cannot bleed into another.
    isolate: true,
  },
})
