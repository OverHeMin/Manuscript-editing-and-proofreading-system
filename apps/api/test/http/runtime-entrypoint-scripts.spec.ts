import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const packageJsonPath = path.resolve(import.meta.dirname, "../../package.json");

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
});
