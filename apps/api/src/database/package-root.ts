import { existsSync } from "node:fs";
import path from "node:path";

function hasDatabaseArtifacts(root: string): boolean {
  return (
    existsSync(path.join(root, "src", "database", "migrations")) &&
    existsSync(path.join(root, "prisma", "schema.prisma"))
  );
}

export function resolveApiPackageRoot(currentDir: string): string {
  const candidates = [
    path.resolve(currentDir, "../../.."),
    process.cwd(),
    path.resolve(process.cwd(), "apps", "api"),
  ];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const normalized = path.resolve(candidate);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);

    if (hasDatabaseArtifacts(normalized)) {
      return normalized;
    }
  }

  return path.resolve(currentDir, "../../..");
}
