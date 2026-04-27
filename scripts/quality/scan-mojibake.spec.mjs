import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  collectMojibakeScanFiles,
  scanMojibakeInFiles,
} from "./scan-mojibake.mjs";

function codePoints(...values) {
  return String.fromCodePoint(...values);
}

test("scanMojibakeInFiles catches known mojibake and question-mark corruption", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mojibake-scan-"));
  try {
    const file = path.join(dir, "bad.tsx");
    const bad = [
      `const a = ${JSON.stringify(codePoints(0x5bb8, 0x8336, 0x81ea, 0x52d5))};`,
      `const b = ${JSON.stringify(codePoints(0x93bf, 0x64cd, 0x4f5c))};`,
      `const c = ${JSON.stringify(codePoints(0x7f02, 0x682a, 0x8f91))};`,
      `const d = ${JSON.stringify("?".repeat(4))};`,
      `const e = ${JSON.stringify(String.fromCodePoint(0xfffd))};`,
    ].join("\n");
    await writeFile(file, bad, "utf8");
    const result = await scanMojibakeInFiles([file]);
    assert.equal(result.hits.length, 5);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("scanMojibakeInFiles catches observed rule-center mojibake glyph families", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mojibake-scan-"));
  try {
    const file = path.join(dir, "rule-center.tsx");
    const bad = [
      codePoints(0x9477, 0xe044, 0x59e9, 0x6434, 0x65c2, 0x6564),
      codePoints(0x7eeb, 0x8bf2, 0x7037),
      codePoints(0x93bc, 0x6ec5, 0x50a8, 0x7ecb, 0x5938, 0x6b22),
      codePoints(0x6d63, 0x6ec6, 0x20ac, 0x546b, 0x20ac),
    ].join("\n");
    await writeFile(file, bad, "utf8");
    const result = await scanMojibakeInFiles([file]);
    assert.equal(result.hits.length, 4);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("scanMojibakeInFiles catches latin-1 style Chinese mojibake", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mojibake-scan-"));
  try {
    const file = path.join(dir, "latin1.tsx");
    const bad = codePoints(
      0x00e7,
      0x00bb,
      0x0178,
      0x00e8,
      0x00ae,
      0x00a1,
      0x00e5,
      0x00ad,
      0x00a6,
    );
    await writeFile(file, bad, "utf8");
    const result = await scanMojibakeInFiles([file]);
    assert.equal(result.hits.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("collectMojibakeScanFiles scans changed files and stable source roots", () => {
  const files = collectMojibakeScanFiles({
    explicitFiles: [],
    changedFiles: ["docs/changed.md"],
    sourceFiles: [
      "apps/web/src/features/template-governance/rule-authoring-table-semantic-fields.tsx",
      "node_modules/ignored-package/index.js",
    ],
  });

  assert.deepEqual(files, [
    "docs/changed.md",
    "apps/web/src/features/template-governance/rule-authoring-table-semantic-fields.tsx",
  ]);
});

test("scanMojibakeInFiles allows normal Chinese and English", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mojibake-scan-"));
  try {
    const file = path.join(dir, "good.tsx");
    const normalLabel = codePoints(0x7f16, 0x8f91, 0x89c4, 0x5219, 0xff1a, 0x6821, 0x5bf9, 0x4e0e, 0x77e5, 0x8bc6, 0x56de, 0x6d41);
    await writeFile(file, `const label = ${JSON.stringify(normalLabel)};\n`, "utf8");
    const result = await scanMojibakeInFiles([file]);
    assert.deepEqual(result.hits, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
