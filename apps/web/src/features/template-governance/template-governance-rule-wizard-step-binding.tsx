import type { ManuscriptModule } from "../manuscripts/types.ts";
import type {
  RuleWizardBindingFormState,
  RuleWizardBindingOptions,
} from "./template-governance-rule-wizard-api.ts";

export interface TemplateGovernanceRuleWizardStepBindingProps {
  value: RuleWizardBindingFormState;
  options?: RuleWizardBindingOptions;
  moduleScope?: ManuscriptModule | "any";
  manuscriptTypes?: string;
  semanticSummary?: string;
  isBusy?: boolean;
  errorMessage?: string | null;
  onChange: (nextValue: RuleWizardBindingFormState) => void;
}

export function TemplateGovernanceRuleWizardStepBinding({
  value,
  options,
  moduleScope = "editing",
  manuscriptTypes = "clinical_study",
  semanticSummary = "",
  isBusy = false,
  errorMessage = null,
  onChange,
}: TemplateGovernanceRuleWizardStepBindingProps) {
  const packageOptions =
    value.selectedPackageKind === "medical_package"
      ? options?.medicalPackages ?? []
      : options?.generalPackages ?? [];

  return (
    <article className="template-governance-card template-governance-ledger-section">
      <header className="template-governance-ledger-section-header">
        <h2>放入模板 / 规则包</h2>
        <p>用业务语言决定这条规则进入哪个规则包和模板族。</p>
      </header>

      {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}

      <div className="template-governance-rule-hint-list">
        <div className="template-governance-rule-hint-card">
          <strong>规则包决定这条规则先落到哪个复用容器</strong>
          <p>先选通用包还是医学专用包，再决定挂到哪个已有包条目，后续模板复用都会沿着这个容器走。</p>
        </div>
        <div className="template-governance-rule-hint-card">
          <strong>模板族决定哪些稿件默认看见这条规则</strong>
          <p>规则包解决“放哪里复用”，模板族解决“哪类稿件默认拿到这条规则”，两者不要混成同一层。</p>
        </div>
        <div className="template-governance-rule-hint-card">
          <strong>复用策略只处理挂到现有包还是新建绑定</strong>
          <p>它不是创建新规则，而是决定这条已经确认好的规则，优先复用现有容器还是单独挂载。</p>
        </div>
      </div>

      <div className="template-governance-detail-grid">
        <label className="template-governance-field">
          <span>进入哪个规则包</span>
          <select
            value={value.selectedPackageKind}
            onChange={(event) => {
              const nextPackageKind =
                event.target.value as RuleWizardBindingFormState["selectedPackageKind"];
              const nextOptions =
                nextPackageKind === "medical_package"
                  ? options?.medicalPackages ?? []
                  : options?.generalPackages ?? [];
              const nextPackage = nextOptions[0];

              onChange({
                ...value,
                selectedPackageKind: nextPackageKind,
                selectedPackageId: nextPackage?.id ?? "",
                selectedPackageLabel: nextPackage?.label ?? "",
                reuseStrategy:
                  nextPackageKind === "medical_package" ? "reuse_existing" : "new_binding",
              });
            }}
            disabled={isBusy}
          >
            <option value="general_package">通用校对包</option>
            <option value="medical_package">医学专业校对包</option>
          </select>
        </label>

        <label className="template-governance-field">
          <span>规则包条目</span>
          <select
            value={value.selectedPackageId}
            onChange={(event) => {
              const nextPackage =
                packageOptions.find((option) => option.id === event.target.value) ?? null;

              onChange({
                ...value,
                selectedPackageId: event.target.value,
                selectedPackageLabel: nextPackage?.label ?? value.selectedPackageLabel,
              });
            }}
            disabled={isBusy}
          >
            {packageOptions.length ? (
              packageOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))
            ) : (
              <option value="">{value.selectedPackageLabel || "等待加载规则包"}</option>
            )}
          </select>
        </label>
      </div>

      <div className="template-governance-detail-grid">
        <div className="template-governance-field template-governance-field-full">
          <span>关联模板族</span>
          <div className="template-governance-detail-grid">
            {(options?.templateFamilies ?? []).map((family) => {
              const checked = value.selectedTemplateFamilies.some(
                (selected) => selected.id === family.id,
              );

              return (
                <label key={family.id} className="template-governance-field">
                  <span>{family.name}</span>
                  <small>{family.manuscriptType}</small>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isBusy}
                    onChange={(event) => {
                      const nextTemplateFamilies = event.target.checked
                        ? value.selectedTemplateFamilies.concat({
                            id: family.id,
                            name: family.name,
                          })
                        : value.selectedTemplateFamilies.filter(
                            (selected) => selected.id !== family.id,
                          );

                      onChange({
                        ...value,
                        selectedTemplateFamilies: nextTemplateFamilies,
                      });
                    }}
                  />
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="template-governance-rule-impact-grid">
        <section className="template-governance-card template-governance-rule-impact-card">
          <header className="template-governance-rule-section-heading">
            <div>
              <h3>业务调用模块</h3>
              <p>把规则的业务落点说清楚，方便后续规则包和模板族复用。</p>
            </div>
          </header>
          <div className="template-governance-rule-impact-list">
            <div>
              <span>执行模块</span>
              <strong>{formatModuleScopeLabel(moduleScope)}</strong>
            </div>
            <div>
              <span>稿件类型</span>
              <strong>{manuscriptTypes || "any"}</strong>
            </div>
          </div>
        </section>

        <section className="template-governance-card template-governance-rule-impact-card">
          <header className="template-governance-rule-section-heading">
            <div>
              <h3>推荐复用</h3>
              <p>先判断这条规则是挂到现有规则包，还是新开绑定关系。</p>
            </div>
          </header>
          <label className="template-governance-field">
            <span>复用策略</span>
            <select
              value={value.reuseStrategy}
              onChange={(event) =>
                onChange({
                  ...value,
                  reuseStrategy: event.target.value as RuleWizardBindingFormState["reuseStrategy"],
                })
              }
              disabled={isBusy}
            >
              <option value="reuse_existing">优先复用现有规则包</option>
              <option value="new_binding">新建专属绑定</option>
            </select>
          </label>
        </section>

        <section className="template-governance-card template-governance-rule-impact-card">
          <header className="template-governance-rule-section-heading">
            <div>
              <h3>影响预览</h3>
              <p>在发布前提前看到这条规则会落到哪些业务对象。</p>
            </div>
          </header>
          <div className="template-governance-rule-impact-list">
            <div>
              <span>规则包去向</span>
              <strong>{value.selectedPackageLabel || "待选择规则包"}</strong>
            </div>
            <div>
              <span>模板族覆盖</span>
              <strong>
                {value.selectedTemplateFamilies.length
                  ? value.selectedTemplateFamilies.map((family) => family.name).join("、")
                  : "待选择模板族"}
              </strong>
            </div>
            <div>
              <span>规则摘要</span>
              <strong>{semanticSummary || "语义确认后会显示摘要"}</strong>
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}

function formatModuleScopeLabel(value: TemplateGovernanceRuleWizardStepBindingProps["moduleScope"]): string {
  switch (value) {
    case "screening":
      return "初筛";
    case "proofreading":
      return "校对";
    case "editing":
      return "编辑";
    case "any":
    default:
      return "全部模块";
  }
}
