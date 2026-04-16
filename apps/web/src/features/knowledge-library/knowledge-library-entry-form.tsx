import { useState } from "react";
import type { KnowledgeKind } from "../knowledge/index.ts";
import type { ManuscriptModule } from "../manuscripts/types.ts";
import type { KnowledgeContentBlockViewModel } from "./types.ts";
import type { KnowledgeLibraryLedgerComposer } from "./knowledge-library-ledger-composer.ts";
import {
  KnowledgeLibraryAttachmentField,
  type KnowledgeLibraryLedgerAttachment,
} from "./knowledge-library-attachment-field.tsx";
import { KnowledgeLibraryRichContentEditor } from "./knowledge-library-rich-content-editor.tsx";
import { KnowledgeLibrarySemanticSection } from "./knowledge-library-semantic-section.tsx";

type EntryBoardTab = "basic" | "materials" | "semantic";
export type KnowledgeLibraryEntryAiAssistMode = "manual" | "prefill";

export interface KnowledgeLibraryEntryFormProps {
  mode: "create" | "edit";
  aiAssistMode: KnowledgeLibraryEntryAiAssistMode;
  composer: KnowledgeLibraryLedgerComposer;
  attachments: readonly KnowledgeLibraryLedgerAttachment[];
  contentBlocks: readonly KnowledgeContentBlockViewModel[];
  aiIntakeSourceText: string;
  requiredTagsText: string;
  duplicateSummary: string | null;
  semanticStatusLabel: string;
  semanticNotes: readonly string[];
  isBusy: boolean;
  canRunAiPrefill: boolean;
  canGenerateSemantic: boolean;
  canApplySemantic: boolean;
  canConfirmEntry: boolean;
  onAiAssistModeChange: (mode: KnowledgeLibraryEntryAiAssistMode) => void;
  onTitleChange: (value: string) => void;
  onCanonicalTextChange: (value: string) => void;
  onSummaryChange: (value: string) => void;
  onKnowledgeKindChange: (value: KnowledgeKind) => void;
  onModuleScopeChange: (value: ManuscriptModule | "any") => void;
  onRequiredTagsChange: (value: string) => void;
  onAiIntakeSourceTextChange: (value: string) => void;
  onRunAiPrefill: () => void;
  onContentBlocksChange: (blocks: KnowledgeContentBlockViewModel[]) => void;
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
  aiAssistMode,
  composer,
  attachments,
  contentBlocks,
  aiIntakeSourceText,
  requiredTagsText,
  duplicateSummary,
  semanticStatusLabel,
  semanticNotes,
  isBusy,
  canRunAiPrefill,
  canGenerateSemantic,
  canApplySemantic,
  canConfirmEntry,
  onAiAssistModeChange,
  onTitleChange,
  onCanonicalTextChange,
  onSummaryChange,
  onKnowledgeKindChange,
  onModuleScopeChange,
  onRequiredTagsChange,
  onAiIntakeSourceTextChange,
  onRunAiPrefill,
  onContentBlocksChange,
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
  const [activeTab, setActiveTab] = useState<EntryBoardTab>("basic");
  const hasPersistedDraft = composer.persistedRevisionId !== null;
  const isAiPrefillMode = aiAssistMode === "prefill";

