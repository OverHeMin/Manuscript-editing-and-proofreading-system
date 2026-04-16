import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const REQUIRED_NODE_MAJOR = 22;
export const REQUIRED_PNPM_MAJOR = 10;

const scriptPath = fileURLToPath(import.meta.url);

export function extractMajorVersion(version) {
  const normalized = typeof version === "string" ? version.trim() : "";
  const match = /^v?(\d+)/u.exec(normalized);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

export function evaluateRuntimeAlignment({
  nodeVersion,
  pnpmVersion,
}) {
  const nodeMajor = extractMajorVersion(nodeVersion);
  const pnpmMajor = extractMajorVersion(pnpmVersion);
  const problems = [];

  if (nodeMajor == null) {
    problems.push(`Could not determine the current Node.js major version from ${nodeVersion}`);
  } else if (nodeMajor !== REQUIRED_NODE_MAJOR) {
    problems.push(`Node.js ${REQUIRED_NODE_MAJOR}.x required, found ${nodeVersion}`);
  }

  if (pnpmMajor == null) {
    problems.push(`Could not determine the current pnpm major version from ${pnpmVersion}`);
  } else if (pnpmMajor !== REQUIRED_PNPM_MAJOR) {
    problems.push(`pnpm ${REQUIRED_PNPM_MAJOR}.x required, found ${pnpmVersion}`);
  }

  return {
    isAligned: problems.length === 0,
    nodeMajor,
    pnpmMajor,
    problems,
  };
}

function main() {
  const pnpmVersionResult = runCommand("pnpm", ["-v"], {
    captureOutput: true,
  });

  if (pnpmVersionResult.status !== 0) {
    const detail = pnpmVersionResult.stderr || pnpmVersionResult.stdout || "pnpm -v failed";
    console.error("[local-pr-gate] Could not read the local pnpm version.");
    console.error(`[local-pr-gate] ${detail.trim()}`);
    return pnpmVersionResult.status ?? 1;
  }

  const pnpmVersion = pnpmVersionResult.stdout.trim();
  const alignment = evaluateRuntimeAlignment({
    nodeVersion: process.version,
    pnpmVersion,
  });

  if (!alignment.isAligned && process.env.SKIP_LOCAL_PR_GATE_VERSION_CHECK !== "1") {
    console.error("[local-pr-gate] Runtime mismatch with GitHub Actions.");
    console.error(
      `[local-pr-gate] Expected Node.js ${REQUIRED_NODE_MAJOR}.x and pnpm ${REQUIRED_PNPM_MAJOR}.x to mirror CI.`,
    );
    for (const problem of alignment.problems) {
      console.error(`[local-pr-gate] ${problem}`);
    }
    console.error("[local-pr-gate] Switch your local runtime, then re-run `pnpm verify:pr-gate`.");
    console.error(
      "[local-pr-gate] If you need a one-off bypass, set SKIP_LOCAL_PR_GATE_VERSION_CHECK=1.",
    );
    return 1;
  }

  if (!alignment.isAligned) {
    console.warn("[local-pr-gate] Version check bypassed via SKIP_LOCAL_PR_GATE_VERSION_CHECK=1.");
  } else {
    console.log(
      `[local-pr-gate] Runtime aligned with CI: Node.js ${process.version}, pnpm ${pnpmVersion}.`,
    );
  }

  const gateResult = runCommand("pnpm", ["verify:manuscript-workbench"]);
  return gateResult.status ?? 1;
}

function runCommand(command, args, options = {}) {
  const baseOptions = {
    cwd: process.cwd(),
    env: process.env,
    stdio: options.captureOutput ? "pipe" : "inherit",
    encoding: "utf8",
  };
  const result =
    process.platform === "win32"
      ? spawnSync(formatShellCommand(command, args), {
          ...baseOptions,
          shell: true,
        })
      : spawnSync(command, args, baseOptions);

  if (result.error) {
    return {
      status: 1,
      stdout: result.stdout ?? "",
      stderr: result.error.message,
    };
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function formatShellCommand(command, args) {
  return [command, ...args.map(quoteShellArg)].join(" ");
}

function quoteShellArg(value) {
  if (!/[\s"&|<>^]/u.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '\\"')}"`;
}

if (process.argv[1] === scriptPath) {
  process.exitCode = main();
}
