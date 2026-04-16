import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function extractListeningPort(logText) {
  const normalized = stripAnsi(typeof logText === "string" ? logText : "");
  const match = /https?:\/\/(?:127\.0\.0\.1|localhost):(\d+)\b/u.exec(normalized);
  if (!match) {
    return null;
  }

  const port = Number.parseInt(match[1], 10);
  return Number.isFinite(port) ? port : null;
}

export function isRepoLocalProcess({ repoRoot, commandLine }) {
  if (typeof repoRoot !== "string" || repoRoot.trim().length === 0) {
    return false;
  }

  if (typeof commandLine !== "string" || commandLine.trim().length === 0) {
    return false;
  }

  return normalizeForPathMatch(commandLine).includes(normalizeForPathMatch(repoRoot));
}

export function summarizeCodexLogTargets({
  repoRoot,
  logFiles,
  listenersByPort,
}) {
  return logFiles.map((logFile) => {
    const port = extractListeningPort(logFile.content);
    const listener = port == null ? null : listenersByPort.get(port) ?? null;

    if (port == null) {
      return {
        path: logFile.path,
        directoryPath: path.dirname(logFile.path),
        port: null,
        pid: null,
        action: "delete_log_only",
        reason: "no listening port could be extracted from codex log",
      };
    }

    if (listener == null) {
      return {
        path: logFile.path,
        directoryPath: path.dirname(logFile.path),
        port,
        pid: null,
        action: "delete_log_only",
        reason: "no active listener found for extracted port",
      };
    }

    if (
      isRepoLocalProcess({
        repoRoot,
        commandLine: listener.commandLine,
      })
    ) {
      return {
        path: logFile.path,
        directoryPath: path.dirname(logFile.path),
        port,
        pid: listener.pid ?? null,
        action: "stop_process_then_delete",
        reason: "repo-local listener discovered from codex log",
      };
    }

    return {
      path: logFile.path,
      directoryPath: path.dirname(logFile.path),
      port,
      pid: listener.pid ?? null,
      action: "delete_requires_manual_process_review",
      reason: "listener exists but is not anchored inside this repo",
    };
  });
}

export function collectCodexLogFiles(repoRoot) {
  const results = [];
  walkForCodexLogs(repoRoot, results);
  return results;
}

export function collectCodexLogDirectories(repoRoot) {
  const results = [];
  walkForCodexLogDirectories(repoRoot, results);
  return results;
}

export function collectListeningProcessesByPort(ports) {
  const uniquePorts = [...new Set(ports.filter((port) => Number.isInteger(port)))];
  if (uniquePorts.length === 0) {
    return new Map();
  }

  if (process.platform !== "win32") {
    return new Map();
  }

  const netstatResult = spawnSync("netstat", ["-ano", "-p", "TCP"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (netstatResult.status !== 0) {
    throw new Error(netstatResult.stderr?.trim() || "Failed to inspect listening TCP ports.");
  }

  const portsSet = new Set(uniquePorts);
  const listenerRows = netstatResult.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.includes("LISTENING"))
    .map(parseWindowsNetstatLine)
    .filter((row) => row != null && portsSet.has(row.port));

  if (listenerRows.length === 0) {
    return new Map();
  }

  const processCommandLines = collectWindowsProcessCommandLines(
    [...new Set(listenerRows.map((row) => row.pid))],
  );

  return new Map(
    listenerRows.map((row) => [
      row.port,
      {
        pid: row.pid,
        commandLine: processCommandLines.get(row.pid) ?? "",
      },
    ]),
  );
}

function collectWindowsProcessCommandLines(pids) {
  if (pids.length === 0) {
    return new Map();
  }

  const command = buildWindowsProcessProbeCommand(pids);
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || "Failed to inspect repo-local process command lines.");
  }

  const trimmed = result.stdout.trim();
  if (trimmed.length === 0) {
    return new Map();
  }

  const decoded = JSON.parse(trimmed);
  const records = Array.isArray(decoded) ? decoded : [decoded];
  return new Map(
    records
      .filter((record) => Number.isInteger(record?.pid))
      .map((record) => [
        record.pid,
        typeof record?.commandLine === "string" ? record.commandLine : "",
      ]),
  );
}

export async function applyCodexLogCleanup(summary) {
  const repoLocalPids = [...new Set(
    summary
      .filter((item) => item.action === "stop_process_then_delete" && Number.isInteger(item.pid))
      .map((item) => item.pid),
  )];

  if (repoLocalPids.length > 0) {
    stopWindowsProcesses(repoLocalPids);
    await delay(750);
  }

  const deletedFiles = [];
  for (const item of summary) {
    if (
      item.action !== "stop_process_then_delete" &&
      item.action !== "delete_log_only"
    ) {
      continue;
    }

    if (!fs.existsSync(item.path)) {
      continue;
    }

    await deletePathWithRetries(item.path);
    deletedFiles.push(item.path);
  }

  const deletedDirectories = [];
  const candidateDirectories = [...new Set(summary.map((item) => item.directoryPath))];
  for (const directoryPath of candidateDirectories) {
    if (!fs.existsSync(directoryPath)) {
      continue;
    }

    const remainingEntries = fs.readdirSync(directoryPath);
    if (remainingEntries.length > 0) {
      continue;
    }

    deletedDirectories.push(...removeEmptyCodexLogDirectories([directoryPath]));
  }

  return {
    stoppedPids: repoLocalPids,
    deletedFiles,
    deletedDirectories,
  };
}

export async function deletePathWithRetries(
  targetPath,
  {
    maxAttempts = 5,
    delayMs = 250,
    removePath = defaultRemovePath,
  } = {},
) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      removePath(targetPath);
      return;
    } catch (error) {
      if (error?.code !== "EBUSY" || attempt === maxAttempts) {
        throw error;
      }

      lastError = error;
      await delay(delayMs);
    }
  }

  if (lastError != null) {
    throw lastError;
  }
}