  return (
    <aside
      className="knowledge-library-entry-form"
      aria-label="知识录入表单"
      data-entry-mode={mode}
      data-ai-assist-mode={aiAssistMode}
    >
      <header className="knowledge-library-entry-form__header">
        <div>
          <p className="knowledge-library-entry-form__eyebrow">
            {mode === "create" ? "新增知识" : "编辑知识"}
          </p>
          <h2>{mode === "create" ? "右侧录入栏" : "右侧编辑栏"}</h2>
          <p>人工填写和 AI 预填充共用同一张表单，先预填，再逐项核对、补充和确认。</p>
        </div>

        <div className="knowledge-library-entry-form__assist-switch">
          <button
            type="button"
            data-ai-assist-toggle="manual"
            className={aiAssistMode === "manual" ? "is-active" : undefined}
            aria-pressed={aiAssistMode === "manual"}
            onClick={() => onAiAssistModeChange("manual")}
          >
            人工录入
          </button>
          <button
            type="button"
            data-ai-assist-toggle="prefill"
            className={isAiPrefillMode ? "is-active" : undefined}
            aria-pressed={isAiPrefillMode}
            onClick={() => onAiAssistModeChange("prefill")}
          >
            AI 预填充
          </button>
        </div>
      </header>

      <nav className="knowledge-library-entry-form__tabs" aria-label="知识录入标签">
        {ENTRY_BOARD_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-board-tab={tab.id}
            className={activeTab === tab.id ? "is-active" : ""}
            aria-pressed={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="knowledge-library-entry-form__body">
        <section
          className="knowledge-library-entry-form__tab-panel"
          data-board-panel="basic"
          hidden={activeTab !== "basic"}
        >
          <section
            className="knowledge-library-entry-form__ai-intake"
            data-ai-assist-panel="prefill"
            hidden={!isAiPrefillMode}
          >
            <div className="knowledge-library-entry-form__section-header">
              <h3>AI 预填充来源</h3>
              <p>粘贴原始文本后先生成候选字段，右侧仍然保留人工校对和修订。</p>
            </div>

            <label>
              <span>文本来源</span>
              <textarea
                data-ai-intake-source="text"
                rows={6}
                value={aiIntakeSourceText}
                onChange={(event) => onAiIntakeSourceTextChange(event.target.value)}
                placeholder="粘贴指南摘要、人工整理文本或其他知识来源，再交给 AI 预填充。"
              />
            </label>

            <div className="knowledge-library-entry-form__assist-actions">
              <button
                type="button"
                data-ai-assist-action="prefill"
                onClick={onRunAiPrefill}
                disabled={!canRunAiPrefill || isBusy}
              >
                生成 AI 预填充
              </button>
            </div>
          </section>

          <section className="knowledge-library-entry-form__section">
            <div className="knowledge-library-entry-form__section-header">
              <h3>基础信息</h3>
              <p>先完成最短的录入项，再按需展开更多信息。</p>
            </div>

            <label>
              <span>标题</span>
              <input
                value={composer.draft.title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder="请输入知识标题"
              />
            </label>

            <label>
              <span>分类</span>
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
              <span>简要说明或标准答案</span>
              <textarea
                rows={6}
                value={composer.draft.canonicalText}
                onChange={(event) => onCanonicalTextChange(event.target.value)}
                placeholder="输入标准答案、摘要或操作说明"
              />
            </label>

            <label>
              <span>必要标签</span>
              <input
                value={requiredTagsText}
                onChange={(event) => onRequiredTagsChange(event.target.value)}
                placeholder="用顿号、逗号或换行分隔标签"
              />
            </label>

            <details className="knowledge-library-entry-form__more" data-entry-toggle="more-info">
              <summary>更多信息</summary>
              <div className="knowledge-library-entry-form__grid">
                <label>
                  <span>适用模块</span>
                  <select
                    value={composer.draft.moduleScope}
                    onChange={(event) =>
                      onModuleScopeChange(event.target.value as ManuscriptModule | "any")
                    }
                  >
                    <option value="any">全部模块</option>
                    <option value="screening">初筛</option>
                    <option value="editing">编辑</option>
                    <option value="proofreading">校对</option>
                    <option value="manual">人工处理</option>
                    <option value="learning">学习回流</option>
                  </select>
                </label>

                <label>
                  <span>补充说明</span>
                  <textarea
                    rows={4}
                    value={composer.draft.summary ?? ""}
                    onChange={(event) => onSummaryChange(event.target.value)}
                    placeholder="补充适用边界、引用背景或使用提醒"
                  />
                </label>
              </div>
            </details>
          </section>
        </section>

        <section
          className="knowledge-library-entry-form__tab-panel"
          data-board-panel="materials"
          hidden={activeTab !== "materials"}
        >
          <KnowledgeLibraryRichContentEditor
            blocks={contentBlocks}
            onChange={onContentBlocksChange}
          />
          <KnowledgeLibraryAttachmentField
            attachments={attachments}
            aiIntakeEvidenceMode={isAiPrefillMode ? "secondary" : undefined}
            isBusy={isBusy}
            onSelectFiles={onSelectFiles}
            onRemoveAttachment={onRemoveAttachment}
            onCaptionChange={onAttachmentCaptionChange}
          />
        </section>

        <section
          className="knowledge-library-entry-form__tab-panel"
          data-board-panel="semantic"
          hidden={activeTab !== "semantic"}
        >
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
        </section>

        {duplicateSummary ? (
          <p className="knowledge-library-entry-form__duplicate">{duplicateSummary}</p>
        ) : null}
      </div>

      <footer className="knowledge-library-entry-form__footer">
        {!hasPersistedDraft ? (
          <>
            <button
              type="button"
              data-board-action="cancel-create"
              onClick={onCancel}
              disabled={isBusy}
            >
              取消
            </button>
            <button
              type="button"
              data-board-action="confirm-entry"
              onClick={onConfirmEntry}
              disabled={!canConfirmEntry || isBusy}
            >
              确认录入
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              data-board-action="cancel-edit"
              onClick={onCancel}
              disabled={isBusy}
            >
              取消
            </button>
            <button
              type="button"
              data-board-action="save-draft"
              onClick={onSaveDraft}
              disabled={isBusy}
            >
              保存草稿
            </button>
            {onSubmitReview ? (
              <button
                type="button"
                data-board-action="submit-review"
                onClick={onSubmitReview}
                disabled={isBusy}
              >
                提交审核
              </button>
            ) : null}
          </>
        )}
      </footer>
    </aside>
  );
}

const ENTRY_BOARD_TABS: ReadonlyArray<{
  id: EntryBoardTab;
  label: string;
}> = [
  { id: "basic", label: "基础信息" },
  { id: "materials", label: "内容材料" },
  { id: "semantic", label: "AI语义层" },
];
