import { useId, useRef, type DragEvent } from "react";

export interface KnowledgeLibraryLedgerAttachment {
  blockId: string;
  fileName: string;
  mimeType: string;
  byteLength?: number;
  storageKey?: string;
  caption: string;
}

export interface KnowledgeLibraryAttachmentFieldProps {
  attachments: readonly KnowledgeLibraryLedgerAttachment[];
  aiIntakeEvidenceMode?: "secondary";
  isBusy: boolean;
  onSelectFiles: (files: readonly File[]) => void;
  onRemoveAttachment: (blockId: string) => void;
  onCaptionChange: (blockId: string, value: string) => void;
}

export function KnowledgeLibraryAttachmentField({
  attachments,
  aiIntakeEvidenceMode,
  isBusy,
  onSelectFiles,
  onRemoveAttachment,
  onCaptionChange,
}: KnowledgeLibraryAttachmentFieldProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) {
      return;
    }

    onSelectFiles(files);
  }

  return (
    <section
      className="knowledge-library-attachment-field"
      data-material-support="attachments"
      data-ai-intake-evidence={aiIntakeEvidenceMode}
    >
      <div className="knowledge-library-attachment-field__header">
        <div>
          <h3>图片 / 附件</h3>
          <p>支持拖拽上传，图片作为辅助信息参与录入。</p>
        </div>
        <button
          type="button"
          data-block-action="upload-attachment"
          onClick={openFilePicker}
          disabled={isBusy}
        >
          添加附件
        </button>
      </div>

      <div
        className="knowledge-library-attachment-field__dropzone"
        role="button"
        tabIndex={0}
        onClick={openFilePicker}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openFilePicker();
          }
        }}
      >
        <strong>拖拽图片到这里，或点击选择文件</strong>
        <span>建议以文字为主，图片作为辅助证据。</span>
      </div>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          if (files.length > 0) {
            onSelectFiles(files);
          }

          event.currentTarget.value = "";
        }}
      />

      <ul className="knowledge-library-attachment-field__list">
        {attachments.map((attachment) => (
          <li key={attachment.blockId} className="knowledge-library-attachment-field__item">
            <div className="knowledge-library-attachment-field__summary">
              <strong>{attachment.fileName}</strong>
              <span>{attachment.mimeType}</span>
              {typeof attachment.byteLength === "number" ? (
                <span>{formatBytes(attachment.byteLength)}</span>
              ) : null}
            </div>

            <label>
              <span>说明</span>
              <input
                value={attachment.caption}
                onChange={(event) =>
                  onCaptionChange(attachment.blockId, event.target.value)
                }
                placeholder="可选：描述图片说明的内容"
              />
            </label>

            <button
              type="button"
              onClick={() => onRemoveAttachment(attachment.blockId)}
              disabled={isBusy}
            >
              删除
            </button>
          </li>
        ))}

        {attachments.length === 0 ? (
          <li className="knowledge-library-attachment-field__empty">暂无附件。</li>
        ) : null}
      </ul>
    </section>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
