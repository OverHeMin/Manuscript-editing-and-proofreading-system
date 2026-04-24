import type {
  KnowledgeContentBlockViewModel,
  KnowledgeUploadInput,
  KnowledgeUploadViewModel,
} from "./types.ts";

type VisualSymbolSourceKind =
  | "unknown"
  | "inline_symbol_image"
  | "equation_fragment_image"
  | "table_embedded_symbol"
  | "other";

type VisualSymbolReviewState = "pending_review" | "confirmed" | "rejected";

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
  const sourceKind = readVisualSymbolSourceKind(block.content_payload);
  const reviewState = readVisualSymbolReviewState(block.content_payload);
  const candidateConfidence =
    typeof block.content_payload.candidate_confidence === "number"
      ? String(block.content_payload.candidate_confidence)
      : "";

  function commitContentPayload(nextPayload: Record<string, unknown>) {
    onChange({
      ...block,
      content_payload: nextPayload,
      image_understanding: buildImageUnderstanding(nextPayload),
    });
  }

  return (
    <div className="knowledge-library-block-editor knowledge-library-block-image-editor">
      <div className="knowledge-library-block-image-meta">
        <strong>{fileName}</strong>
        <small>{mimeType}</small>
        <small>{byteLength}</small>
        <small>{storageKey}</small>
      </div>

      <p className="knowledge-library-block-editor__hint">
        支持上传截图、图表或扫描件。若作者用图片代替 `χ²`、公式片段或其他可编辑符号，这里应按对象型问题录入，而不是当作普通文本格式问题。
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
            commitContentPayload({
              ...block.content_payload,
              caption: event.target.value,
            })
          }
          placeholder="简单说明图片想证明什么"
        />
      </label>

      <div className="knowledge-library-rich-content-editor__field-group">
        <label className="knowledge-library-rich-content-editor__field">
          <span>证据类型</span>
          <select
            value={sourceKind}
            onChange={(event) =>
              commitContentPayload({
                ...block.content_payload,
                source_kind: event.target.value,
              })
            }
          >
            <option value="unknown">未确认</option>
            <option value="inline_symbol_image">符号截图</option>
            <option value="equation_fragment_image">公式片段截图</option>
            <option value="table_embedded_symbol">表格内符号图片</option>
            <option value="other">其他图片证据</option>
          </select>
        </label>
        <label className="knowledge-library-rich-content-editor__field">
          <span>候选符号</span>
          <input
            value={readPayloadString(block.content_payload, "normalized_candidate_symbol")}
            onChange={(event) =>
              commitContentPayload({
                ...block.content_payload,
                normalized_candidate_symbol: event.target.value,
              })
            }
            placeholder="例如：χ²"
          />
        </label>
        <label className="knowledge-library-rich-content-editor__field">
          <span>候选置信度</span>
          <input
            value={candidateConfidence}
            onChange={(event) =>
              commitContentPayload({
                ...block.content_payload,
                candidate_confidence: parseConfidenceValue(event.target.value),
              })
            }
            placeholder="0.0 - 1.0"
          />
        </label>
      </div>

      <label className="knowledge-library-rich-content-editor__field">
        <span>局部上下文</span>
        <input
          value={readPayloadString(block.content_payload, "local_context")}
          onChange={(event) =>
            commitContentPayload({
              ...block.content_payload,
              local_context: event.target.value,
            })
          }
          placeholder="例如：统计方法段落中的检验名称位置"
        />
      </label>

      <label className="knowledge-library-rich-content-editor__field">
        <span>邻近文本</span>
        <textarea
          rows={3}
          value={readPayloadString(block.content_payload, "nearby_text")}
          onChange={(event) =>
            commitContentPayload({
              ...block.content_payload,
              nearby_text: event.target.value,
            })
          }
          placeholder="把符号图片前后的原文一起记录下来，避免 AI 瞎猜。"
        />
      </label>

      <label className="knowledge-library-rich-content-editor__field">
        <span>审核状态</span>
        <select
          value={reviewState}
          onChange={(event) =>
            commitContentPayload({
              ...block.content_payload,
              review_state: event.target.value,
            })
          }
        >
          <option value="pending_review">待审核</option>
          <option value="confirmed">已确认</option>
          <option value="rejected">已驳回</option>
        </select>
      </label>

      <div className="knowledge-library-block-editor__hint">
        <strong>视觉符号快照</strong>
        <p>{formatImageUnderstandingStatus(block.content_payload)}</p>
      </div>
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
    image_understanding: buildImageUnderstanding({
      ...input.block.content_payload,
      upload_id: uploaded.upload_id,
      storage_key: uploaded.storage_key,
      file_name: uploaded.file_name,
      mime_type: uploaded.mime_type,
      byte_length: uploaded.byte_length,
      uploaded_at: uploaded.uploaded_at,
    }),
  });
}

