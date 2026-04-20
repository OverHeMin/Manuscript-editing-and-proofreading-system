import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnvFile(fileName: string): Record<string, string> {
  const filePath = path.join(appRoot, fileName);
  const contents = readFileSync(filePath, "utf8");
  const values: Record<string, string> = {};

  for (const line of contents.split(/\r?\n/u)) {
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
    values[key] = value;
  }

  return values;
}

test("persistent web build keeps the API base off the frontend web port", () => {
  const env = readEnvFile(".env.persistent");

  assert.ok(env.VITE_API_BASE_URL, "Expected .env.persistent to define VITE_API_BASE_URL.");
  assert.ok(env.WEB_PORT, "Expected .env.persistent to define WEB_PORT.");

  const apiOrigin = new URL(env.VITE_API_BASE_URL).origin;
  const webOrigin = new URL(`http://127.0.0.1:${env.WEB_PORT}`).origin;

  assert.notEqual(
    apiOrigin,
    webOrigin,
    "Persistent frontend must call the backend origin instead of its own web port.",
  );
});
