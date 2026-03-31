import path from "node:path";
import { defineConfig } from "@playwright/test";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const webRoot = import.meta.dirname;
const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";
const webBaseUrl = process.env.PLAYWRIGHT_WEB_BASE_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./playwright",
  timeout: 60_000,
  reporter: "line",
  use: {
    baseURL: webBaseUrl,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm --filter @medical/api run serve:demo",
      cwd: repoRoot,
      url: `${apiBaseUrl}/healthz`,
      reuseExistingServer: true,
    },
    {
      command: "pnpm run dev -- --host 127.0.0.1 --port 4173",
      cwd: webRoot,
      url: webBaseUrl,
      reuseExistingServer: true,
      env: {
        ...process.env,
        VITE_APP_ENV: "local",
        VITE_API_BASE_URL: apiBaseUrl,
        VITE_DEV_ROLE: "admin",
        VITE_DEMO_PASSWORD: "demo-password",
        WEB_PORT: "4173",
      },
    },
  ],
});
