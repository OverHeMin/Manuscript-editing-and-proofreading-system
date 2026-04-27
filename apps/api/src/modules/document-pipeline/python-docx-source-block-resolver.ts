import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import type {
  EditorialSourceBlockResolver,
  EditorialTextBlock,
  ProofreadingSourceBlockResolver,
} from "../editorial-execution/types.ts";
import {
  buildPythonCommandCandidates,
  buildWorkspaceChildProcessEnv,
  isCommandUnavailableError,
} from "../shared/windows-command-runtime.ts";
import {
  normalizeRawDocxBlock,
  type RawDocxBlockRecord,
} from "./docx-metadata-hunter.ts";

const EXTRACT_DOCX_STRUCTURE_SCRIPT = path.resolve(
  import.meta.dirname,
  "../../../../worker-py/src/document_pipeline/extract_docx_structure.py",
);

export interface PythonDocxSourceBlockResolverOptions {
  assetRepository: DocumentAssetRepository;
  rootDir: string;
  workerRunner?: (sourcePath: string) => Promise<unknown>;
  legacyDocConverter?: (input: {
    sourcePath: string;
    outputDir: string;
  }) => Promise<{ status: "converted" | "tool_unavailable" | "failed"; outputPath?: string; error?: string }>;
}

export class PythonDocxSourceBlockResolver
  implements EditorialSourceBlockResolver, ProofreadingSourceBlockResolver
{
  private readonly assetRepository: DocumentAssetRepository;
  private readonly rootDir: string;
  private readonly workerRunner: (sourcePath: string) => Promise<unknown>;
  private readonly legacyDocConverter?: NonNullable<
    PythonDocxSourceBlockResolverOptions["legacyDocConverter"]
  >;

  constructor(options: PythonDocxSourceBlockResolverOptions) {
    this.assetRepository = options.assetRepository;
    this.rootDir = path.resolve(options.rootDir);
    this.workerRunner = options.workerRunner ?? runWorker;
    this.legacyDocConverter = options.legacyDocConverter ?? convertLegacyDocWithPython;
  }

  async resolveBlocks(input: {
    manuscriptId: string;
    assetId: string;
  }): Promise<EditorialTextBlock[]> {
    const asset = await this.assetRepository.findById(input.assetId);
    if (!asset) {
      return [];
    }

    const sourcePath = resolveStoragePath(this.rootDir, asset.storage_key);
    try {
      await readFile(sourcePath);
    } catch (error) {
      if (isMissingFileError(error)) {
        return [];
      }

      throw error;
    }

    const readableSourcePath = await this.resolveReadableDocxSourcePath({
      asset,
      sourcePath,
    });
    if (!readableSourcePath) {
      return [];
    }

    const raw = await this.workerRunner(readableSourcePath);
    return normalizeBlocks(raw);
  }

  private async resolveReadableDocxSourcePath(input: {
    asset: {
      id: string;
      manuscript_id: string;
      file_name?: string;
      mime_type: string;
    };
    sourcePath: string;
  }): Promise<string | undefined> {
    if (!isLegacyDocAsset(input.asset)) {
      return input.sourcePath;
    }

    const outputDir = path.join(
      this.rootDir,
      ".normalized-cache",
      input.asset.manuscript_id,
      input.asset.id,
    );
    await mkdir(outputDir, { recursive: true });
    const conversion = await this.legacyDocConverter?.({
      sourcePath: input.sourcePath,
      outputDir,
    });
    if (conversion?.status !== "converted" || !conversion.outputPath) {
      return undefined;
    }

    return conversion.outputPath;
  }
}

function isLegacyDocAsset(asset: {
  file_name?: string;
  mime_type: string;
}): boolean {
  return (
    asset.file_name?.toLowerCase().endsWith(".doc") === true ||
    asset.mime_type === "application/msword"
  );
}

