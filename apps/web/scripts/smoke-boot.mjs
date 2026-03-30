import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadEnvDefaults } from "./env-defaults.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

loadEnvDefaults(appRoot);

const appEnv = requireEnv("VITE_APP_ENV");
if (!["local", "dev", "staging", "prod"].includes(appEnv)) {
  throw new Error(`Unsupported VITE_APP_ENV value: ${appEnv}`);
}

const apiBaseUrl = new URL(requireEnv("VITE_API_BASE_URL"));
const onlyOfficePublicUrl = process.env.VITE_ONLYOFFICE_PUBLIC_URL;
const webPort = Number(process.env.WEB_PORT ?? "4173");

if (!Number.isInteger(webPort) || webPort <= 0) {
  throw new Error(`WEB_PORT must be a positive integer, received: ${webPort}`);
}

if (onlyOfficePublicUrl) {
  new URL(onlyOfficePublicUrl);
}

console.log(
  `[web] smoke boot OK (env=${appEnv}, api=${apiBaseUrl.origin}, port=${webPort})`,
);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
