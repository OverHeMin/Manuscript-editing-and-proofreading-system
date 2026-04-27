import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { scanMojibakeInFiles } from "./scan-mojibake.mjs";

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

test("scanMojibakeInFiles allows normal Chinese and English", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mojibake-scan-"));
  try {
    const file = path.join(dir, "good.tsx");
    await writeFile(file, "const label = \"编辑规则：校对与知识回流\";\n", "utf8");
    const result = await scanMojibakeInFiles([file]);
    assert.deepEqual(result.hits, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
