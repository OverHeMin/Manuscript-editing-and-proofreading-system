import type { BrowserUploadFile } from "../manuscript-workbench/manuscript-upload-file.ts";
import type { ManuscriptType } from "../manuscripts/types.ts";
import { EDITORIAL_MANUSCRIPT_TYPE_OPTIONS } from "../shared/editorial-taxonomy.ts";
import { formatTemplateGovernanceManuscriptTypeLabel } from "./template-governance-display.ts";

const manuscriptTypes: readonly ManuscriptType[] = EDITORIAL_MANUSCRIPT_TYPE_OPTIONS;

export interface TemplateGovernanceExtractionTaskFormDraft {
  taskName: string;
  manuscriptType: ManuscriptType;
  journalKey: string;
  originalFileLabel?: string;
  editedFileLabel?: string;
}

export interface TemplateGovernanceExtractionTaskFormProps {
  draft?: TemplateGovernanceExtractionTaskFormDraft;
  isBusy?: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  onDraftChange?: (
    recipe: (
      current: TemplateGovernanceExtractionTaskFormDraft,
    ) => TemplateGovernanceExtractionTaskFormDraft,
  ) => void;
  onOriginalFileSelect?: (file: BrowserUploadFile | null) => void;
  onEditedFileSelect?: (file: BrowserUploadFile | null) => void;
  onCancel?: () => void;
  onSubmit?: () => void;
}

const defaultDraft: TemplateGovernanceExtractionTaskFormDraft = {
  taskName: "",
  manuscriptType: "clinical_study",
  journalKey: "",
};

export function TemplateGovernanceExtractionTaskForm({
  draft = defaultDraft,
  isBusy = false,
  statusMessage = null,
  errorMessage = null,
  onDraftChange,
  onOriginalFileSelect,
  onEditedFileSelect,
  onCancel,
  onSubmit,
}: TemplateGovernanceExtractionTaskFormProps) {
  return (
    <section className="template-governance-form-layer">
      <article className="template-governance-card template-governance-extraction-task-form">
        <header className="template-governance-form-header">
          <h2>新建提取任务</h2>
          <p>在同页弹出表单，录入原稿与编辑稿后进入 AI 语义确认环节。</p>
        </header>
        {statusMessage ? <p className="template-governance-status">{statusMessage}</p> : null}
        {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}
        <div className="template-governance-form-grid">
          <label className="template-governance-field">
            <span>任务名称</span>
            <input
              value={draft.taskName}
              readOnly={!onDraftChange}
              placeholder="例如：原稿/编辑稿结构提取"
              onChange={(event) =>
                onDraftChange?.((current) => ({
                  ...current,
                  taskName: event.target.value,
                }))
              }
            />
          </label>
          <label className="template-governance-field">
            <span>稿件类型</span>
            <select
              value={draft.manuscriptType}
              disabled={!onDraftChange}
              onChange={(event) =>
                onDraftChange?.((current) => ({
                  ...current,
                  manuscriptType: event.target.value as ManuscriptType,
                }))
              }
            >
              {manuscriptTypes.map((manuscriptType) => (
                <option key={manuscriptType} value={manuscriptType}>
                  {formatTemplateGovernanceManuscriptTypeLabel(manuscriptType)}
                </option>
              ))}
            </select>
          </label>
          <label className="template-governance-field">
            <span>期刊 Key</span>
            <input
              value={draft.journalKey}
              readOnly={!onDraftChange}
              placeholder="可选"
              onChange={(event) =>
                onDraftChange?.((current) => ({
                  ...current,
                  journalKey: event.target.value,
                }))
              }
            />
          </label>
          <div className="template-governance-field template-governance-field-full">
            <span>原稿上传</span>
            <div className="template-governance-upload-dropzone">
              <strong>拖拽上传原稿</strong>
              <small>{draft.originalFileLabel ?? "支持 docx 或已解析快照"}</small>
              <input
                type="file"
                onChange={(event) =>
                  onOriginalFileSelect?.(
                    (event.target.files?.[0] as unknown as BrowserUploadFile | undefined) ??
                      null,
                  )
                }
              />
            </div>
          </div>
          <div className="template-governance-field template-governance-field-full">
            <span>编辑稿上传</span>
            <div className="template-governance-upload-dropzone">
              <strong>拖拽上传编辑稿</strong>
              <small>{draft.editedFileLabel ?? "支持 docx 或已解析快照"}</small>
              <input
                type="file"
                onChange={(event) =>
                  onEditedFileSelect?.(
                    (event.target.files?.[0] as unknown as BrowserUploadFile | undefined) ??
                      null,
                  )
                }
              />
            </div>
          </div>
        </div>
        <div className="template-governance-actions">
          <button type="button" onClick={onCancel}>
            取消
          </button>
          <button type="button" onClick={onSubmit} disabled={isBusy}>
            {isBusy ? "提取中..." : "开始提取"}
          </button>
        </div>
      </article>
    </section>
  );
}
