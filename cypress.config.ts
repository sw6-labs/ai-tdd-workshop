import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4173',
    supportFile: false,
    fixturesFolder: 'markdown',
    video: false,
  },
});
