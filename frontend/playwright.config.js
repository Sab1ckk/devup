/* global process */
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:8011",
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  webServer: {
    command:
      '"../backend/.venv/Scripts/python.exe" ../backend/tests/e2e_server.py',
    url: "http://127.0.0.1:8011/api/auth/me",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
