import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function readEnvDefaults(appRoot) {
  const merged = {};

  for (const fileName of [".env.example", ".env"]) {
    const filePath = path.join(appRoot, fileName);
    if (!existsSync(filePath)) {
      continue;
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
      merged[key] = value;
    }
  }

  return merged;
}

export function loadEnvDefaults(appRoot, targetEnv = process.env) {
  const defaults = readEnvDefaults(appRoot);

  for (const [key, value] of Object.entries(defaults)) {
    if (targetEnv[key] === undefined) {
      targetEnv[key] = value;
    }
  }
}
