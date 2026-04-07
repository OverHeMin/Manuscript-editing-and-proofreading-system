import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import {
  selectDeterministicFormatRules,
} from "../editorial-execution/deterministic-format-rule-executor.ts";
import type {
  ApplyDeterministicDocxRulesInput,
  DeterministicDocxTransformResult,
} from "../editorial-execution/types.ts";

const APPLY_EDITORIAL_RULES_SCRIPT = path.resolve(
  import.meta.dirname,
  "../../../../worker-py/src/document_pipeline/apply_editorial_rules.py",
);
const MATERIALIZE_DOCX_SCRIPT = path.resolve(
  import.meta.dirname,
  "../../../../worker-py/src/document_pipeline/materialize_docx.py",
);

export interface EditorialDocxTransformServiceOptions {
  assetRepository: DocumentAssetRepository;
  rootDir?: string;
}

export class EditorialDocxTransformSourceAssetNotFoundError extends Error {
  constructor(assetId: string) {
    super(`Source DOCX asset ${assetId} was not found for editorial transformation.`);
    this.name = "EditorialDocxTransformSourceAssetNotFoundError";
  }
}

export class EditorialDocxTransformWorkerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditorialDocxTransformWorkerError";
  }
}

export class EditorialDocxTransformService {
  private readonly assetRepository: DocumentAssetRepository;
  private readonly rootDir: string;

  constructor(options: EditorialDocxTransformServiceOptions) {
    this.assetRepository = options.assetRepository;
    this.rootDir =
      options.rootDir ??
      path.resolve(
        process.cwd(),
        ".local-data",
        "uploads",
        process.env.APP_ENV ?? "dev",
      );
  }

  async applyDeterministicRules(
    input: ApplyDeterministicDocxRulesInput,
  ): Promise<DeterministicDocxTransformResult> {
    const sourceAsset = await this.assetRepository.findById(input.sourceAssetId);
    if (!sourceAsset) {
      throw new EditorialDocxTransformSourceAssetNotFoundError(input.sourceAssetId);
    }

    const deterministicRules = selectDeterministicFormatRules(input.rules);
    const sourcePath = resolveStoragePath(this.rootDir, sourceAsset.storage_key);
    const outputPath = resolveStoragePath(this.rootDir, input.outputStorageKey);

    await this.ensureSourceDocxMaterialized(sourceAsset, sourcePath);
    await mkdir(path.dirname(outputPath), { recursive: true });

    if (deterministicRules.length === 0) {
      await copyFile(sourcePath, outputPath);
      return {
        appliedRuleIds: [],
        appliedChanges: [],
      };
    }

    return runApplyRulesWorker({
      sourcePath,
      outputPath,
      rules: deterministicRules,
    });
  }

  private async ensureSourceDocxMaterialized(
    sourceAsset: DocumentAssetRecord,
    sourcePath: string,
  ): Promise<void> {
    try {
      await readFile(sourcePath);
      return;
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }

    await mkdir(path.dirname(sourcePath), { recursive: true });
    await runDocxMaterializer({
      outputPath: sourcePath,
      title: sourceAsset.file_name ?? sourceAsset.id,
      manuscriptId: sourceAsset.manuscript_id,
      assetType: sourceAsset.asset_type,
      sourcePath: await this.resolveNearestSourceDocxPath(sourceAsset),
    });
  }

  private async resolveNearestSourceDocxPath(
    sourceAsset: DocumentAssetRecord,
  ): Promise<string | undefined> {
    const manuscriptAssets = await this.assetRepository.listByManuscriptId(
      sourceAsset.manuscript_id,
    );
    const assetsById = new Map(manuscriptAssets.map((record) => [record.id, record]));
    const visited = new Set<string>();
    let current: DocumentAssetRecord | undefined = sourceAsset;

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      current = current.parent_asset_id
        ? assetsById.get(current.parent_asset_id)
        : undefined;

      if (!current) {
        return undefined;
      }

      const candidatePath = resolveStoragePath(this.rootDir, current.storage_key);
      try {
        await readFile(candidatePath);
        return candidatePath;
      } catch (error) {
        if (!isMissingFileError(error)) {
          throw error;
        }
      }
    }

    return undefined;
  }
}

function buildPythonCandidates(): string[] {
  const configured = process.env.PYTHON_BIN?.trim();
  const candidates = [configured, "python", "python3"].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return [...new Set(candidates)];
}

async function runApplyRulesWorker(input: {
  sourcePath: string;
  outputPath: string;
  rules: unknown[];
}): Promise<DeterministicDocxTransformResult> {
  let lastError: Error | undefined;

  for (const pythonBin of buildPythonCandidates()) {
    try {
      return await runPythonScript(pythonBin, input);
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
    new EditorialDocxTransformWorkerError(
      "No usable Python interpreter was found for deterministic DOCX transforms.",
    )
  );
}

function runPythonScript(
  pythonBin: string,
  input: {
    sourcePath: string;
    outputPath: string;
    rules: unknown[];
  },
): Promise<DeterministicDocxTransformResult> {
  return new Promise((resolve, reject) => {
    const args = [
      APPLY_EDITORIAL_RULES_SCRIPT,
      "--source-path",
      input.sourcePath,
      "--output-path",
      input.outputPath,
      "--rules-json",
      JSON.stringify(input.rules),
    ];

    const child = spawn(pythonBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
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
          new EditorialDocxTransformWorkerError(
            `Deterministic DOCX transform failed with exit code ${code ?? "unknown"}: ${stderr.trim() || "No stderr output."}`,
          ),
        );
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as DeterministicDocxTransformResult;
        resolve({
          appliedRuleIds: [...(parsed.appliedRuleIds ?? [])],
          appliedChanges: [...(parsed.appliedChanges ?? [])],
        });
      } catch (error) {
        reject(
          new EditorialDocxTransformWorkerError(
            `Deterministic DOCX transform returned invalid JSON: ${stdout.trim() || String(error)}`,
          ),
        );
      }
    });
  });
}

async function runDocxMaterializer(input: {
  outputPath: string;
  title: string;
  manuscriptId: string;
  assetType: string;
  sourcePath?: string;
}): Promise<void> {
  let lastError: Error | undefined;

  for (const pythonBin of buildPythonCandidates()) {
    try {
      await runMaterializerScript(pythonBin, input);
      return;
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
    new EditorialDocxTransformWorkerError(
      "No usable Python interpreter was found for DOCX materialization.",
    )
  );
}

function runMaterializerScript(
  pythonBin: string,
  input: {
    outputPath: string;
    title: string;
    manuscriptId: string;
    assetType: string;
    sourcePath?: string;
  },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      MATERIALIZE_DOCX_SCRIPT,
      "--output-path",
      input.outputPath,
      "--title",
      input.title,
      "--manuscript-id",
      input.manuscriptId,
      "--asset-type",
      input.assetType,
    ];

    if (input.sourcePath) {
      args.push("--source-path", input.sourcePath);
    }

    const child = spawn(pythonBin, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new EditorialDocxTransformWorkerError(
          `DOCX materialization failed with exit code ${code ?? "unknown"}: ${stderr.trim() || "No stderr output."}`,
        ),
      );
    });
  });
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
    throw new EditorialDocxTransformWorkerError(
      `Resolved asset path escaped the configured root: "${storageKey}".`,
    );
  }

  return absolutePath;
}

function isCommandMissing(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
