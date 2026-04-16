import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  deletePathWithRetries,
  extractListeningPort,
  isRepoLocalProcess,
  removeEmptyCodexLogDirectories,
  summarizeCodexLogTargets,
} from "./codex-log-cleanup.mjs";

test("extractListeningPort reads the persistent API port from codex logs", () => {
  assert.equal(
    extractListeningPort(
      "[api] persistent runtime listening on http://127.0.0.1:3005 (development)",
    ),
    3005,
  );
});

test("extractListeningPort reads the Vite local port from codex logs", () => {
  assert.equal(
    extractListeningPort(`

  VITE v5.4.21 ready in 357 ms

  Local:   http://localhost:\u001b[1m4274\u001b[22m/
`),
    4274,
  );
});

test("isRepoLocalProcess only accepts command lines anchored inside the repo", () => {
  const repoRoot = "C:\\repo";

  assert.equal(
    isRepoLocalProcess({
      repoRoot,
      commandLine:
        'node "C:\\repo\\apps\\api\\node_modules\\.bin\\..\\tsx\\dist\\cli.mjs" "./src/http/prod-server.ts"',
    }),
    true,
  );
  assert.equal(
    isRepoLocalProcess({
      repoRoot,
      commandLine: 'node "C:\\other\\workspace\\apps\\api\\src\\http\\prod-server.ts"',
    }),
    false,
  );
});

test("summarizeCodexLogTargets plans safe cleanup for repo-local listeners", () => {
  const repoRoot = "C:\\repo";
  const summary = summarizeCodexLogTargets({
    repoRoot,
    logFiles: [
      {
        path: "C:\\repo\\apps\\api\\.codex-logs\\stage6-api.log",
        content:
          "[api] persistent runtime listening on http://127.0.0.1:3005 (development)",
      },
      {
        path: "C:\\repo\\apps\\web\\.codex-logs\\acceptance-web.out.log",
        content: `
  VITE v5.4.21 ready in 357 ms
  Local:   http://localhost:4274/
`,
      },
    ],
    listenersByPort: new Map([
      [
        3005,
        {
          pid: 32800,
          commandLine:
            'node "C:\\repo\\apps\\api\\node_modules\\.bin\\..\\tsx\\dist\\cli.mjs" "./src/http/prod-server.ts"',
        },
      ],
      [
        4274,
        {
          pid: 32872,
          commandLine:
            'node "C:\\repo\\apps\\web\\node_modules\\.bin\\..\\vite\\bin\\vite.js" "--host" "127.0.0.1" "--port" "4274"',
        },
      ],
    ]),
  });

  assert.deepEqual(summary, [
    {
      path: "C:\\repo\\apps\\api\\.codex-logs\\stage6-api.log",
      directoryPath: "C:\\repo\\apps\\api\\.codex-logs",
      port: 3005,
      pid: 32800,
      action: "stop_process_then_delete",
      reason: "repo-local listener discovered from codex log",
    },
    {
      path: "C:\\repo\\apps\\web\\.codex-logs\\acceptance-web.out.log",
      directoryPath: "C:\\repo\\apps\\web\\.codex-logs",
      port: 4274,
      pid: 32872,
      action: "stop_process_then_delete",
      reason: "repo-local listener discovered from codex log",
    },
  ]);
});

test("summarizeCodexLogTargets keeps cleanup read-only when the listener is not repo-local", () => {
  const summary = summarizeCodexLogTargets({
    repoRoot: "C:\\repo",
    logFiles: [
      {
        path: "C:\\repo\\apps\\api\\.codex-logs\\stage6-api.log",
        content:
          "[api] persistent runtime listening on http://127.0.0.1:3005 (development)",
      },
    ],
    listenersByPort: new Map([
      [
        3005,
        {
          pid: 12,
          commandLine: 'node "C:\\other\\workspace\\prod-server.ts"',
        },
      ],
    ]),
  });

  assert.deepEqual(summary, [
    {
      path: "C:\\repo\\apps\\api\\.codex-logs\\stage6-api.log",
      directoryPath: "C:\\repo\\apps\\api\\.codex-logs",
      port: 3005,
      pid: 12,
      action: "delete_requires_manual_process_review",
      reason: "listener exists but is not anchored inside this repo",
    },
  ]);
});

test("deletePathWithRetries retries transient EBUSY failures", async () => {
  let attempts = 0;

  await deletePathWithRetries("C:\\repo\\apps\\web\\.codex-logs\\acceptance-web-admin.log", {
    maxAttempts: 3,
    delayMs: 0,
    removePath(targetPath) {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error(`busy: ${targetPath}`);
        error.code = "EBUSY";
        throw error;
      }
    },
  });

  assert.equal(attempts, 2);
});

test("removeEmptyCodexLogDirectories removes nested empty codex log folders", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-log-cleanup-"));
  const codexLogRoot = path.join(tempRoot, "apps", "web", ".codex-logs");
  const acceptanceDir = path.join(codexLogRoot, "acceptance");
  const acceptanceLoadedDir = path.join(codexLogRoot, "acceptance-loaded");
  fs.mkdirSync(acceptanceDir, { recursive: true });
  fs.mkdirSync(acceptanceLoadedDir, { recursive: true });

  const deleted = removeEmptyCodexLogDirectories([codexLogRoot]);

  assert.deepEqual(
    deleted.sort(),
    [acceptanceDir, acceptanceLoadedDir, codexLogRoot].sort(),
  );
  assert.equal(fs.existsSync(codexLogRoot), false);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});
