import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  buildWorkspaceChildProcessEnv,
  isCommandUnavailableError,
} from "../shared/windows-command-runtime.ts";
import type {
  DocumentConversionResult,
  DocumentToDocxConverter,
} from "./document-normalization-service.ts";

export interface LocalDocToDocxConverterOptions {
  rootDir: string;
  libreOfficeBinary?: string;
}

export class LocalDocToDocxConverter implements DocumentToDocxConverter {
  private readonly rootDir: string;
  private readonly libreOfficeBinary: string;

  constructor(options: LocalDocToDocxConverterOptions) {
    this.rootDir = path.resolve(options.rootDir);
    this.libreOfficeBinary = options.libreOfficeBinary?.trim() || "soffice";
  }

  async convertDocToDocx(input: {
    sourceStorageKey: string;
    targetStorageKey: string;
  }): Promise<DocumentConversionResult> {
    const sourcePath = resolveStoragePath(this.rootDir, input.sourceStorageKey);
    const targetPath = resolveStoragePath(this.rootDir, input.targetStorageKey);
    const outputDir = path.dirname(targetPath);

    await mkdir(outputDir, { recursive: true });

    const result = await runLibreOfficeConversion({
      binary: this.libreOfficeBinary,
      sourcePath,
      outputDir,
    });

    if (result.status !== "converted") {
      return result;
    }

    return {
      status: "converted",
    };
  }
}

async function runLibreOfficeConversion(input: {
  binary: string;
  sourcePath: string;
  outputDir: string;
}): Promise<DocumentConversionResult> {
  const args = [
    "--headless",
    "--convert-to",
    "docx",
    "--outdir",
    input.outputDir,
    input.sourcePath,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(input.binary, args, {
      env: buildWorkspaceChildProcessEnv(),
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      if (isCommandUnavailableError(error)) {
        resolve({
          status: "tool_unavailable",
          error: "LibreOffice unavailable; doc to docx normalization deferred.",
        });
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({
          status: "converted",
        });
        return;
      }

      resolve({
        status: "failed",
        error:
          stderr.trim() ||
          stdout.trim() ||
          `LibreOffice conversion failed with exit code ${code ?? "unknown"}.`,
      });
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

  if (!absolutePath.startsWith(rootDir)) {
    throw new Error(`Resolved asset path escaped the configured root: "${storageKey}".`);
  }

  return absolutePath;
}
