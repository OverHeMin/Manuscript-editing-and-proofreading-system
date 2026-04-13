export interface KnowledgeLibrarySemanticSectionProps {
  semanticStatusLabel: string;
  semanticNotes: readonly string[];
  pageSummary: string;
  retrievalTerms: readonly string[];
  aliases: readonly string[];
  scenarios: readonly string[];
  riskTags: readonly string[];
  isBusy: boolean;
  canGenerate: boolean;
  canApply: boolean;
  onPageSummaryChange: (value: string) => void;
  onGenerate: () => void;
  onApply: () => void;
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
}

export function KnowledgeLibrarySemanticSection({
  semanticStatusLabel,
  semanticNotes,
  pageSummary,
  retrievalTerms,
  aliases,
  scenarios,
  riskTags,
  isBusy,
  canGenerate,
  canApply,
  onPageSummaryChange,
  onGenerate,
  onApply,
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
}: KnowledgeLibrarySemanticSectionProps) {
  return (
    <section className="knowledge-library-semantic-section">
      <header className="knowledge-library-semantic-section__header">
        <div>
          <h3>AI 语义层</h3>
          <p>先生成，再核对，确认无误后再录入台账。</p>
        </div>

        <div className="knowledge-library-semantic-section__actions">
          <button type="button" onClick={onGenerate} disabled={isBusy || !canGenerate}>
            生成AI语义
          </button>
          <button type="button" onClick={onGenerate} disabled={isBusy || !canGenerate}>
            重新生成
          </button>
          <button type="button" onClick={onApply} disabled={isBusy || !canApply}>
            应用建议
          </button>
        </div>
      </header>

      <div className="knowledge-library-semantic-section__status">
        <span>AI状态</span>
        <strong>{semanticStatusLabel}</strong>
      </div>

      {semanticNotes.length > 0 ? (
        <ul className="knowledge-library-semantic-section__notes">
          {semanticNotes.map((note, index) => (
            <li key={`${note}-${index}`}>{note}</li>
          ))}
        </ul>
      ) : null}

      <label className="knowledge-library-semantic-section__field">
        <span>语义摘要</span>
        <textarea
          rows={4}
          value={pageSummary}
          onChange={(event) => onPageSummaryChange(event.target.value)}
          placeholder="AI 生成后可继续手动修改。"
        />
      </label>

      <RepeatableFieldEditor
        title="检索词"
        values={retrievalTerms}
        addLabel="新增检索词"
        onAdd={onAddRetrievalTerm}
        onChange={onChangeRetrievalTerm}
        onRemove={onRemoveRetrievalTerm}
      />

      <RepeatableFieldEditor
        title="别名 / 同义词"
        values={aliases}
        addLabel="新增别名"
        onAdd={onAddAlias}
        onChange={onChangeAlias}
        onRemove={onRemoveAlias}
      />

      <RepeatableFieldEditor
        title="适用场景"
        values={scenarios}
        addLabel="新增场景"
        onAdd={onAddScenario}
        onChange={onChangeScenario}
        onRemove={onRemoveScenario}
      />

      <RepeatableFieldEditor
        title="风险标签"
        values={riskTags}
        addLabel="新增风险标签"
        onAdd={onAddRiskTag}
        onChange={onChangeRiskTag}
        onRemove={onRemoveRiskTag}
      />
    </section>
  );
}

interface RepeatableFieldEditorProps {
  title: string;
  values: readonly string[];
  addLabel: string;
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}

function RepeatableFieldEditor({
  title,
  values,
  addLabel,
  onAdd,
  onChange,
  onRemove,
}: RepeatableFieldEditorProps) {
  return (
    <section className="knowledge-library-semantic-section__repeatable">
      <div className="knowledge-library-semantic-section__repeatable-header">
        <span>{title}</span>
        <button type="button" onClick={onAdd}>
          {addLabel}
        </button>
      </div>

      <div className="knowledge-library-semantic-section__repeatable-list">
        {values.map((value, index) => (
          <div key={`${title}-${index}`} className="knowledge-library-semantic-section__repeatable-row">
            <input
              value={value}
              onChange={(event) => onChange(index, event.target.value)}
            />
            <button type="button" onClick={() => onRemove(index)}>
              删除
            </button>
          </div>
        ))}

        {values.length === 0 ? (
          <p className="knowledge-library-semantic-section__empty">暂未添加。</p>
        ) : null}
      </div>
    </section>
  );
}
