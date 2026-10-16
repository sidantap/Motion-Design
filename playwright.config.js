import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// Use the cloud image's Chromium when present; elsewhere use Playwright's browser.
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH
  || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    launchOptions: { executablePath, args: ['--no-sandbox'] },
  },
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
});
