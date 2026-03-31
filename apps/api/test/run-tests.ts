import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadAppEnvDefaults } from "../src/ops/env-defaults.ts";

const packageRoot = path.resolve(import.meta.dirname, "..");
const testRoot = path.join(packageRoot, "test");
const scopeFilters = process.argv.slice(2).map((value) => value.toLowerCase());

loadAppEnvDefaults(packageRoot);

function collectSpecFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectSpecFiles(entryPath);
    }

    if (entry.isFile() && entry.name.endsWith(".spec.ts")) {
      return [entryPath];
    }

    return [];
  });
}

const specFiles = collectSpecFiles(testRoot);
const selectedFiles =
  scopeFilters.length === 0
    ? specFiles
    : specFiles.filter((filePath) => {
        const normalized = filePath.toLowerCase();

        return scopeFilters.some((scope) => normalized.includes(`${path.sep}${scope}${path.sep}`) || normalized.includes(scope));
      });

if (selectedFiles.length === 0) {
  console.error(
    scopeFilters.length === 0
      ? "No spec files were found."
      : `No spec files matched scopes: ${scopeFilters.join(", ")}.`,
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...selectedFiles],
  {
    cwd: packageRoot,
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
