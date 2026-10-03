const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser',
  workers: 1,
  reporter: 'list',
  outputDir: './test-results',
  use: { browserName: 'chromium', channel: process.env.MINDTREE_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true }
});
