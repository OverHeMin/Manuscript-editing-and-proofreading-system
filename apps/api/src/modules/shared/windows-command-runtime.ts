import fs from "node:fs";
import path from "node:path";

const defaultRepoRoot = path.resolve(import.meta.dirname, "../../../../../");
const WINDOWS_PYTHON_FALLBACKS = [
  "C:\\Program Files\\LibreOffice\\program\\python.exe",
];

export function getWorkspaceCliBinDir(repoRoot = defaultRepoRoot): string {
  return path.join(repoRoot, ".codex-runtime", "windows-cli", "bin");
}

export function buildWorkspaceChildProcessEnv(input: {
  repoRoot?: string;
  baseEnv?: NodeJS.ProcessEnv;
  pathExists?: (candidatePath: string) => boolean;
  platform?: NodeJS.Platform;
} = {}): NodeJS.ProcessEnv {
  const repoRoot = input.repoRoot ?? defaultRepoRoot;
  const baseEnv = input.baseEnv ?? process.env;
  const pathExists = input.pathExists ?? fs.existsSync;
  const platform = input.platform ?? process.platform;
  const pathKey = resolvePathEnvKey(baseEnv);
  const currentPath = baseEnv[pathKey] ?? baseEnv.PATH ?? baseEnv.Path ?? "";
  const cliRoot = path.join(repoRoot, ".codex-runtime", "windows-cli");
  const cliBinDir = getWorkspaceCliBinDir(repoRoot);
  const ghConfigDir = path.join(cliRoot, "gh-config");
  const pnpmHomeDir = path.join(cliRoot, "pnpm-home");
  const pythonBin = baseEnv.PYTHON_BIN?.trim() || resolveDefaultWindowsPythonBin({
    pathExists,
    platform,
  });

  return {
    ...baseEnv,
    [pathKey]: prependPathEntries(currentPath, [cliBinDir], { platform }),
    CODEX_WINDOWS_CLI_ROOT: cliRoot,
    CODEX_WINDOWS_CLI_BIN: cliBinDir,
    GH_CONFIG_DIR: baseEnv.GH_CONFIG_DIR?.trim() || ghConfigDir,
    PNPM_HOME: baseEnv.PNPM_HOME?.trim() || pnpmHomeDir,
    npm_config_manage_package_manager_versions:
      baseEnv.npm_config_manage_package_manager_versions?.trim() || "false",
    ...(pythonBin ? { PYTHON_BIN: pythonBin } : {}),
  };
}

export function buildPythonCommandCandidates(input: {
  env?: NodeJS.ProcessEnv;
  preferredCommand?: string;
} = {}): string[] {
  const env = input.env ?? process.env;
  const configured = env.PYTHON_BIN?.trim();
  const candidates = [
    typeof input.preferredCommand === "string" ? input.preferredCommand.trim() : "",
    configured,
    "python",
    "python3",
  ];

  return [...new Set(
    candidates.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    ),
  )];
}

export function isCommandUnavailableError(
  error: unknown,
  input: {
    platform?: NodeJS.Platform;
  } = {},
): error is NodeJS.ErrnoException {
  const platform = input.platform ?? process.platform;
  if (!isErrnoException(error)) {
    return false;
  }

  if (error.code === "ENOENT") {
    return true;
  }

  if (platform !== "win32") {
    return false;
  }

  const detail = [
    typeof error.message === "string" ? error.message : "",
    typeof error.path === "string" ? error.path : "",
  ]
    .join(" ")
    .toLowerCase();

  if (error.code === "EPERM" || error.code === "EACCES") {
    return (
      detail.includes("access is denied") ||
      detail.includes("windowsapps") ||
      detail.includes("operation not permitted") ||
      detail.includes("spawn ")
    );
  }

  if (error.code === "UNKNOWN") {
    return detail.includes("access is denied") || detail.includes("windowsapps");
  }

  return false;
}

function prependPathEntries(
  basePath: string,
  entries: string[],
  input: {
    platform?: NodeJS.Platform;
  } = {},
): string {
  const platform = input.platform ?? process.platform;
  const pathModule = platform === "win32" ? path.win32 : path.posix;
  const delimiter = platform === "win32" ? ";" : ":";
  const candidates = [
    ...entries,
    ...(typeof basePath === "string" && basePath.length > 0 ? basePath.split(delimiter) : []),
  ];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of candidates) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const normalized = pathModule.normalize(trimmed);
    const key = platform === "win32" ? normalized.toLowerCase() : normalized;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result.join(delimiter);
}

function resolvePathEnvKey(baseEnv: NodeJS.ProcessEnv): string {
  return Object.keys(baseEnv).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

function resolveDefaultWindowsPythonBin(input: {
  pathExists?: (candidatePath: string) => boolean;
  platform?: NodeJS.Platform;
} = {}): string {
  const pathExists = input.pathExists ?? fs.existsSync;
  const platform = input.platform ?? process.platform;
  if (platform !== "win32") {
    return "";
  }

  for (const candidate of WINDOWS_PYTHON_FALLBACKS) {
    if (pathExists(candidate)) {
      return candidate;
    }
  }

  return "";
}