function normalizeBlocks(raw: unknown): EditorialTextBlock[] {
  const record = isRecord(raw) ? raw : {};
  const blocks = Array.isArray(record.blocks) ? record.blocks : [];
  const normalized: EditorialTextBlock[] = [];
  let currentSection = "front_matter";

  for (const entry of blocks) {
    const block = normalizeRawDocxBlock(entry);
    if (!block) {
      continue;
    }

    const headingText = readBlockHeadingText(block);
    if (headingText) {
      const headingSection = classifyHeadingSectionKey(headingText, readHeadingToken(headingText));
      const blockSection = resolveBlockSection(block, currentSection, headingSection);
      if (blockSection === headingSection) {
        currentSection = headingSection;
      }
      normalized.push({
        text: headingText,
        section: blockSection,
        block_kind: "heading",
        ...(block.source_zone ? { source_zone: block.source_zone } : {}),
        ...(block.source_locator ? { source_locator: block.source_locator } : {}),
        ...(block.semantic_role ? { semantic_role: block.semantic_role } : {}),
        ...(block.confidence != null ? { confidence: block.confidence } : {}),
      });
      continue;
    }

    if (block.kind === "paragraph") {
      const text = readOptionalString(block.text);
      if (!text) {
        continue;
      }
      const blockSection = resolveBlockSection(block, currentSection);

      normalized.push({
        text,
        section: blockSection,
        block_kind: blockSection === "reference" ? "reference_entry" : "paragraph",
        ...(block.source_zone ? { source_zone: block.source_zone } : {}),
        ...(block.source_locator ? { source_locator: block.source_locator } : {}),
        ...(block.semantic_role ? { semantic_role: block.semantic_role } : {}),
        ...(block.confidence != null ? { confidence: block.confidence } : {}),
      });
      continue;
    }

    if (block.kind === "table") {
      const text =
        readOptionalString(block.caption) ??
        `table-${typeof block.table_index === "number" ? block.table_index + 1 : normalized.length + 1}`;
      const blockSection = resolveBlockSection(block, currentSection);
      normalized.push({
        text,
        section: blockSection,
        block_kind: "table",
        ...(block.source_zone ? { source_zone: block.source_zone } : {}),
        ...(block.source_locator ? { source_locator: block.source_locator } : {}),
        ...(block.semantic_role ? { semantic_role: block.semantic_role } : {}),
        ...(block.confidence != null ? { confidence: block.confidence } : {}),
      });
    }
  }

  return normalized;
}

function resolveBlockSection(
  block: RawDocxBlockRecord,
  currentSection: string,
  fallbackSection = currentSection,
): string {
  if (block.source_zone === "header" || block.source_zone === "footer") {
    return "front_matter";
  }

  return fallbackSection;
}

function readBlockHeadingText(block: RawDocxBlockRecord): string | undefined {
  if (block.kind === "heading") {
    return block.heading ?? block.text;
  }

  if (block.kind !== "paragraph") {
    return undefined;
  }

  const text = block.text ?? "";
  const normalized = normalizeSemanticText(text);
  if (
    isReferenceHeading(normalized) ||
    isAbstractLine(normalized) ||
    isKeywordLine(normalized) ||
    isResultsHeading(normalized) ||
    looksLikeSectionHeading(text)
  ) {
    return text;
  }

  return undefined;
}

function classifyHeadingSectionKey(
  text: string,
  headingToken?: string,
): string {
  const normalized = normalizeSemanticText(text);
  if (isReferenceHeading(normalized)) {
    return "reference";
  }
  if (isAbstractLine(normalized) || isKeywordLine(normalized)) {
    return "abstract";
  }
  if (
    (headingToken && headingToken.startsWith("2")) ||
    isResultsHeading(normalized)
  ) {
    return "results";
  }
  return "body";
}

function looksLikeSectionHeading(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 80) {
    return false;
  }

  return /^(\d+(?:\.\d+)*)\s+\S+/u.test(trimmed);
}

function readHeadingToken(text: string): string | undefined {
  return text.trim().match(/^(\d+(?:\.\d+)*)/u)?.[1];
}

function normalizeSemanticText(value: string): string {
  return value.trim().toLowerCase().replaceAll(/\s+/gu, "");
}

function isReferenceHeading(normalized: string): boolean {
  return normalized.includes("\u53c2\u8003\u6587\u732e") || normalized.includes("references");
}

function isAbstractLine(normalized: string): boolean {
  return normalized.includes("\u6458\u8981") || normalized.includes("abstract");
}

