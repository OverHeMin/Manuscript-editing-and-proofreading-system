import type { KnowledgeSourceType } from "../knowledge/index.ts";
import { KnowledgeLibraryRichContentEditor } from "../knowledge-library/knowledge-library-rich-content-editor.tsx";
import type {
  KnowledgeUploadInput,
  KnowledgeUploadViewModel,
} from "../knowledge-library/types.ts";
import type { ManuscriptModule, ManuscriptType } from "../manuscripts/types.ts";
import {
  EDITORIAL_KNOWLEDGE_SOURCE_TYPE_OPTIONS,
  EDITORIAL_MANUSCRIPT_TYPE_OPTIONS,
  EDITORIAL_SECTION_OPTIONS,
  RULE_WIZARD_MODULE_SCOPE_OPTIONS,
  formatEditorialKnowledgeSourceTypeLabel,
  formatEditorialManuscriptTypeLabel,
  formatEditorialModuleLabel,
  formatEditorialSectionLabel,
} from "../shared/editorial-taxonomy.ts";
import {
  SearchableMultiSelectField,
  type SearchableMultiSelectOption,
} from "../../lib/searchable-multi-select.tsx";
import type { RuleWizardEntryFormState } from "./template-governance-rule-wizard-api.ts";

if (typeof document !== "undefined") {
  void import("../knowledge-library/knowledge-library-ledger-page.css");
  void import("../knowledge-library/knowledge-library-workbench.css");
}

export interface TemplateGovernanceRuleWizardStepEntryProps {
  value: RuleWizardEntryFormState;
  onChange: (nextValue: RuleWizardEntryFormState) => void;
  onUploadImage?: (input: KnowledgeUploadInput) => Promise<KnowledgeUploadViewModel | void>;
}

const moduleOptions: ReadonlyArray<ManuscriptModule | "any"> =
  RULE_WIZARD_MODULE_SCOPE_OPTIONS;

const sourceTypeOptions: readonly KnowledgeSourceType[] =
  EDITORIAL_KNOWLEDGE_SOURCE_TYPE_OPTIONS;

const manuscriptTypeOptions: readonly ManuscriptType[] =
  EDITORIAL_MANUSCRIPT_TYPE_OPTIONS;

const sectionOptions = EDITORIAL_SECTION_OPTIONS;

