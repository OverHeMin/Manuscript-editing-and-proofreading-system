import assert from "node:assert/strict";
import test from "node:test";

import {
  REQUIRED_NODE_MAJOR,
  REQUIRED_PNPM_MAJOR,
  evaluateRuntimeAlignment,
  extractMajorVersion,
} from "./local-pr-gate.mjs";

test("extractMajorVersion parses semver-like version strings", () => {
  assert.equal(extractMajorVersion("v22.13.1"), 22);
  assert.equal(extractMajorVersion("10.15.4"), 10);
  assert.equal(extractMajorVersion("  v9.0.0  "), 9);
  assert.equal(extractMajorVersion("next"), null);
  assert.equal(extractMajorVersion(""), null);
});

test("evaluateRuntimeAlignment accepts the CI runtime majors", () => {
  const result = evaluateRuntimeAlignment({
    nodeVersion: `v${REQUIRED_NODE_MAJOR}.4.0`,
    pnpmVersion: `${REQUIRED_PNPM_MAJOR}.2.1`,
  });

  assert.deepEqual(result, {
    isAligned: true,
    nodeMajor: REQUIRED_NODE_MAJOR,
    pnpmMajor: REQUIRED_PNPM_MAJOR,
    problems: [],
  });
});

test("evaluateRuntimeAlignment reports every mismatched runtime", () => {
  const result = evaluateRuntimeAlignment({
    nodeVersion: "v24.13.1",
    pnpmVersion: "9.15.4",
  });

  assert.equal(result.isAligned, false);
  assert.equal(result.nodeMajor, 24);
  assert.equal(result.pnpmMajor, 9);
  assert.deepEqual(result.problems, [
    `Node.js ${REQUIRED_NODE_MAJOR}.x required, found v24.13.1`,
    `pnpm ${REQUIRED_PNPM_MAJOR}.x required, found 9.15.4`,
  ]);
});

test("evaluateRuntimeAlignment flags unparsable versions", () => {
  const result = evaluateRuntimeAlignment({
    nodeVersion: "mystery",
    pnpmVersion: "",
  });

  assert.equal(result.isAligned, false);
  assert.equal(result.nodeMajor, null);
  assert.equal(result.pnpmMajor, null);
  assert.deepEqual(result.problems, [
    "Could not determine the current Node.js major version from mystery",
    "Could not determine the current pnpm major version from ",
  ]);
});
