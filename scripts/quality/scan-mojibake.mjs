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

const SOURCE_SCAN_ROOTS = ["apps", "packages", "scripts", "docs"];

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
  [0x9477, 0xe044],
  [0x6434, 0x65c2, 0x6564],
  [0x7eeb, 0x8bf2, 0x7037],
  [0x93bc, 0x6ec5, 0x50a8],
  [0x6d63, 0x6ec6, 0x20ac],
  [0x7f02, 0x682c, 0x7deb],
  [0x8e47, 0x544c, 0x6e36],
  [0x951b, 0x581d, 0x5f48],
  [0x00e7, 0x00bb, 0x0178],
  [0x00e8, 0x00ae, 0x00a1],
  [0x00e5, 0x00ad, 0x00a6],
  [0x00e5, 0x20ac, 0x00bc],
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
        line.includes(String.fromCodePoint(0xfffd)) ||
        hasPrivateUseMojibakeMarker(line) ||
        hasC1ControlMojibakeMarker(line)
      ) {
        hits.push({ file, line: index + 1, text: line.trim(), matched });
      }
    });
  }
  return { hits };
}

export function collectMojibakeScanFiles({
  explicitFiles = process.argv.slice(2),
  changedFiles: changedFileList,
  sourceFiles,
} = {}) {
  const candidates = explicitFiles.length
    ? explicitFiles
    : [
        ...(changedFileList ?? changedFiles()),
        ...(sourceFiles ?? sourceTreeFiles()),
      ];

  return uniqueStrings(candidates).filter(isScannablePath);
}

function isTextFile(file) {
  return TEXT_EXTENSIONS.has(path.extname(file));
}

function changedFiles() {
  return readGitFileList(["diff", "--name-only", "origin/main...HEAD"]);
}

function sourceTreeFiles() {
  return readGitFileList(["ls-files", "--", ...SOURCE_SCAN_ROOTS]);
}

function readGitFileList(args) {
  try {
    const output = execFileSync("git", args, {
      encoding: "utf8",
    });
    return output.split(/\r?\n/u).filter(Boolean);
  } catch {
    return [];
  }
}

function uniqueStrings(values) {
  return [...new Set(values)];
}

function isScannablePath(file) {
  const normalized = file.replace(/\\/gu, "/");
  return (
    normalized !== "node_modules" &&
    !normalized.startsWith("node_modules/") &&
    !normalized.includes("/node_modules/") &&
    isTextFile(file)
  );
}

function hasPrivateUseMojibakeMarker(line) {
  return /[\ue000-\uf8ff]/u.test(line);
}

function hasC1ControlMojibakeMarker(line) {
  return /[\u0080-\u009f]/u.test(line);
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isMain()) {
  const files = collectMojibakeScanFiles();
  const result = await scanMojibakeInFiles(files);
  for (const hit of result.hits) {
    console.log(`${hit.file}:${hit.line}: ${hit.text}`);
  }
  if (result.hits.length) {
    process.exit(1);
  }
}
