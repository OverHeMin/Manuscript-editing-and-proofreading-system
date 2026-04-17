import {
  EDITORIAL_MANUSCRIPT_TYPE_OPTIONS,
  formatEditorialManuscriptTypeLabel,
  formatEditorialModuleLabel,
} from "../shared/editorial-taxonomy.ts";
import type { ManuscriptType } from "../manuscripts/types.ts";
import {
  SearchableMultiSelectField,
  type SearchableMultiSelectOption,
} from "../../lib/searchable-multi-select.tsx";
import type {
  RuleWizardConfirmFormState,
  RuleWizardSemanticViewModel,
} from "./template-governance-rule-wizard-api.ts";

export interface TemplateGovernanceRuleWizardStepConfirmProps {
  value: RuleWizardConfirmFormState;
  suggestion: RuleWizardSemanticViewModel;
  isBusy?: boolean;
  errorMessage?: string | null;
  onChange: (nextValue: RuleWizardConfirmFormState) => void;
  onAcceptHighConfidence?: () => void;
}

export function TemplateGovernanceRuleWizardStepConfirm({
  value,
  suggestion,
  isBusy = false,
  errorMessage = null,
  onChange,
  onAcceptHighConfidence,
}: TemplateGovernanceRuleWizardStepConfirmProps) {
  const changeSummary = buildChangeSummary(value, suggestion);

  return (
    <article className="template-governance-card template-governance-ledger-section">
      <header className="template-governance-ledger-section-header">
        <h2>人工确认 AI 结果</h2>
        <p>只修正高频语义结论，不回到原始证据大表单。</p>
      </header>

      {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}

      <div className="template-governance-actions">
        <button type="button" onClick={onAcceptHighConfidence} disabled={isBusy}>
          一键采纳高置信结果
        </button>
      </div>

      <div className="template-governance-rule-hint-list">
        <div className="template-governance-rule-hint-card">
          <strong>规则类型决定这条规则按什么治理判断复用</strong>
          <p>它决定这条规则更像术语统一、格式规范还是内容要求，后面绑定到哪个规则包也会受影响。</p>
        </div>
        <div className="template-governance-rule-hint-card">
          <strong>风险等级决定后续审核和发布要多谨慎</strong>
          <p>越高风险越不适合跳过审核，尤其是涉及医学含义、引文合规和强约束内容时。</p>
        </div>
        <div className="template-governance-rule-hint-card">
          <strong>稿件类型填写这条规则默认命中的稿件范围</strong>
          <p>这里写的是默认适用稿件，不是所有可能出现的边缘情况；不确定时可以先写最常见的稿件族。</p>
        </div>
      </div>

      <div className="template-governance-rule-decision-grid">
        <section className="template-governance-card template-governance-rule-decision-card">
          <header className="template-governance-rule-section-heading">
            <div>
              <h3>规则类型判断</h3>
              <p>先确认这条规则到底属于哪一种治理判断。</p>
            </div>
          </header>
          <div className="template-governance-rule-decision-meta">
            <span>AI 建议</span>
            <strong>{formatRuleTypeLabel(suggestion.ruleType)}</strong>
          </div>
          <label className="template-governance-field">
            <span>人工确认</span>
            <select
              value={value.ruleType}
              onChange={(event) =>
                onChange({
                  ...value,
                  ruleType: event.target.value as RuleWizardConfirmFormState["ruleType"],
                })
              }
            >
              <option value="terminology_consistency">术语统一</option>
              <option value="format_normalization">格式规范</option>
              <option value="content_requirement">内容要求</option>
              <option value="citation_requirement">引文要求</option>
              <option value="other">其他规则</option>
            </select>
          </label>
        </section>

        <section className="template-governance-card template-governance-rule-decision-card">
          <header className="template-governance-rule-section-heading">
            <div>
              <h3>风险等级判断</h3>
              <p>风险越高，后续发布和审核路径越要谨慎。</p>
            </div>
          </header>
          <div className="template-governance-rule-decision-meta">
            <span>AI 建议</span>
            <strong>{formatRiskLevelLabel(suggestion.riskLevel)}</strong>
          </div>
          <label className="template-governance-field">
            <span>人工确认</span>
            <select
              value={value.riskLevel}
              onChange={(event) =>
                onChange({
                  ...value,
                  riskLevel: event.target.value as RuleWizardConfirmFormState["riskLevel"],
                })
              }
            >
              <option value="high">高风险</option>
              <option value="medium">中风险</option>
              <option value="low">低风险</option>
            </select>
          </label>
        </section>

        <section className="template-governance-card template-governance-rule-decision-card">
          <header className="template-governance-rule-section-heading">
            <div>
              <h3>业务适用范围</h3>
              <p>这里决定规则会在哪个业务模块和稿件类型里被调用。</p>
            </div>
          </header>
          <div className="template-governance-rule-decision-meta">
            <span>AI 建议</span>
            <strong>{formatModuleLabel(suggestion.moduleScope)}</strong>
          </div>
          <label className="template-governance-field">
            <span>人工确认</span>
            <select
              value={value.moduleScope}
              onChange={(event) =>
                onChange({
                  ...value,
                  moduleScope: event.target.value as RuleWizardConfirmFormState["moduleScope"],
                })
              }
            >
              <option value="any">全部模块</option>
              <option value="screening">初筛</option>
              <option value="editing">编辑</option>
              <option value="proofreading">校对</option>
            </select>
          </label>
          <label className="template-governance-field">
            <span>人工确认</span>
          </label>
          <RuleWizardMultiSelectField
            label="稿件类型"
            value={value.manuscriptTypes}
            options={manuscriptTypeOptions.map((option) => ({
              value: option,
              label: formatManuscriptTypeLabel(option),
            }))}
            dataKey="confirm-manuscript-types"
            includeAnyOption
            onToggleValue={(nextValue) =>
              onChange({
                ...value,
                manuscriptTypes: toggleManuscriptTypeSelection(
                  value.manuscriptTypes,
                  nextValue as ManuscriptType,
                ),
              })
            }
            onSelectAny={() =>
              onChange({
                ...value,
                manuscriptTypes: "any",
              })
            }
          />
        </section>
      </div>

      <div className="template-governance-detail-grid">
        <label className="template-governance-field template-governance-field-full">
          <span>语义摘要</span>
          <small>AI 建议：{suggestion.semanticSummary || "等待 AI 生成摘要。"}</small>
          <textarea
            rows={4}
            value={value.semanticSummary}
            onChange={(event) =>
              onChange({ ...value, semanticSummary: event.target.value })
            }
          />
        </label>

        <RuleWizardTagListField
          label="检索词"
          values={value.retrievalTerms}
          dataKey="confirm-retrieval-terms"
          addActionKey="add-confirm-retrieval-term"
          addLabel="添加检索词"
          emptyText="暂未添加检索词。"
          placeholder="例如：术语统一"
          onAdd={() =>
            onChange({
              ...value,
              retrievalTerms: [...value.retrievalTerms, ""],
            })
          }
          onChangeValue={(index, nextValue) =>
            onChange({
              ...value,
              retrievalTerms: updateStringListValue(value.retrievalTerms, index, nextValue),
            })
          }
          onRemove={(index) =>
            onChange({
              ...value,
              retrievalTerms: removeStringListValue(value.retrievalTerms, index),
            })
          }
        />

        <label className="template-governance-field">
          <span>检索片段</span>
          <textarea
            rows={4}
            value={value.retrievalSnippets}
            onChange={(event) =>
              onChange({ ...value, retrievalSnippets: event.target.value })
            }
            placeholder="每行一条检索片段"
          />
        </label>
      </div>

      <div className="template-governance-detail-grid">
        <div className="template-governance-field template-governance-field-full">
          <span>变更摘要</span>
          {changeSummary.length ? (
            <ul className="template-governance-list">
              {changeSummary.map((item) => (
                <li key={item}>
                  <div className="template-governance-list-button">
                    <span>{item}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>当前未做人工修正，保存时将直接采纳 AI 结果。</p>
          )}
        </div>
      </div>
    </article>
  );
}

function buildChangeSummary(
  value: RuleWizardConfirmFormState,
  suggestion: RuleWizardSemanticViewModel,
): string[] {
  const items: string[] = [];

  if (value.ruleType !== suggestion.ruleType) {
    items.push(
      `规则类型：${formatRuleTypeLabel(suggestion.ruleType)} -> ${formatRuleTypeLabel(value.ruleType)}`,
    );
  }

  if (value.riskLevel !== suggestion.riskLevel) {
    items.push(
      `风险等级：${formatRiskLevelLabel(suggestion.riskLevel)} -> ${formatRiskLevelLabel(value.riskLevel)}`,
    );
  }

  if (value.moduleScope !== suggestion.moduleScope) {
    items.push(
      `适用执行模块：${formatModuleLabel(suggestion.moduleScope)} -> ${formatModuleLabel(value.moduleScope)}`,
    );
  }

  if (!areManuscriptTypesEqual(value.manuscriptTypes, suggestion.manuscriptTypes)) {
    items.push(
      `适用稿件类型：${formatManuscriptTypesLabel(suggestion.manuscriptTypes)} -> ${formatManuscriptTypesLabel(value.manuscriptTypes)}`,
    );
  }

  if (value.semanticSummary.trim() !== suggestion.semanticSummary.trim()) {
    items.push("语义摘要已人工修订。");
  }

  if (!areStringListsEqual(value.retrievalTerms, suggestion.retrievalTerms)) {
    items.push("检索词已人工修订。");
  }

  return items;
}

function formatRuleTypeLabel(value: RuleWizardSemanticViewModel["ruleType"]): string {
  switch (value) {
    case "terminology_consistency":
      return "术语统一";
    case "format_normalization":
      return "格式规范";
    case "content_requirement":
      return "内容要求";
    case "citation_requirement":
      return "引文要求";
    case "other":
    default:
      return "其他规则";
  }
}

function formatRiskLevelLabel(value: RuleWizardSemanticViewModel["riskLevel"]): string {
  switch (value) {
    case "high":
      return "高风险";
    case "low":
      return "低风险";
    case "medium":
    default:
      return "中风险";
  }
}

function formatModuleLabel(value: RuleWizardSemanticViewModel["moduleScope"]): string {
  return formatEditorialModuleLabel(value);
}

const manuscriptTypeOptions: readonly ManuscriptType[] = EDITORIAL_MANUSCRIPT_TYPE_OPTIONS;

function RuleWizardMultiSelectField(props: {
  label: string;
  value: RuleWizardConfirmFormState["manuscriptTypes"];
  options: ReadonlyArray<SearchableMultiSelectOption>;
  dataKey: string;
  includeAnyOption?: boolean;
  onToggleValue(value: string): void;
  onSelectAny?: () => void;
}) {
  return (
    <SearchableMultiSelectField
      label={props.label}
      helpText={
        props.includeAnyOption ? "支持“全部/任意”和多选切换。" : "支持结构化多选。"
      }
      value={props.value}
      options={props.options}
      dataKey={props.dataKey}
      rootDataAttributeName="data-rule-wizard-multi-select"
      className="knowledge-library-structured-field knowledge-library-form-full"
      headerClassName="knowledge-library-structured-field-header"
      searchFieldClassName="knowledge-library-grid-search"
      searchPlaceholder={
        props.dataKey === "confirm-manuscript-types"
          ? "\u93bc\u6ec5\u50a8\u7ecb\u5938\u6b22\u7eeb\u8bf2\u7037"
          : `搜索${props.label}`
      }
      optionsClassName="knowledge-library-toggle-group"
      optionClassName="knowledge-library-toggle-chip"
      emptyClassName="knowledge-library-structured-empty"
      includeAnyOption={props.includeAnyOption}
      noResultsText="未找到匹配的选项。"
      onToggleValue={props.onToggleValue}
      onSelectAny={props.onSelectAny}
    />
  );
}

function RuleWizardTagListField(props: {
  label: string;
  values: string[];
  dataKey: string;
  addActionKey: string;
  addLabel: string;
  emptyText: string;
  placeholder: string;
  onAdd(): void;
  onChangeValue(index: number, value: string): void;
  onRemove(index: number): void;
}) {
  return (
    <div
      className="knowledge-library-structured-field knowledge-library-form-full"
      data-rule-wizard-tag-list={props.dataKey}
    >
      <div className="knowledge-library-structured-field-header">
        <span>{props.label}</span>
        <small>一行一个检索词，可逐条补充和删除。</small>
      </div>
      <div className="knowledge-library-tag-editor-list">
        {props.values.length > 0 ? (
          props.values.map((item, index) => (
            <div key={`${props.dataKey}-${index}`} className="knowledge-library-tag-editor-row">
              <input
                value={item}
                onChange={(event) => props.onChangeValue(index, event.target.value)}
                placeholder={props.placeholder}
              />
              <button type="button" onClick={() => props.onRemove(index)}>
                删除
              </button>
            </div>
          ))
        ) : (
          <p className="knowledge-library-structured-empty">{props.emptyText}</p>
        )}
      </div>
      <button
        type="button"
        className="knowledge-library-secondary-button"
        data-rule-wizard-tag-action={props.addActionKey}
        onClick={props.onAdd}
      >
        {props.addLabel}
      </button>
    </div>
  );
}

function toggleManuscriptTypeSelection(
  current: RuleWizardConfirmFormState["manuscriptTypes"],
  value: ManuscriptType,
): RuleWizardConfirmFormState["manuscriptTypes"] {
  const currentValues = current === "any" ? [] : current;
  const nextValues = toggleStringSelection(currentValues, value) as ManuscriptType[];
  return nextValues.length > 0 ? nextValues : "any";
}

function toggleStringSelection(current: string[], value: string): string[] {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

function updateStringListValue(values: string[], index: number, value: string): string[] {
  return values.map((currentValue, currentIndex) =>
    currentIndex === index ? value : currentValue,
  );
}

function removeStringListValue(values: string[], index: number): string[] {
  return values.filter((_, currentIndex) => currentIndex !== index);
}

function areStringListsEqual(left: readonly string[], right: readonly string[]): boolean {
  return normalizeStringList(left).join("\u0000") === normalizeStringList(right).join("\u0000");
}

function normalizeStringList(values: readonly string[]): string[] {
  return values.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

function areManuscriptTypesEqual(
  left: RuleWizardConfirmFormState["manuscriptTypes"],
  right: RuleWizardSemanticViewModel["manuscriptTypes"],
): boolean {
  return serializeManuscriptTypes(left) === serializeManuscriptTypes(right);
}

function serializeManuscriptTypes(
  value: RuleWizardConfirmFormState["manuscriptTypes"] | RuleWizardSemanticViewModel["manuscriptTypes"],
): string {
  if (value === "any") {
    return "any";
  }

  return [...value].sort().join("\u0000");
}

function formatManuscriptTypesLabel(
  value: RuleWizardConfirmFormState["manuscriptTypes"] | RuleWizardSemanticViewModel["manuscriptTypes"],
): string {
  if (value === "any") {
    return "全部 / 任意";
  }

  return value.map((item) => formatManuscriptTypeLabel(item)).join("、");
}

function formatManuscriptTypeLabel(value: ManuscriptType): string {
  return formatEditorialManuscriptTypeLabel(value);
}
