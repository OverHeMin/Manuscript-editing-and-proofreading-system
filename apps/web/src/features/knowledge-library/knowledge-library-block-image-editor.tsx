import type {
  KnowledgeContentBlockViewModel,
  KnowledgeUploadInput,
  KnowledgeUploadViewModel,
} from "./types.ts";

export interface KnowledgeLibraryBlockImageEditorProps {
  block: KnowledgeContentBlockViewModel;
  onChange: (nextBlock: KnowledgeContentBlockViewModel) => void;
  onUploadImage?: (input: KnowledgeUploadInput) => Promise<KnowledgeUploadViewModel | void>;
}

export function KnowledgeLibraryBlockImageEditor({
  block,
  onChange,
  onUploadImage,
}: KnowledgeLibraryBlockImageEditorProps) {
  const fileName =
    typeof block.content_payload.file_name === "string"
      ? block.content_payload.file_name
      : "No image uploaded";
  const mimeType =
    typeof block.content_payload.mime_type === "string"
      ? block.content_payload.mime_type
      : "image/*";
  const byteLength =
    typeof block.content_payload.byte_length === "number"
      ? `${block.content_payload.byte_length} bytes`
      : "Unknown size";
  const storageKey =
    typeof block.content_payload.storage_key === "string"
      ? block.content_payload.storage_key
      : "Storage key pending upload";

  return (
    <div className="knowledge-library-block-editor knowledge-library-block-image-editor">
      <div className="knowledge-library-block-image-meta">
        <strong>{fileName}</strong>
        <small>{mimeType}</small>
        <small>{byteLength}</small>
        <small>{storageKey}</small>
      </div>

      <label>
        Upload Image
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (!file || !onUploadImage) {
              return;
            }

            void handleFileUpload({
              file,
              block,
              onChange,
              onUploadImage,
            });
          }}
        />
      </label>

      <label>
        Image Caption
        <input
          value={
            typeof block.content_payload.caption === "string"
              ? block.content_payload.caption
              : ""
          }
          onChange={(event) =>
            onChange({
              ...block,
              content_payload: {
                ...block.content_payload,
                caption: event.target.value,
              },
            })
          }
          placeholder="Describe what the image explains"
        />
      </label>
    </div>
  );
}

async function handleFileUpload(input: {
  file: File;
  block: KnowledgeContentBlockViewModel;
  onChange: (nextBlock: KnowledgeContentBlockViewModel) => void;
  onUploadImage: (payload: KnowledgeUploadInput) => Promise<KnowledgeUploadViewModel | void>;
}) {
  const fileContentBase64 = await readFileAsBase64(input.file);
  const uploaded = await input.onUploadImage({
    fileName: input.file.name,
    mimeType: input.file.type || "image/*",
    fileContentBase64,
  });

  if (!uploaded) {
    return;
  }

  input.onChange({
    ...input.block,
    content_payload: {
      ...input.block.content_payload,
      upload_id: uploaded.upload_id,
      storage_key: uploaded.storage_key,
      file_name: uploaded.file_name,
      mime_type: uploaded.mime_type,
      byte_length: uploaded.byte_length,
      uploaded_at: uploaded.uploaded_at,
    },
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === "undefined") {
      reject(new Error("FileReader is not available in this environment."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Image upload result was not a base64 string."));
        return;
      }

      const [, base64 = ""] = result.split(",", 2);
      resolve(base64);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Image upload failed."));
    };
    reader.readAsDataURL(file);
  });
}
