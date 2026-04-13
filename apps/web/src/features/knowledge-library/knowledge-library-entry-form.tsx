import type { KnowledgeKind } from "../knowledge/index.ts";
import type { ManuscriptModule } from "../manuscripts/types.ts";
import type { KnowledgeLibraryLedgerComposer } from "./knowledge-library-ledger-composer.ts";
import {
  KnowledgeLibraryAttachmentField,
  type KnowledgeLibraryLedgerAttachment,
} from "./knowledge-library-attachment-field.tsx";
import { KnowledgeLibrarySemanticSection } from "./knowledge-library-semantic-section.tsx";

export interface KnowledgeLibraryEntryFormProps {
  mode: "create" | "edit";
  composer: KnowledgeLibraryLedgerComposer;
  attachments: readonly KnowledgeLibraryLedgerAttachment[];
  duplicateSummary: string | null;
  semanticStatusLabel: string;
  semanticNotes: readonly string[];
  isBusy: boolean;
  canGenerateSemantic: boolean;
  canApplySemantic: boolean;
  canConfirmEntry: boolean;
  onTitleChange: (value: string) => void;
  onCanonicalTextChange: (value: string) => void;
  onSummaryChange: (value: string) => void;
  onKnowledgeKindChange: (value: KnowledgeKind) => void;
  onModuleScopeChange: (value: ManuscriptModule | "any") => void;
  onSelectFiles: (files: readonly File[]) => void;
  onRemoveAttachment: (blockId: string) => void;
  onAttachmentCaptionChange: (blockId: string, value: string) => void;
  onSemanticPageSummaryChange: (value: string) => void;
  onGenerateSemantic: () => void;
  onApplySemantic: () => void;
  onAddRetrievalTerm: () => void;
  onChangeRetrievalTerm: (index: number, value: string) => void;
  onRemoveRetrievalTerm: (index: number) => void;
  onAddAlias: () => void;
  onChangeAlias: (index: number, value: string) => void;
  onRemoveAlias: (index: number) => void;
  onAddScenario: () => void;
  onChangeScenario: (index: number, value: string) => void;
  onRemoveScenario: (index: number) => void;
  onAddRiskTag: () => void;
  onChangeRiskTag: (index: number, value: string) => void;
  onRemoveRiskTag: (index: number) => void;
  onCancel: () => void;
  onSaveDraft: () => void;
  onConfirmEntry: () => void;
  onSubmitReview?: () => void;
}

