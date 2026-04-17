import type { ManuscriptModule } from "../manuscripts/types.ts";
import {
  SearchableMultiSelectField,
  type SearchableMultiSelectOption,
} from "../../lib/searchable-multi-select.tsx";
import type {
  RuleWizardBindingFormState,
  RuleWizardBindingOptions,
  RuleWizardConfirmFormState,
} from "./template-governance-rule-wizard-api.ts";
import {
  formatTemplateGovernanceGovernedAssetStatusLabel,
  formatTemplateGovernanceKnowledgeKindLabel,
  formatTemplateGovernanceManuscriptTypeLabel,
  formatTemplateGovernanceModuleLabel,
} from "./template-governance-display.ts";

export interface TemplateGovernanceRuleWizardStepBindingProps {
  value: RuleWizardBindingFormState;
  options?: RuleWizardBindingOptions;
  moduleScope?: ManuscriptModule | "any";
  manuscriptTypes?: RuleWizardConfirmFormState["manuscriptTypes"];
  semanticSummary?: string;
  isBusy?: boolean;
  errorMessage?: string | null;
  onChange: (nextValue: RuleWizardBindingFormState) => void;
}

export function TemplateGovernanceRuleWizardStepBinding({
  value,
  options,
  moduleScope = "editing",
  manuscriptTypes = ["clinical_study"],
  semanticSummary = "",
  isBusy = false,
  errorMessage = null,
  onChange,
}: TemplateGovernanceRuleWizardStepBindingProps) {
  const packageOptions =
    value.selectedPackageKind === "medical_package"
      ? options?.medicalPackages ?? []
      : options?.generalPackages ?? [];
  const knowledgeGroupCounts = buildKnowledgeGroupCounts(options?.knowledgeItems ?? []);
  const knowledgeItemOptions: SearchableMultiSelectOption[] = (options?.knowledgeItems ?? []).map(
    (item) => {
      const knowledgeKindLabel = formatTemplateGovernanceKnowledgeKindLabel(item.knowledgeKind);
      const moduleLabel = formatTemplateGovernanceModuleLabel(item.moduleScope);
      const manuscriptKeywords =
        item.manuscriptTypes === "any"
          ? ["全部 / 任意"]
          : item.manuscriptTypes.map((type) => formatTemplateGovernanceManuscriptTypeLabel(type));

      return {
        value: item.id,
        label: item.label,
        keywords: [
          item.knowledgeKind,
          item.status,
          item.moduleScope,
          knowledgeKindLabel,
          moduleLabel,
          ...manuscriptKeywords,
        ],
        meta: `${knowledgeKindLabel} / ${formatTemplateGovernanceGovernedAssetStatusLabel(item.status)} / ${moduleLabel}`,
        group: `${knowledgeKindLabel}（${knowledgeGroupCounts.get(knowledgeKindLabel) ?? 0}）`,
      };
    },
  );
  const selectedKnowledgeIds = value.selectedKnowledgeItems.map((item) => item.id);
  const selectedKnowledgeOptions: SearchableMultiSelectOption[] = value.selectedKnowledgeItems.map(
    (item) => ({
      value: item.id,
      label: item.title,
    }),
  );

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
                  <small>{formatTemplateGovernanceManuscriptTypeLabel(family.manuscriptType)}</small>
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

      <div className="template-governance-detail-grid">
        <div className="template-governance-field template-governance-field-full">
          <div data-rule-wizard-linked-knowledge="list">
            <SearchableMultiSelectField
              label={"\u5173\u8054\u77e5\u8bc6\u6761\u76ee"}
              helpText={
                "\u5173\u8054\u77e5\u8bc6\u53ea\u5c55\u793a\u5df2\u6279\u51c6\u4e14\u975e\u201c\u89c4\u5219\u6295\u5f71\u201d\u7684\u6761\u76ee\uff0c\u7528\u6765\u628a\u89c4\u5219\u4f9d\u8d56\u7684\u4f9d\u636e\u3001\u51c6\u5219\u6216\u89e3\u91ca\u6027\u77e5\u8bc6\u663e\u5f0f\u6302\u5230\u8fd9\u6761\u89c4\u5219\u4e0a\u3002"
              }
              value={selectedKnowledgeIds}
              options={knowledgeItemOptions}
              dataKey="rule-wizard-linked-knowledge"
              className="template-governance-linked-knowledge"
              headerClassName="template-governance-linked-knowledge-header"
              searchFieldClassName="knowledge-library-grid-search"
              searchPlaceholder={"\u641c\u7d22\u5173\u8054\u77e5\u8bc6\u6761\u76ee"}
              optionsClassName="template-governance-linked-knowledge-list"
              optionClassName="template-governance-linked-knowledge-option"
              emptyClassName="template-governance-inline-empty"
              showSelectedSummary
              selectedOptions={selectedKnowledgeOptions}
              selectedListClassName="template-governance-chip-row"
              selectedChipClassName="template-governance-chip"
              selectedEmptyText={"\u5f53\u524d\u8fd8\u6ca1\u6709\u5173\u8054\u77e5\u8bc6\u6761\u76ee\u3002"}
              emptyOptionsText={
                "\u5f53\u524d\u6ca1\u6709\u53ef\u5173\u8054\u7684\u5df2\u6279\u51c6\u77e5\u8bc6\u6761\u76ee\u3002"
              }
              noResultsText={"\u672a\u627e\u5230\u5339\u914d\u7684\u77e5\u8bc6\u6761\u76ee\u3002"}
              disabled={isBusy}
              onToggleValue={(nextKnowledgeId) => {
                const isActive = value.selectedKnowledgeItems.some(
                  (selected) => selected.id === nextKnowledgeId,
                );
                const matchedKnowledgeItem =
                  options?.knowledgeItems?.find((item) => item.id === nextKnowledgeId) ?? null;
                const nextKnowledgeItems = isActive
                  ? value.selectedKnowledgeItems.filter(
                      (selected) => selected.id !== nextKnowledgeId,
                    )
                  : value.selectedKnowledgeItems.concat({
                      id: nextKnowledgeId,
                      title: matchedKnowledgeItem?.label ?? nextKnowledgeId,
                    });

                onChange({
                  ...value,
                  selectedKnowledgeItems: nextKnowledgeItems,
                });
              }}
            />
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
              <strong>{formatManuscriptTypesSummary(manuscriptTypes)}</strong>
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
              <span>关联知识</span>
              <strong>
                {value.selectedKnowledgeItems.length
                  ? value.selectedKnowledgeItems.map((item) => item.title).join("、")
                  : "待选择知识条目"}
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

function formatModuleScopeLabel(
  value: TemplateGovernanceRuleWizardStepBindingProps["moduleScope"],
): string {
  return formatTemplateGovernanceModuleLabel(value ?? "any");
}

function buildKnowledgeGroupCounts(
  items: RuleWizardBindingOptions["knowledgeItems"],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const item of items) {
    const label = formatTemplateGovernanceKnowledgeKindLabel(item.knowledgeKind);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return counts;
}

function formatManuscriptTypesSummary(
  value: TemplateGovernanceRuleWizardStepBindingProps["manuscriptTypes"],
): string {
  if (value == null || value === "any") {
    return "全部 / 任意";
  }

  return value.map((item) => formatTemplateGovernanceManuscriptTypeLabel(item)).join("、");
}
