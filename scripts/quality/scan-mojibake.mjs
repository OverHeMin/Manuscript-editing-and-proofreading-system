import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".json",
  ".md",
  ".css",
  ".html",
  ".py",
]);

const MOJIBAKE_TOKENS = [
  [0x5bb8, 0x8336],
  [0x93bf],
  [0x7f02, 0x682a, 0x8f91],
  [0x93cd, 0x2033],
  [0x95ab],
  [0x7035],
  [0x93c8],
  [0x9418],
  [0x93c2],
  [0x8930],
  [0x8d04],
  [0x7459],
  [0x9428],
  [0x9357],
  [0x95c2],
  [0x93c9],
].map((points) => String.fromCodePoint(...points));

export async function scanMojibakeInFiles(files) {
  const hits = [];
  for (const file of files) {
    if (!existsSync(file) || !isTextFile(file)) {
      continue;
    }
    const text = await readFile(file, "utf8");
    text.split(/\r?\n/u).forEach((line, index) => {
      const matched = MOJIBAKE_TOKENS.filter((token) => token && line.includes(token));
      if (
        matched.length ||
        line.includes("?".repeat(4)) ||
        line.includes(String.fromCodePoint(0xfffd))
      ) {
        hits.push({ file, line: index + 1, text: line.trim(), matched });
      }
    });
  }
  return { hits };
}

function isTextFile(file) {
  return TEXT_EXTENSIONS.has(path.extname(file));
}

function changedFiles() {
  const output = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], {
    encoding: "utf8",
  });
  return output.split(/\r?\n/u).filter(Boolean);
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isMain()) {
  const files = process.argv.slice(2).length ? process.argv.slice(2) : changedFiles();
  const result = await scanMojibakeInFiles(files);
  for (const hit of result.hits) {
    console.log(`${hit.file}:${hit.line}: ${hit.text}`);
  }
  if (result.hits.length) {
    process.exit(1);
  }
}
