import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

export function loadEnvDefaultsFromFile(filePath: string): void {
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

export function loadAppEnvDefaults(appRoot: string): void {
  for (const fileName of [".env", ".env.example"]) {
    loadEnvDefaultsFromFile(path.join(appRoot, fileName));
  }
}
