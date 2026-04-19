import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import type {
  EditorialSourceBlockResolver,
  EditorialTextBlock,
  ProofreadingSourceBlockResolver,
} from "../editorial-execution/types.ts";

const EXTRACT_DOCX_STRUCTURE_SCRIPT = path.resolve(
  import.meta.dirname,
  "../../../../worker-py/src/document_pipeline/extract_docx_structure.py",
);

export interface PythonDocxSourceBlockResolverOptions {
  assetRepository: DocumentAssetRepository;
  rootDir: string;
  workerRunner?: (sourcePath: string) => Promise<unknown>;
}

interface RawDocxBlockRecord {
  kind: string;
  text?: string;
  heading?: string;
  caption?: string | null;
  table_index?: number;
}

export class PythonDocxSourceBlockResolver
  implements EditorialSourceBlockResolver, ProofreadingSourceBlockResolver
{
  private readonly assetRepository: DocumentAssetRepository;
  private readonly rootDir: string;
  private readonly workerRunner: (sourcePath: string) => Promise<unknown>;

  constructor(options: PythonDocxSourceBlockResolverOptions) {
    this.assetRepository = options.assetRepository;
    this.rootDir = path.resolve(options.rootDir);
    this.workerRunner = options.workerRunner ?? runWorker;
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

    try {
      const raw = await this.workerRunner(sourcePath);
      return normalizeBlocks(raw);
    } catch {
      return [];
    }
  }
}

function normalizeBlocks(raw: unknown): EditorialTextBlock[] {
  const record = isRecord(raw) ? raw : {};
  const blocks = Array.isArray(record.blocks) ? record.blocks : [];
  const normalized: EditorialTextBlock[] = [];
  let currentSection = "front_matter";

  for (const entry of blocks) {
    const block = normalizeRawBlock(entry);
    if (!block) {
      continue;
    }

    const headingText = readBlockHeadingText(block);
    if (headingText) {
      currentSection = classifyHeadingSectionKey(headingText, readHeadingToken(headingText));
      normalized.push({
        text: headingText,
        section: currentSection,
        block_kind: "heading",
      });
      continue;
    }

    if (block.kind === "paragraph") {
      const text = readOptionalString(block.text);
      if (!text) {
        continue;
      }

      normalized.push({
        text,
        section: currentSection,
        block_kind: currentSection === "reference" ? "reference_entry" : "paragraph",
      });
      continue;
    }

    if (block.kind === "table") {
      const text =
        readOptionalString(block.caption) ??
        `table-${typeof block.table_index === "number" ? block.table_index + 1 : normalized.length + 1}`;
      normalized.push({
        text,
        section: currentSection,
        block_kind: "table",
      });
    }
  }

  return normalized;
}

function normalizeRawBlock(value: unknown): RawDocxBlockRecord | undefined {
  const record = isRecord(value) ? value : undefined;
  if (!record || typeof record.kind !== "string") {
    return undefined;
  }

  return {
    kind: record.kind,
    text: readOptionalString(record.text),
    heading: readOptionalString(record.heading),
    caption: readOptionalString(record.caption) ?? null,
    table_index:
      typeof record.table_index === "number" && Number.isFinite(record.table_index)
        ? record.table_index
        : undefined,
  };
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

function buildPythonCandidates(): string[] {
  const configured = process.env.PYTHON_BIN?.trim();
  const candidates = [configured, "python", "python3"].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return [...new Set(candidates)];
}

async function runWorker(sourcePath: string): Promise<unknown> {
  let lastError: Error | undefined;

  for (const pythonBin of buildPythonCandidates()) {
    try {
      return await runPythonScript(pythonBin, sourcePath);
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
    new Error("No usable Python interpreter was found for DOCX source block extraction.")
  );
}

function runPythonScript(pythonBin: string, sourcePath: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      pythonBin,
      [EXTRACT_DOCX_STRUCTURE_SCRIPT, "--source-path", sourcePath],
      {
        stdio: ["ignore", "pipe", "pipe"],
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

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCommandMissing(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}
