import { spawn } from "node:child_process";
import path from "node:path";
import type {
  ManuscriptQualityWorkerAdapter,
  ManuscriptQualityWorkerInput,
  ManuscriptQualityWorkerResult,
} from "./manuscript-quality-types.ts";
import type { ManuscriptQualityIssue } from "@medical/contracts";

const MANUSCRIPT_QUALITY_SCRIPT = path.resolve(
  import.meta.dirname,
  "../../../../worker-py/src/manuscript_quality/run_quality_checks.py",
);

export class ManuscriptQualityWorkerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManuscriptQualityWorkerError";
  }
}

export interface PythonManuscriptQualityWorkerAdapterOptions {
  scriptPath?: string;
  pythonCandidates?: string[];
}

export class PythonManuscriptQualityWorkerAdapter
  implements ManuscriptQualityWorkerAdapter
{
  private readonly scriptPath: string;
  private readonly pythonCandidates: string[];

  constructor(options: PythonManuscriptQualityWorkerAdapterOptions = {}) {
    this.scriptPath = options.scriptPath ?? MANUSCRIPT_QUALITY_SCRIPT;
    this.pythonCandidates = dedupeStrings(
      options.pythonCandidates ?? buildPythonCandidates(),
    );
  }

  async runGeneralProofreading(
    input: ManuscriptQualityWorkerInput,
  ): Promise<ManuscriptQualityWorkerResult> {
    let lastError: Error | undefined;

    for (const pythonBin of this.pythonCandidates) {
      try {
        const raw = await runPythonScript({
          pythonBin,
          scriptPath: this.scriptPath,
          payload: {
            blocks: input.blocks.map((block) => ({ ...block })),
            scope: "general_proofreading",
            ...(input.qualityPackages
              ? {
                  quality_packages: input.qualityPackages.map((entry) => ({
                    package_id: entry.package_id,
                    package_name: entry.package_name,
                    package_kind: entry.package_kind,
                    target_scopes: [...entry.target_scopes],
                    version: entry.version,
                    manifest: structuredClone(entry.manifest),
                  })),
                }
              : {}),
            ...(input.tableSnapshots
              ? {
                  tableSnapshots: input.tableSnapshots.map((table) =>
                    structuredClone(table),
                  ),
                }
              : {}),
          },
        });
        return normalizeWorkerResult(raw);
      } catch (error) {
        if (isCommandMissing(error)) {
          lastError = error;
          continue;
        }

        throw error;
      }
    }

    throw (
      lastError ??
      new ManuscriptQualityWorkerError(
        "No usable Python interpreter was found for manuscript quality checks.",
      )
    );
  }

  async runMedicalSpecialized(
    input: ManuscriptQualityWorkerInput,
  ): Promise<ManuscriptQualityWorkerResult> {
    let lastError: Error | undefined;

    for (const pythonBin of this.pythonCandidates) {
      try {
        const raw = await runPythonScript({
          pythonBin,
          scriptPath: this.scriptPath,
          payload: {
            blocks: input.blocks.map((block) => ({ ...block })),
            scope: "medical_specialized",
            ...(input.qualityPackages
              ? {
                  quality_packages: input.qualityPackages.map((entry) => ({
                    package_id: entry.package_id,
                    package_name: entry.package_name,
                    package_kind: entry.package_kind,
                    target_scopes: [...entry.target_scopes],
                    version: entry.version,
                    manifest: structuredClone(entry.manifest),
                  })),
                }
              : {}),
            ...(input.tableSnapshots
              ? {
                  tableSnapshots: input.tableSnapshots.map((table) =>
                    structuredClone(table),
                  ),
                }
              : {}),
          },
        });
        return normalizeWorkerResult(raw);
      } catch (error) {
        if (isCommandMissing(error)) {
          lastError = error;
          continue;
        }

        throw error;
      }
    }

    throw (
      lastError ??
      new ManuscriptQualityWorkerError(
        "No usable Python interpreter was found for manuscript quality checks.",
      )
    );
  }
}

function buildPythonCandidates(): string[] {
  const configured = process.env.PYTHON_BIN?.trim();
  return [configured, "python", "python3"].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function runPythonScript(input: {
  pythonBin: string;
  scriptPath: string;
  payload: Record<string, unknown>;
}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.pythonBin, [input.scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new ManuscriptQualityWorkerError(
            `Manuscript quality worker failed with exit code ${code ?? "unknown"}: ${stderr.trim() || "No stderr output."}`,
          ),
        );
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(
          new ManuscriptQualityWorkerError(
            `Manuscript quality worker returned invalid JSON: ${stdout.trim() || String(error)}`,
          ),
        );
      }
    });

    child.stdin.write(JSON.stringify(input.payload));
    child.stdin.end();
  });
}

function normalizeWorkerResult(raw: unknown): ManuscriptQualityWorkerResult {
  const record = isRecord(raw) ? raw : {};

  return {
    module_scope:
      record.module_scope === "medical_specialized"
        ? "medical_specialized"
        : "general_proofreading",
    issues: normalizeIssues(record.issues),
    ...(typeof record.normalized_text === "string"
      ? { normalized_text: record.normalized_text }
      : {}),
    ...(Array.isArray(record.paragraph_blocks)
      ? {
          paragraph_blocks: record.paragraph_blocks.map((entry) =>
            isRecord(entry) ? { ...entry } : {},
          ),
        }
      : {}),
    ...(Array.isArray(record.sentence_blocks)
      ? {
          sentence_blocks: record.sentence_blocks.map((entry) =>
            isRecord(entry) ? { ...entry } : {},
          ),
        }
      : {}),
  };
}

function normalizeIssues(value: unknown): ManuscriptQualityIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeIssue)
    .filter((entry): entry is ManuscriptQualityIssue => entry !== undefined);
}

function normalizeIssue(value: unknown): ManuscriptQualityIssue | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (
    typeof value.issue_id !== "string" ||
    typeof value.module_scope !== "string" ||
    typeof value.issue_type !== "string" ||
    typeof value.category !== "string" ||
    typeof value.severity !== "string" ||
    typeof value.action !== "string" ||
    typeof value.confidence !== "number" ||
    typeof value.source_kind !== "string" ||
    typeof value.text_excerpt !== "string" ||
    typeof value.explanation !== "string"
  ) {
    return undefined;
  }

  return structuredClone(value) as unknown as ManuscriptQualityIssue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCommandMissing(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
