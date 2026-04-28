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
      </header>

      <div className="template-governance-rule-entry-layout">
        <section className="template-governance-card template-governance-rule-entry-canvas">
          <header className="template-governance-rule-section-heading">
            <div>
              <h3>录入画布</h3>
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
            </header>
            <KnowledgeLibraryRichContentEditor
              blocks={value.supplementalBlocks ?? []}
              onChange={(supplementalBlocks) => onChange({ ...value, supplementalBlocks })}
              onUploadImage={onUploadImage}
              compact
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
        ""
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
