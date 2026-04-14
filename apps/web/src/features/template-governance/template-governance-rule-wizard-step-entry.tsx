import type { KnowledgeSourceType } from "../knowledge/index.ts";
import type { ManuscriptModule } from "../manuscripts/types.ts";
import type { RuleWizardEntryFormState } from "./template-governance-rule-wizard-api.ts";

export interface TemplateGovernanceRuleWizardStepEntryProps {
  value: RuleWizardEntryFormState;
  onChange: (nextValue: RuleWizardEntryFormState) => void;
}

const moduleOptions: Array<ManuscriptModule | "any"> = [
  "any",
  "screening",
  "editing",
  "proofreading",
];

const sourceTypeOptions: KnowledgeSourceType[] = [
  "guideline",
  "paper",
  "book",
  "website",
  "internal_case",
  "other",
];

export function TemplateGovernanceRuleWizardStepEntry({
  value,
  onChange,
}: TemplateGovernanceRuleWizardStepEntryProps) {
  return (
    <article className="template-governance-card template-governance-ledger-section">
      <header className="template-governance-ledger-section-header">
        <h2>基础录入与证据补充</h2>
        <p>先把规则正文、示例、图证和来源依据补齐，再进入 AI 语义理解。</p>
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
            onChange={(event) =>
              onChange({ ...value, contributor: event.target.value })
            }
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
            onChange={(event) =>
              onChange({ ...value, ruleBody: event.target.value })
            }
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
        <label className="template-governance-field">
          <span>图片 / 图表 / 截图</span>
          <textarea
            rows={4}
            value={value.imageEvidence}
            onChange={(event) =>
              onChange({ ...value, imageEvidence: event.target.value })
            }
            placeholder="可补充图证说明或截图备注"
          />
        </label>
        <label className="template-governance-field">
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
          <label className="template-governance-field">
            <span>稿件类型</span>
            <input
              value={value.manuscriptTypes}
              onChange={(event) =>
                onChange({ ...value, manuscriptTypes: event.target.value })
              }
              placeholder="clinical_study"
            />
          </label>
          <label className="template-governance-field">
            <span>章节标签</span>
            <input
              value={value.sections}
              onChange={(event) =>
                onChange({ ...value, sections: event.target.value })
              }
              placeholder="abstract, discussion"
            />
          </label>
          <label className="template-governance-field">
            <span>风险标签</span>
            <input
              value={value.riskTags}
              onChange={(event) =>
                onChange({ ...value, riskTags: event.target.value })
              }
              placeholder="terminology, consistency"
            />
          </label>
          <label className="template-governance-field">
            <span>规则包提示</span>
            <input
              value={value.packageHints}
              onChange={(event) =>
                onChange({ ...value, packageHints: event.target.value })
              }
              placeholder="general-package"
            />
          </label>
          <label className="template-governance-field">
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
    </article>
  );
}

function formatModuleLabel(value: ManuscriptModule | "any"): string {
  switch (value) {
    case "screening":
      return "初筛";
    case "editing":
      return "编辑";
    case "proofreading":
      return "校对";
    case "any":
    default:
      return "全部模块";
  }
}

function formatSourceTypeLabel(value: KnowledgeSourceType): string {
  switch (value) {
    case "guideline":
      return "指南";
    case "paper":
      return "论文";
    case "book":
      return "图书";
    case "website":
      return "网站";
    case "internal_case":
      return "内部案例";
    case "other":
    default:
      return "其他";
  }
}
