export interface BrowserUploadFile {
  name: string;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface InlineUploadFields {
  fileName: string;
  mimeType: string;
  fileContentBase64: string;
}

export async function createInlineUploadFields(
  file: BrowserUploadFile,
): Promise<InlineUploadFields> {
  return {
    fileName: file.name.trim() || "upload.bin",
    mimeType: file.type.trim() || "application/octet-stream",
    fileContentBase64: encodeArrayBufferToBase64(await file.arrayBuffer()),
  };
}

function encodeArrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  // Chunk the conversion so larger uploads do not exceed the browser's
  // argument limits when building the base64 source string.
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary);
}
