import type {
  RuleWizardBindingFormState,
  RuleWizardBindingOptions,
} from "./template-governance-rule-wizard-api.ts";

export interface TemplateGovernanceRuleWizardStepBindingProps {
  value: RuleWizardBindingFormState;
  options?: RuleWizardBindingOptions;
  isBusy?: boolean;
  errorMessage?: string | null;
  onChange: (nextValue: RuleWizardBindingFormState) => void;
}

export function TemplateGovernanceRuleWizardStepBinding({
  value,
  options,
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
    </article>
  );
}
