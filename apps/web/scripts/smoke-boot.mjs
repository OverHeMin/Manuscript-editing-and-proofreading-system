import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const fileName of [".env", ".env.example"]) {
  loadEnvDefaults(path.join(appRoot, fileName));
}

const appEnv = requireEnv("VITE_APP_ENV");
if (!["local", "dev", "staging", "prod"].includes(appEnv)) {
  throw new Error(`Unsupported VITE_APP_ENV value: ${appEnv}`);
}

const apiBaseUrl = new URL(requireEnv("VITE_API_BASE_URL"));
const webPort = Number(process.env.WEB_PORT ?? "4173");

if (!Number.isInteger(webPort) || webPort <= 0) {
  throw new Error(`WEB_PORT must be a positive integer, received: ${webPort}`);
}

console.log(
  `[web] smoke boot OK (env=${appEnv}, api=${apiBaseUrl.origin}, port=${webPort})`,
);

function loadEnvDefaults(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