export function TemplateGovernanceRuleWizardStepEntry({
  value,
  onChange,
  onUploadImage,
}: TemplateGovernanceRuleWizardStepEntryProps) {
  return (
    <article className="template-governance-card template-governance-ledger-section">
      <header className="template-governance-ledger-section-header">
        <h2>基础录入与证据补充</h2>
        <p>先把规则正文、示例、图表证据和来源依据补齐，再进入 AI 语义理解。</p>
      </header>

      <div className="template-governance-rule-entry-layout">
        <section className="template-governance-card template-governance-rule-entry-canvas">
          <header className="template-governance-rule-section-heading">
            <div>
              <h3>录入画布</h3>
              <p>围绕一条规则完成正文、证据和来源录入，保证后续 AI 识别有足够上下文。</p>
            </div>
          </header>

          <div className="template-governance-detail-grid">
            <label className="template-governance-field">
              <span>规则名称</span>
              <input
                value={value.title}
                onChange={(event) => onChange({ ...value, title: event.target.value })}
                placeholder="术语统一规则"
              />
            </label>
            <label className="template-governance-field">
              <span>适用模块</span>
              <select
                value={value.moduleScope}
                onChange={(event) =>
                  onChange({
                    ...value,
                    moduleScope: event.target.value as RuleWizardEntryFormState["moduleScope"],
                  })
                }
              >
                {moduleOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatModuleLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="template-governance-field">
              <span>来源类型</span>
              <select
                value={value.sourceType}
                onChange={(event) =>
                  onChange({
                    ...value,
                    sourceType: event.target.value as KnowledgeSourceType,
                  })
                }
              >
                {sourceTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatSourceTypeLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="template-governance-field">
              <span>贡献者</span>
              <input
                value={value.contributor}
                onChange={(event) => onChange({ ...value, contributor: event.target.value })}
                placeholder="editor.zh"
              />
            </label>
          </div>

          <div className="template-governance-detail-grid">
            <label className="template-governance-field template-governance-field-full">
              <span>规则正文</span>
              <textarea
                rows={5}
                value={value.ruleBody}
                onChange={(event) => onChange({ ...value, ruleBody: event.target.value })}
                placeholder="医学术语应全文统一。"
              />
            </label>
            <label className="template-governance-field">
              <span>正例示例</span>
              <textarea
                rows={4}
                value={value.positiveExample}
                onChange={(event) =>
                  onChange({ ...value, positiveExample: event.target.value })
                }
                placeholder="正确用法示例"
              />
            </label>
            <label className="template-governance-field">
              <span>反例示例</span>
              <textarea
                rows={4}
                value={value.negativeExample}
                onChange={(event) =>
                  onChange({ ...value, negativeExample: event.target.value })
                }
                placeholder="错误用法示例"
              />
            </label>
            <label className="template-governance-field template-governance-field-full">
              <span>来源依据</span>
              <textarea
                rows={4}
                value={value.sourceBasis}
                onChange={(event) =>
                  onChange({ ...value, sourceBasis: event.target.value })
                }
                placeholder="来源章节、指南条款或审核依据"
              />
            </label>
          </div>

          <section className="template-governance-card template-governance-ledger-section">
            <header className="template-governance-ledger-section-header">
              <h2>图片 / 图表 / 截图</h2>
              <p>这里支持上传真实图片、录入表格，或补充额外文本块作为证据材料。</p>
            </header>
            <KnowledgeLibraryRichContentEditor
              blocks={value.supplementalBlocks ?? []}
              onChange={(supplementalBlocks) => onChange({ ...value, supplementalBlocks })}
              onUploadImage={onUploadImage}
            />
          </section>

          <div className="template-governance-actions">
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  advancedTagsExpanded: !value.advancedTagsExpanded,
                })
              }
            >
              {value.advancedTagsExpanded ? "收起高级标签" : "展开高级标签"}
            </button>
          </div>

          {value.advancedTagsExpanded ? (
            <div className="template-governance-detail-grid">
              <RuleWizardMultiSelectField
                label="稿件类型"
                value={value.manuscriptTypes}
                options={manuscriptTypeOptions.map((option) => ({
                  value: option,
                  label: formatManuscriptTypeLabel(option),
                }))}
                dataKey="manuscript-types"
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
              <RuleWizardMultiSelectField
                label="章节标签"
                value={value.sections}
                options={sectionOptions.map((option) => ({
                  value: option,
                  label: formatSectionLabel(option),
                }))}
                dataKey="sections"
                onToggleValue={(nextValue) =>
                  onChange({
                    ...value,
                    sections: toggleStringSelection(value.sections, nextValue),
                  })
                }
              />
              <RuleWizardTagListField
                label="风险标签"
                values={value.riskTags}
                dataKey="risk-tags"
                addLabel="添加风险标签"
                emptyText="暂未添加风险标签。"
                onAdd={() =>
                  onChange({
                    ...value,
                    riskTags: [...value.riskTags, ""],
                  })
                }
                onChangeValue={(index, nextValue) =>
                  onChange({
                    ...value,
                    riskTags: updateStringListValue(value.riskTags, index, nextValue),
                  })
                }
                onRemove={(index) =>
                  onChange({
                    ...value,
                    riskTags: removeStringListValue(value.riskTags, index),
                  })
                }
              />
              <RuleWizardTagListField
                label="规则包提示"
                values={value.packageHints}
                dataKey="package-hints"
                addLabel="添加规则包提示"
                emptyText="暂未添加规则包提示。"
                onAdd={() =>
                  onChange({
                    ...value,
                    packageHints: [...value.packageHints, ""],
                  })
                }
                onChangeValue={(index, nextValue) =>
                  onChange({
                    ...value,
                    packageHints: updateStringListValue(
                      value.packageHints,
                      index,
                      nextValue,
                    ),
                  })
                }
                onRemove={(index) =>
                  onChange({
                    ...value,
                    packageHints: removeStringListValue(value.packageHints, index),
                  })
                }
              />
              <label className="template-governance-field template-governance-field-full">
                <span>冲突备注</span>
                <textarea
                  rows={3}
                  value={value.conflictNotes}
                  onChange={(event) =>
                    onChange({ ...value, conflictNotes: event.target.value })
                  }
                />
              </label>
            </div>
          ) : null}
        </section>

        <aside className="template-governance-card template-governance-rule-entry-rail">
          <header className="template-governance-rule-section-heading">
            <div>
              <h3>AI 辅助提示</h3>
              <p>这一侧只给录入建议，不在这里提前做最终决策。</p>
            </div>
          </header>

          <div className="template-governance-rule-hint-list">
            <div className="template-governance-rule-hint-card">
              <strong>优先补齐高价值证据</strong>
              <p>至少补充正文、一个示例和来源依据，AI 识别的可信度会明显更高。</p>
            </div>
            <div className="template-governance-rule-hint-card">
              <strong>图片和表格直接上传或录入</strong>
              <p>不要再把图表写成备注，直接添加图片块或表格块，后续查看和编辑会更清晰。</p>
            </div>
            <div className="template-governance-rule-hint-card">
              <strong>复杂标签放到高级区</strong>
              <p>先完成主画布录入，再展开高级标签补章节、风险和规则包提示，避免首屏过载。</p>
            </div>
          </div>
          <div className="template-governance-rule-hint-list">
            <div className="template-governance-rule-hint-card">
              <strong>这版向导只开放高频治理参数</strong>
              <p>先把规则正文、证据、适用范围和发布动作做对，避免首次录入时被低频参数打断。</p>
            </div>
            <div className="template-governance-rule-hint-card">
              <strong>低频运行参数继续放在旧工作台</strong>
              <p>当前向导优先解决建立和修订，结构化运行细节仍保留在旧版高级工作台，按需再进去补。</p>
            </div>
            <div className="template-governance-rule-hint-card">
              <strong>适用模块决定规则在哪个执行环节被调用</strong>
              <p>如果一条规则只对编辑或校对生效，尽量在这里提前收窄，不要全部都挂到“全模块”。</p>
            </div>
            <div className="template-governance-rule-hint-card">
              <strong>章节标签和风险标签放到高级标签里补充</strong>
              <p>先完成主画布录入，再补章节、风险、规则包提示和冲突边界，首屏会更清晰。</p>
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}

