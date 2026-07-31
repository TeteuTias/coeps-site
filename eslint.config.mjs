import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  globalIgnores([
    '.next/**',
    '.worktrees/**',
    'node_modules/**',
    'tmp/**',
    'output/**',
    'next-env.d.ts',
  ]),
]);
