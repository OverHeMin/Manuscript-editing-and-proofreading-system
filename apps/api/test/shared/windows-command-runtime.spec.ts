import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPythonCommandCandidates,
  buildWorkspaceChildProcessEnv,
  isCommandUnavailableError,
} from "../../src/modules/shared/windows-command-runtime.ts";

test("buildPythonCommandCandidates prefers PYTHON_BIN and removes duplicates", () => {
  assert.deepEqual(
    buildPythonCommandCandidates({
      env: {
        PYTHON_BIN: "C:\\Tools\\Python312\\python.exe",
      },
    }),
    ["C:\\Tools\\Python312\\python.exe", "python", "python3"],
  );

  assert.deepEqual(
    buildPythonCommandCandidates({
      env: {
        PYTHON_BIN: "python",
      },
    }),
    ["python", "python3"],
  );
});

test("isCommandUnavailableError treats Windows access-denied alias failures as retriable", () => {
  assert.equal(
    isCommandUnavailableError(
      {
        code: "EPERM",
        message:
          "spawn C:\\Users\\Min\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe Access is denied",
      },
      { platform: "win32" },
    ),
    true,
  );

  assert.equal(
    isCommandUnavailableError(
      {
        code: "ENOENT",
        message: "spawn python ENOENT",
      },
      { platform: "linux" },
    ),
    true,
  );

  assert.equal(
    isCommandUnavailableError(
      {
        code: "EPERM",
        message: "permission denied while reading a user document",
      },
      { platform: "linux" },
    ),
    false,
  );
});

test("buildWorkspaceChildProcessEnv prepends the repo-local CLI bin and safe defaults on Windows", () => {
  const repoRoot = "C:\\workspace\\medical-manuscript-system";
  const env = buildWorkspaceChildProcessEnv({
    repoRoot,
    baseEnv: {
      Path: "C:\\Users\\Min\\AppData\\Local\\Microsoft\\WindowsApps;C:\\Program Files\\Git\\cmd",
      APP_ENV: "development",
    },
    platform: "win32",
    pathExists(candidatePath) {
      return candidatePath === "C:\\Program Files\\LibreOffice\\program\\python.exe";
    },
  });

  assert.equal(
    env.Path,
    [
      "C:\\workspace\\medical-manuscript-system\\.codex-runtime\\windows-cli\\bin",
      "C:\\Users\\Min\\AppData\\Local\\Microsoft\\WindowsApps",
      "C:\\Program Files\\Git\\cmd",
    ].join(";"),
  );
  assert.equal(
    env.CODEX_WINDOWS_CLI_BIN,
    "C:\\workspace\\medical-manuscript-system\\.codex-runtime\\windows-cli\\bin",
  );
  assert.equal(
    env.GH_CONFIG_DIR,
    "C:\\workspace\\medical-manuscript-system\\.codex-runtime\\windows-cli\\gh-config",
  );
  assert.equal(
    env.PNPM_HOME,
    "C:\\workspace\\medical-manuscript-system\\.codex-runtime\\windows-cli\\pnpm-home",
  );
  assert.equal(env.npm_config_manage_package_manager_versions, "false");
  assert.equal(
    env.PYTHON_BIN,
    "C:\\Program Files\\LibreOffice\\program\\python.exe",
  );
  assert.equal(env.APP_ENV, "development");
});
