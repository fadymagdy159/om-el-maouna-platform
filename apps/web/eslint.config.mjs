import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
export default defineConfig(...tseslint.configs.recommended, {
  ignores: ['.next/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'],
});
