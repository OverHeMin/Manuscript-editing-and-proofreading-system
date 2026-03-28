import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const configDir = dirname(fileURLToPath(import.meta.url));
  const env = loadEnv(mode, configDir, "");
  const rawWebPort = env.WEB_PORT;
  let webPort = 4173;

  if (rawWebPort) {
    const parsedWebPort = Number(rawWebPort);
    const isValidPositiveInteger =
      Number.isInteger(parsedWebPort) && parsedWebPort > 0;

    if (!isValidPositiveInteger) {
      throw new Error(
        `Invalid WEB_PORT "${rawWebPort}". Expected a positive integer.`,
      );
    }

    webPort = parsedWebPort;
  }

  return {
    plugins: [react()],
    server: { port: webPort, strictPort: true },
  };
});
