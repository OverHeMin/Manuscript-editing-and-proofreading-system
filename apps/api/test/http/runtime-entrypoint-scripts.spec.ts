import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const packageJsonPath = path.resolve(import.meta.dirname, "../../package.json");
const migrateEntrypointPath = path.resolve(
  import.meta.dirname,
  "../../src/database/scripts/migrate.ts",
);

test("api package defaults dev and serve entrypoints to the persistent runtime", () => {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  assert.equal(packageJson.scripts?.dev, "pnpm run dev:persistent");
  assert.equal(packageJson.scripts?.serve, "pnpm run serve:persistent");
  assert.equal(packageJson.scripts?.["dev:demo"], "tsx watch ./src/http/dev-server.ts");
  assert.equal(packageJson.scripts?.["serve:demo"], "tsx ./src/http/dev-server.ts");
  assert.equal(
    packageJson.scripts?.["preflight:persistent"],
    "tsx ./src/ops/persistent-startup-preflight.ts",
  );
  assert.equal(
    packageJson.scripts?.["db:migrate"],
    "tsx ./src/database/scripts/migrate.ts",
  );
});

test("db:migrate entrypoint loads app env defaults before resolving database urls", () => {
  const migrateEntrypointSource = readFileSync(migrateEntrypointPath, "utf8");

  assert.match(
    migrateEntrypointSource,
    /loadAppEnvDefaults/,
    "Expected db:migrate to load .env defaults before using database config.",
  );
});