export function buildImageUnderstanding(
  payload: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const sourceKind = readVisualSymbolSourceKind(payload);
  const reviewState = readVisualSymbolReviewState(payload);
  const normalizedCandidateSymbol = readPayloadString(payload, "normalized_candidate_symbol");
  const localContext = readPayloadString(payload, "local_context");
  const nearbyText = readPayloadString(payload, "nearby_text");
  const caption = readPayloadString(payload, "caption");
  const imageId =
    readPayloadString(payload, "upload_id") ||
    readPayloadString(payload, "storage_key") ||
    readPayloadString(payload, "file_name");
  const confidence =
    typeof payload.candidate_confidence === "number" ? payload.candidate_confidence : undefined;

  if (
    sourceKind === "unknown" &&
    reviewState === "pending_review" &&
    normalizedCandidateSymbol.length === 0 &&
    localContext.length === 0 &&
    nearbyText.length === 0 &&
    caption.length === 0 &&
    imageId.length === 0 &&
    confidence == null
  ) {
    return undefined;
  }

  return {
    snapshot_type: "visual_symbol_snapshot",
    source_kind: sourceKind,
    normalized_candidate_symbol:
      normalizedCandidateSymbol.length > 0 ? normalizedCandidateSymbol : undefined,
    candidate_confidence: confidence,
    local_context: localContext.length > 0 ? localContext : undefined,
    nearby_text: nearbyText.length > 0 ? nearbyText : undefined,
    review_state: reviewState,
    caption: caption.length > 0 ? caption : undefined,
    image_id: imageId.length > 0 ? imageId : undefined,
  };
}

function formatImageUnderstandingStatus(payload: Record<string, unknown>): string {
  const sourceKind = readVisualSymbolSourceKind(payload);
  const reviewState = readVisualSymbolReviewState(payload);
  const candidateSymbol = readPayloadString(payload, "normalized_candidate_symbol");
  const confidence =
    typeof payload.candidate_confidence === "number" ? payload.candidate_confidence : undefined;
  const candidateSummary =
    candidateSymbol.length > 0
      ? `候选符号：${candidateSymbol}${confidence != null ? `（置信度 ${confidence.toFixed(2)}）` : ""}`
      : "尚未填写候选符号";
  return `证据类型：${formatVisualSymbolSourceKindLabel(sourceKind)}；${candidateSummary}；审核状态：${formatVisualSymbolReviewStateLabel(reviewState)}。`;
}

function readPayloadString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function parseConfidenceValue(value: string): number | undefined {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.max(0, Math.min(1, parsed));
}

function readVisualSymbolSourceKind(payload: Record<string, unknown>): VisualSymbolSourceKind {
  const value = payload["source_kind"];
  return value === "inline_symbol_image" ||
    value === "equation_fragment_image" ||
    value === "table_embedded_symbol" ||
    value === "other" ||
    value === "unknown"
    ? value
    : "unknown";
}

function readVisualSymbolReviewState(payload: Record<string, unknown>): VisualSymbolReviewState {
  const value = payload["review_state"];
  return value === "confirmed" || value === "rejected" || value === "pending_review"
    ? value
    : "pending_review";
}

function formatVisualSymbolSourceKindLabel(value: VisualSymbolSourceKind): string {
  switch (value) {
    case "inline_symbol_image":
      return "符号截图";
    case "equation_fragment_image":
      return "公式片段截图";
    case "table_embedded_symbol":
      return "表格内符号图片";
    case "other":
      return "其他图片证据";
    case "unknown":
    default:
      return "未确认";
  }
}

function formatVisualSymbolReviewStateLabel(value: VisualSymbolReviewState): string {
  switch (value) {
    case "confirmed":
      return "已确认";
    case "rejected":
      return "已驳回";
    case "pending_review":
    default:
      return "待审核";
  }
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