function RuleWizardMultiSelectField(props: {
  label: string;
  value: string[] | "any";
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
        props.includeAnyOption ? "\u652f\u6301\u201c\u5168\u90e8/\u4efb\u610f\u201d\u548c\u591a\u9009\u5207\u6362\u3002" : "\u652f\u6301\u7ed3\u6784\u5316\u591a\u9009\u3002"
      }
      value={props.value}
      options={props.options}
      dataKey={props.dataKey}
      rootDataAttributeName="data-rule-wizard-multi-select"
      className="knowledge-library-structured-field knowledge-library-form-full"
      headerClassName="knowledge-library-structured-field-header"
      searchFieldClassName="knowledge-library-grid-search"
      searchPlaceholder={`\u641c\u7d22${props.label}`}
      optionsClassName="knowledge-library-toggle-group"
      optionClassName="knowledge-library-toggle-chip"
      emptyClassName="knowledge-library-structured-empty"
      includeAnyOption={props.includeAnyOption}
      noResultsText="\u672a\u627e\u5230\u5339\u914d\u7684\u9009\u9879\u3002"
      onToggleValue={props.onToggleValue}
      onSelectAny={props.onSelectAny}
    />
  );
}

function RuleWizardTagListField(props: {
  label: string;
  values: string[];
  dataKey: string;
  addLabel: string;
  emptyText: string;
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
        <small>一行一个标签，可逐条补充和删除。</small>
      </div>
      <div className="knowledge-library-tag-editor-list">
        {props.values.length > 0 ? (
          props.values.map((item, index) => (
            <div key={`${props.dataKey}-${index}`} className="knowledge-library-tag-editor-row">
              <input
                value={item}
                onChange={(event) => props.onChangeValue(index, event.target.value)}
                placeholder={props.label}
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
        onClick={props.onAdd}
      >
        {props.addLabel}
      </button>
    </div>
  );
}

function toggleManuscriptTypeSelection(
  current: RuleWizardEntryFormState["manuscriptTypes"],
  value: ManuscriptType,
): RuleWizardEntryFormState["manuscriptTypes"] {
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

function formatModuleLabel(value: ManuscriptModule | "any"): string {
  return formatEditorialModuleLabel(value);
}

function formatSourceTypeLabel(value: KnowledgeSourceType): string {
  return formatEditorialKnowledgeSourceTypeLabel(value, "compact");
}

function formatManuscriptTypeLabel(value: ManuscriptType): string {
  return formatEditorialManuscriptTypeLabel(value);
}

function formatSectionLabel(value: (typeof sectionOptions)[number]): string {
  return formatEditorialSectionLabel(value);
}
