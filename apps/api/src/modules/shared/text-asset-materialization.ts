import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface MaterializeTextAssetInput {
  rootDir: string;
  storageKey: string;
  content: string;
}

export interface MaterializedTextAssetRecord {
  storageKey: string;
  absolutePath: string;
  bytes: Buffer;
}

export async function materializeTextAsset(
  input: MaterializeTextAssetInput,
): Promise<MaterializedTextAssetRecord> {
  const rootDir = path.resolve(input.rootDir);
  const absolutePath = resolveStoragePath(rootDir, input.storageKey);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.content, "utf8");

  return {
    storageKey: input.storageKey,
    absolutePath,
    bytes: await readFile(absolutePath),
  };
}

function resolveStoragePath(rootDir: string, storageKey: string): string {
  const normalizedSegments = storageKey
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  const absolutePath = path.resolve(rootDir, ...normalizedSegments);
  const relativePath = path.relative(rootDir, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(
      `Resolved text asset path escaped the configured root: "${storageKey}".`,
    );
  }

  return absolutePath;
}
