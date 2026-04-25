import { extname } from "node:path";

export function buildDownloadContentDispositionHeader(fileName: string): string {
  const sanitizedFileName = sanitizeDownloadFileName(fileName);
  return [
    `attachment; filename="${buildAsciiDownloadFileNameFallback(sanitizedFileName)}"`,
    `filename*=UTF-8''${encodeRfc5987Value(sanitizedFileName)}`,
  ].join("; ");
}

function buildAsciiDownloadFileNameFallback(fileName: string): string {
  const explicitExtension = extname(fileName);
  const normalizedExtension = /^[.][A-Za-z0-9]{1,16}$/u.test(explicitExtension)
    ? explicitExtension
    : "";
  const baseName = normalizedExtension
    ? fileName.slice(0, -normalizedExtension.length)
    : fileName;
  const asciiBaseName = baseName
    .replace(/[^\x20-\x7E]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[^A-Za-z0-9!#$&+.^_`|~-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${asciiBaseName || "download"}${normalizedExtension}`;
}

function sanitizeDownloadFileName(fileName: string): string {
  return fileName.replace(/["\\]/g, "-");
}

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
