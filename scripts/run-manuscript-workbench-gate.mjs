import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pnpmCommand = "pnpm";
const useShell = process.platform === "win32";

const steps = [
  {
    label: "API typecheck",
    command: pnpmCommand,
    args: ["--filter", "@medical/api", "run", "typecheck"],
  },
  {
    label: "Web typecheck",
    command: pnpmCommand,
    args: ["--filter", "@medsys/web", "run", "typecheck"],
  },
  {
    label: "API manuscript export and workbench HTTP tests",
    command: pnpmCommand,
    args: [
      "--filter",
      "@medical/api",
      "exec",
      "node",
      "--import",
      "tsx",
      "--test",
      "test/document-pipeline/document-export.spec.ts",
      "test/http/workbench-http.spec.ts",
      "test/http/persistent-workbench-http.spec.ts",
    ],
  },
  {
    label: "Web manuscript, admin governance, and evaluation workbench tests",
    command: pnpmCommand,
    args: [
      "--filter",
      "@medsys/web",
      "exec",
      "node",
      "--import",
      "tsx",
      "--test",
      "test/admin-governance-controller.spec.ts",
      "test/agent-execution-evidence-view.spec.tsx",
      "test/agent-tooling-governance-section.spec.tsx",
      "test/manuscript-workbench-routing.spec.ts",
      "test/evaluation-workbench-controller.spec.ts",
      "test/evaluation-workbench-page.spec.tsx",
      "test/manuscript-workbench-controller.spec.ts",
      "test/manuscript-workbench-page.spec.tsx",
      "test/manuscript-workbench-summary.spec.tsx",
    ],
  },
  {
    label: "Browser evaluation workbench smoke",
    command: pnpmCommand,
    args: [
      "--filter",
      "@medsys/web",
      "run",
      "test:browser",
      "--",
      "--browser=chromium",
      "playwright/evaluation-workbench.spec.ts",
    ],
  },
  {
    label: "Browser admin governance smoke",
    command: pnpmCommand,
    args: [
      "--filter",
      "@medsys/web",
      "run",
      "test:browser",
      "--",
      "--browser=chromium",
      "playwright/admin-governance.spec.ts",
    ],
  },
  {
    label: "Browser manuscript handoff smoke",
    command: pnpmCommand,
    args: [
      "--filter",
      "@medsys/web",
      "run",
      "test:browser",
      "--",
      "--browser=chromium",
      "playwright/manuscript-handoff.spec.ts",
    ],
  },
  {
    label: "Browser learning review smoke",
    command: pnpmCommand,
    args: [
      "--filter",
      "@medsys/web",
      "run",
      "test:browser",
      "--",
      "--browser=chromium",
      "playwright/learning-review-flow.spec.ts",
    ],
  },
  {
    label: "Browser knowledge review handoff smoke",
    command: pnpmCommand,
    args: [
      "--filter",
      "@medsys/web",
      "run",
      "test:browser",
      "--",
      "--browser=chromium",
      "playwright/knowledge-review-handoff.spec.ts",
    ],
  },
];

for (const step of steps) {
  console.log(`\n==> ${step.label}`);
  const result = useShell
    ? spawnSync(formatShellCommand(step.command, step.args), {
        cwd: repoRoot,
        stdio: "inherit",
        env: process.env,
        shell: true,
      })
    : spawnSync(step.command, step.args, {
        cwd: repoRoot,
        stdio: "inherit",
        env: process.env,
      });

  if (result.error) {
    console.error(`Step failed before execution: ${step.label}`);
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nManuscript workbench release gate passed.");

function formatShellCommand(command, args) {
  return [command, ...args.map(quoteShellArg)].join(" ");
}

function quoteShellArg(value) {
  if (!/[\s"&|<>^]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}