async function main(argv = process.argv.slice(2)) {
  const apply = argv.includes("--apply");
  const repoRoot = process.cwd();
  const logDirectories = collectCodexLogDirectories(repoRoot);
  const logFiles = collectCodexLogFiles(repoRoot);
  const listenersByPort = collectListeningProcessesByPort(
    logFiles.map((logFile) => extractListeningPort(logFile.content)).filter(Boolean),
  );
  const summary = summarizeCodexLogTargets({
    repoRoot,
    logFiles,
    listenersByPort,
  });

  if (summary.length === 0) {
    if (apply && logDirectories.length > 0) {
      const deletedDirectories = removeEmptyCodexLogDirectories(logDirectories);
      console.log(
        `No .codex-logs files found under this repo. Removed ${deletedDirectories.length} empty director${deletedDirectories.length === 1 ? "y" : "ies"}.`,
      );
      return 0;
    }

    console.log("No .codex-logs files found under this repo.");
    return 0;
  }

  for (const item of summary) {
    const portLabel = item.port == null ? "n/a" : String(item.port);
    const pidLabel = item.pid == null ? "n/a" : String(item.pid);
    console.log(
      `${item.action} | port=${portLabel} | pid=${pidLabel} | ${item.path} | ${item.reason}`,
    );
  }

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to stop repo-local listeners and delete logs.");
    return summary.some((item) => item.action === "delete_requires_manual_process_review") ? 2 : 0;
  }

  const outcome = await applyCodexLogCleanup(summary);
  console.log(
    `Applied cleanup: stopped ${outcome.stoppedPids.length} process(es), deleted ${outcome.deletedFiles.length} file(s), removed ${outcome.deletedDirectories.length} director${outcome.deletedDirectories.length === 1 ? "y" : "ies"}.`,
  );
  return summary.some((item) => item.action === "delete_requires_manual_process_review") ? 2 : 0;
}

function walkForCodexLogs(currentPath, results) {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }

    const nextPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".codex-logs") {
        collectFilesInsideCodexLogDirectory(nextPath, results);
        continue;
      }

      walkForCodexLogs(nextPath, results);
    }
  }
}

function walkForCodexLogDirectories(currentPath, results) {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }

    const nextPath = path.join(currentPath, entry.name);
    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name === ".codex-logs") {
      results.push(nextPath);
      continue;
    }

    walkForCodexLogDirectories(nextPath, results);
  }
}

function collectFilesInsideCodexLogDirectory(directoryPath, results) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const nextPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      collectFilesInsideCodexLogDirectory(nextPath, results);
      continue;
    }

    results.push({
      path: nextPath,
      content: fs.readFileSync(nextPath, "utf8"),
    });
  }
}

export function removeEmptyCodexLogDirectories(directoryPaths) {
  const deletedDirectories = [];
  const sortedDirectories = [...new Set(directoryPaths)]
    .sort((left, right) => right.length - left.length);

  for (const directoryPath of sortedDirectories) {
    deleteEmptyCodexLogTree(directoryPath, deletedDirectories);
  }

  return deletedDirectories;
}

function buildWindowsProcessProbeCommand(pids) {
  const pidList = pids.join(",");
  return [
    `$ids = @(${pidList})`,
    "$rows = Get-CimInstance Win32_Process | Where-Object { $ids -contains $_.ProcessId } | ForEach-Object {",
    "  [pscustomobject]@{",
    "    pid = [int]$_.ProcessId",
    "    commandLine = if ($null -ne $_.CommandLine) { $_.CommandLine } else { '' }",
    "  }",
    "}",
    "if ($null -ne $rows) { $rows | ConvertTo-Json -Compress }",
  ].join("\n");
}

function stopWindowsProcesses(pids) {
  if (process.platform !== "win32" || pids.length === 0) {
    return;
  }

  const command = `$ids = @(${pids.join(",")}); Get-Process -Id $ids -ErrorAction SilentlyContinue | Stop-Process -Force`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || "Failed to stop repo-local listener processes.");
  }
}

function normalizeForPathMatch(value) {
  return value.replaceAll("/", "\\").toLowerCase();
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/gu, "");
}

function parseWindowsNetstatLine(line) {
  const match =
    /^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/iu.exec(line) ??
    /^\s*TCP\s+\[[^\]]+\]:(\d+)\s+\[[^\]]+\]:\d+\s+LISTENING\s+(\d+)\s*$/iu.exec(line);
  if (!match) {
    return null;
  }

  const port = Number.parseInt(match[1], 10);
  const pid = Number.parseInt(match[2], 10);
  if (!Number.isFinite(port) || !Number.isFinite(pid)) {
    return null;
  }

  return { port, pid };
}

function deleteEmptyCodexLogTree(directoryPath, deletedDirectories) {
  if (!fs.existsSync(directoryPath)) {
    return;
  }

  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      return;
    }

    deleteEmptyCodexLogTree(path.join(directoryPath, entry.name), deletedDirectories);
  }

  const remainingEntries = fs.readdirSync(directoryPath);
  if (remainingEntries.length > 0) {
    return;
  }

  fs.rmSync(directoryPath, { recursive: true, force: true });
  deletedDirectories.push(directoryPath);
}

function pathToFileUrl(filePath) {
  const resolvedPath = path.resolve(filePath);
  const hrefPath = resolvedPath.replaceAll("\\", "/");
  return new URL(`file:///${hrefPath}`);
}

function defaultRemovePath(targetPath) {
  fs.rmSync(targetPath, { force: true });
}

function delay(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

if (import.meta.url === pathToFileUrl(process.argv[1]).href) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