export function KnowledgeLibraryEntryForm({
  mode,
  composer,
  attachments,
  duplicateSummary,
  semanticStatusLabel,
  semanticNotes,
  isBusy,
  canGenerateSemantic,
  canApplySemantic,
  canConfirmEntry,
  onTitleChange,
  onCanonicalTextChange,
  onSummaryChange,
  onKnowledgeKindChange,
  onModuleScopeChange,
  onSelectFiles,
  onRemoveAttachment,
  onAttachmentCaptionChange,
  onSemanticPageSummaryChange,
  onGenerateSemantic,
  onApplySemantic,
  onAddRetrievalTerm,
  onChangeRetrievalTerm,
  onRemoveRetrievalTerm,
  onAddAlias,
  onChangeAlias,
  onRemoveAlias,
  onAddScenario,
  onChangeScenario,
  onRemoveScenario,
  onAddRiskTag,
  onChangeRiskTag,
  onRemoveRiskTag,
  onCancel,
  onSaveDraft,
  onConfirmEntry,
  onSubmitReview,
}: KnowledgeLibraryEntryFormProps) {
  return (
    <aside className="knowledge-library-entry-form" aria-label="知识录入表单">
      <header className="knowledge-library-entry-form__header">
        <div>
          <p className="knowledge-library-entry-form__eyebrow">
            {mode === "create" ? "新建知识" : "编辑知识"}
          </p>
          <h2>{mode === "create" ? "知识录入表单" : "知识编辑表单"}</h2>
          <p>一张表单完成基础录入、附件上传和 AI 语义确认。</p>
        </div>
      </header>

      <div className="knowledge-library-entry-form__body">
        <section className="knowledge-library-entry-form__section">
          <div className="knowledge-library-entry-form__section-header">
            <h3>基础信息</h3>
          </div>

          <label>
            <span>名称 / 关键词</span>
            <input
              value={composer.draft.title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="请输入知识名称"
            />
          </label>

          <label>
            <span>答案</span>
            <textarea
              rows={6}
              value={composer.draft.canonicalText}
              onChange={(event) => onCanonicalTextChange(event.target.value)}
              placeholder="请输入核心答案，AI 会优先读取这里的文字内容。"
            />
          </label>

          <div className="knowledge-library-entry-form__grid">
            <label>
              <span>类别</span>
              <select
                value={composer.draft.knowledgeKind}
                onChange={(event) =>
                  onKnowledgeKindChange(event.target.value as KnowledgeKind)
                }
              >
                <option value="rule">规则</option>
                <option value="case_pattern">案例模式</option>
                <option value="checklist">核查清单</option>
                <option value="prompt_snippet">提示片段</option>
                <option value="reference">参考资料</option>
                <option value="other">其他</option>
              </select>
            </label>

            <label>
              <span>适用模块</span>
              <select
                value={composer.draft.moduleScope}
                onChange={(event) =>
                  onModuleScopeChange(event.target.value as ManuscriptModule | "any")
                }
              >
                <option value="any">全部模块</option>
                <option value="upload">上传</option>
                <option value="screening">初筛</option>
                <option value="editing">编辑</option>
                <option value="proofreading">校对</option>
                <option value="manual">人工处理</option>
                <option value="learning">学习回流</option>
              </select>
            </label>
          </div>

          <label>
            <span>详情</span>
            <textarea
              rows={4}
              value={composer.draft.summary ?? ""}
              onChange={(event) => onSummaryChange(event.target.value)}
              placeholder="补充使用边界、注意事项或上下文。"
            />
          </label>
        </section>

        <KnowledgeLibraryAttachmentField
          attachments={attachments}
          isBusy={isBusy}
          onSelectFiles={onSelectFiles}
          onRemoveAttachment={onRemoveAttachment}
          onCaptionChange={onAttachmentCaptionChange}
        />

        <KnowledgeLibrarySemanticSection
          semanticStatusLabel={semanticStatusLabel}
          semanticNotes={semanticNotes}
          pageSummary={composer.semanticLayerDraft?.page_summary ?? ""}
          retrievalTerms={composer.semanticLayerDraft?.retrieval_terms ?? []}
          aliases={composer.draft.aliases ?? []}
          scenarios={composer.semanticLayerDraft?.retrieval_snippets ?? []}
          riskTags={composer.draft.riskTags ?? []}
          isBusy={isBusy}
          canGenerate={canGenerateSemantic}
          canApply={canApplySemantic}
          onPageSummaryChange={onSemanticPageSummaryChange}
          onGenerate={onGenerateSemantic}
          onApply={onApplySemantic}
          onAddRetrievalTerm={onAddRetrievalTerm}
          onChangeRetrievalTerm={onChangeRetrievalTerm}
          onRemoveRetrievalTerm={onRemoveRetrievalTerm}
          onAddAlias={onAddAlias}
          onChangeAlias={onChangeAlias}
          onRemoveAlias={onRemoveAlias}
          onAddScenario={onAddScenario}
          onChangeScenario={onChangeScenario}
          onRemoveScenario={onRemoveScenario}
          onAddRiskTag={onAddRiskTag}
          onChangeRiskTag={onChangeRiskTag}
          onRemoveRiskTag={onRemoveRiskTag}
        />

        {duplicateSummary ? (
          <p className="knowledge-library-entry-form__duplicate">{duplicateSummary}</p>
        ) : null}
      </div>

      <footer className="knowledge-library-entry-form__footer">
        <button type="button" onClick={onCancel} disabled={isBusy}>
          取消
        </button>
        <button type="button" onClick={onSaveDraft} disabled={isBusy}>
          保存草稿
        </button>
        {onSubmitReview ? (
          <button type="button" onClick={onSubmitReview} disabled={isBusy}>
            提交审核
          </button>
        ) : null}
        <button type="button" onClick={onConfirmEntry} disabled={!canConfirmEntry || isBusy}>
          确认录入
        </button>
      </footer>
    </aside>
  );
}
