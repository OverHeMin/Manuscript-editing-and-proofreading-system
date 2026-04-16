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
      : "尚未上传图片";
  const mimeType =
    typeof block.content_payload.mime_type === "string"
      ? block.content_payload.mime_type
      : "图片类型待识别";
  const byteLength =
    typeof block.content_payload.byte_length === "number"
      ? `${block.content_payload.byte_length} bytes`
      : "大小待上传";
  const storageKey =
    typeof block.content_payload.storage_key === "string"
      ? block.content_payload.storage_key
      : "存储位置会在上传后生成";

  return (
    <div className="knowledge-library-block-editor knowledge-library-block-image-editor">
      <div className="knowledge-library-block-image-meta">
        <strong>{fileName}</strong>
        <small>{mimeType}</small>
        <small>{byteLength}</small>
        <small>{storageKey}</small>
      </div>

      <p className="knowledge-library-block-editor__hint">
        支持上传截图、图表或扫描件，上传后可以继续补充图片说明。
      </p>

      <label className="knowledge-library-rich-content-editor__field">
        <span>上传图片或截图</span>
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

      <label className="knowledge-library-rich-content-editor__field">
        <span>图片说明</span>
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
          placeholder="简单说明图片想证明什么"
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
