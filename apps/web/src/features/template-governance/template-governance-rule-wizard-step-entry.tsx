import type { KnowledgeSourceType } from "../knowledge/index.ts";
import { KnowledgeLibraryRichContentEditor } from "../knowledge-library/knowledge-library-rich-content-editor.tsx";
import type {
  KnowledgeUploadInput,
  KnowledgeUploadViewModel,
} from "../knowledge-library/types.ts";
import type { ManuscriptModule } from "../manuscripts/types.ts";
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
              <p>这里支持上传真实图片、录入表格，或补充额外文字块作为证据材料。</p>
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
                  onChange={(event) => onChange({ ...value, sections: event.target.value })}
                  placeholder="abstract, discussion"
                />
              </label>
              <label className="template-governance-field">
                <span>风险标签</span>
                <input
                  value={value.riskTags}
                  onChange={(event) => onChange({ ...value, riskTags: event.target.value })}
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
              <p>先完成主画布录入，再补章节、风险、规则包提示和冲突边界，首屏会更清楚。</p>
            </div>
          </div>
        </aside>
      </div>
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
