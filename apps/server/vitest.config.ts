import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // PGlite (встроенный WASM-Postgres) на холодном старте вместе с миграциями
    // может превышать дефолтные 5s при параллельном прогоне под нагрузкой CPU
    // (особенно в CI). Даём интеграционным тестам запас, чтобы медленный
    // cold-start не давал ложных падений (createTestDb в теле теста/хуках).
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