function isKeywordLine(normalized: string): boolean {
  return normalized.includes("\u5173\u952e\u8bcd") || normalized.includes("keyword");
}

function isResultsHeading(normalized: string): boolean {
  return (
    normalized === "results" ||
    normalized === "result" ||
    normalized === "\u7ed3\u679c" ||
    normalized === "resultsanddiscussion" ||
    normalized === "\u7ed3\u679c\u4e0e\u8ba8\u8bba"
  );
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
    throw new Error(`Resolved asset path escaped the configured root: "${storageKey}".`);
  }

  return absolutePath;
}

async function runWorker(sourcePath: string): Promise<unknown> {
  let lastError: Error | undefined;

  for (const pythonBin of buildPythonCommandCandidates()) {
    try {
      return await runPythonScript(pythonBin, sourcePath);
    } catch (error) {
      if (isCommandUnavailableError(error)) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw (
    lastError ??
    new Error("No usable Python interpreter was found for DOCX source block extraction.")
  );
}

async function convertLegacyDocWithPython(input: {
  sourcePath: string;
  outputDir: string;
}): Promise<{
  status: "converted" | "tool_unavailable" | "failed";
  outputPath?: string;
  error?: string;
}> {
  let lastError: Error | undefined;

  for (const pythonBin of buildPythonCommandCandidates()) {
    try {
      return await runLegacyDocConversionScript(pythonBin, input);
    } catch (error) {
      if (isCommandUnavailableError(error)) {
        lastError = error;
        continue;
      }

      return {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    status: "tool_unavailable",
    error: lastError?.message ?? "No usable Python interpreter was found.",
  };
}

function runLegacyDocConversionScript(
  pythonBin: string,
  input: {
    sourcePath: string;
    outputDir: string;
  },
): Promise<{
  status: "converted" | "tool_unavailable" | "failed";
  outputPath?: string;
  error?: string;
}> {
  const workerRoot = path.resolve(
    import.meta.dirname,
    "../../../../worker-py",
  );
  const script = `
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(${JSON.stringify(workerRoot)}).resolve() / "src"))
from document_pipeline.normalize import run_libreoffice_conversion
result = run_libreoffice_conversion(${JSON.stringify(input.sourcePath)}, ${JSON.stringify(input.outputDir)}, {})
print(json.dumps({
  "status": result.get("status"),
  "outputPath": result.get("output_path"),
  "error": result.get("error"),
}, ensure_ascii=False))
`;

  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, ["-c", script], {
      stdio: ["ignore", "pipe", "pipe"],
      env: buildPythonDocumentPipelineEnv(),
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Legacy DOC conversion failed with exit code ${code ?? "unknown"}: ${stderr.trim() || "No stderr output."}`,
          ),
        );
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as {
          status?: string;
          outputPath?: string;
          error?: string;
        };
        if (parsed.status === "converted" && parsed.outputPath) {
          resolve({
            status: "converted",
            outputPath: parsed.outputPath,
          });
          return;
        }
        resolve({
          status: parsed.status === "tool_unavailable" ? "tool_unavailable" : "failed",
          error: parsed.error,
        });
      } catch (error) {
        reject(
          new Error(
            `Legacy DOC conversion returned invalid JSON: ${String(error)}${
              stdout.trim() ? `\n${stdout.trim()}` : ""
            }`,
          ),
        );
      }
    });
  });
}

function runPythonScript(pythonBin: string, sourcePath: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      pythonBin,
      [EXTRACT_DOCX_STRUCTURE_SCRIPT, "--source-path", sourcePath],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: buildPythonDocumentPipelineEnv(),
      },
    );
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `DOCX source block extraction failed with exit code ${code ?? "unknown"}: ${stderr.trim() || "No stderr output."}`,
          ),
        );
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(
          new Error(
            `DOCX source block extraction returned invalid JSON: ${String(error)}${
              stdout.trim() ? `\n${stdout.trim()}` : ""
            }`,
          ),
        );
      }
    });
  });
}

function buildPythonDocumentPipelineEnv(): NodeJS.ProcessEnv {
  return {
    ...buildWorkspaceChildProcessEnv(),
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
  };
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}
