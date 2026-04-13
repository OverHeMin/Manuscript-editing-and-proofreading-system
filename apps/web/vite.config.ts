import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readEnvDefaults } from "./scripts/env-defaults.mjs";

export default defineConfig(({ mode }) => {
  const configDir = dirname(fileURLToPath(import.meta.url));
  const env = {
    ...readEnvDefaults(configDir),
    ...loadEnv(mode, configDir, ""),
  };
  const defineEnvFallbacks = Object.fromEntries(
    Object.entries(env)
      .filter(([key]) => key.startsWith("VITE_"))
      .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );
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
    define: defineEnvFallbacks,
    plugins: [react()],
    resolve: {
      alias: {
        "@medical/contracts": resolve(
          configDir,
          "../../packages/contracts/src/index.ts",
        ),
      },
    },
    server: { port: webPort, strictPort: true },
  };
});
