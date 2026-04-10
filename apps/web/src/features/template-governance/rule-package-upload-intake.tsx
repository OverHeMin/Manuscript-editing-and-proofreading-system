import type { ChangeEvent } from "react";
import type { BrowserUploadFile } from "../manuscript-workbench/manuscript-upload-file.ts";

export interface RulePackageUploadIntakeProps {
  originalFileName?: string | null;
  editedFileName?: string | null;
  canStart: boolean;
  isBusy: boolean;
  onOriginalFileSelect: (file: BrowserUploadFile | null) => void;
  onEditedFileSelect: (file: BrowserUploadFile | null) => void;
  onStart: () => void;
}

export function RulePackageUploadIntake({
  originalFileName = null,
  editedFileName = null,
  canStart,
  isBusy,
  onOriginalFileSelect,
  onEditedFileSelect,
  onStart,
}: RulePackageUploadIntakeProps) {
  return (
    <article className="template-governance-card rule-package-upload-intake">
      <div className="template-governance-panel-header">
        <div>
          <h3>示例驱动录入</h3>
          <p>上传原稿和编后稿示例，直接进入规则包识别工作台。</p>
        </div>
      </div>

      <div className="rule-package-upload-grid">
        <label className="template-governance-field">
          <span>上传原稿</span>
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => {
              onOriginalFileSelect(readFirstUploadFile(event));
            }}
          />
          <small>{originalFileName ?? "未选择文件"}</small>
        </label>

        <label className="template-governance-field">
          <span>上传编后稿</span>
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => {
              onEditedFileSelect(readFirstUploadFile(event));
            }}
          />
          <small>{editedFileName ?? "未选择文件"}</small>
        </label>
      </div>

      <div className="template-governance-actions">
        <button type="button" onClick={onStart} disabled={!canStart || isBusy}>
          {isBusy ? "识别中..." : "开始识别"}
        </button>
      </div>
    </article>
  );
}

function readFirstUploadFile(
  event: ChangeEvent<HTMLInputElement>,
): BrowserUploadFile | null {
  return event.target.files?.item(0) ?? null;
}
