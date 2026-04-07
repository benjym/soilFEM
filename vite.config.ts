import { defineConfig } from 'vitest/config';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'soilFEM';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? `/${repositoryName}/` : '/',
  test: {
    environment: 'node',
  },
});
