import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const webPort = Number(env.WEB_PORT ?? 4173);

  return {
    plugins: [react()],
    server: Number.isFinite(webPort)
      ? { port: webPort, strictPort: true }
      : undefined,
  };
});
