import type {
  ManuscriptQualityPackageViewModel,
} from "../manuscript-quality-packages/index.ts";

export interface RuntimeBindingQualityPackageEditorProps {
  availablePackages: readonly ManuscriptQualityPackageViewModel[];
  selectedVersionIds: readonly string[];
  onChange?: (nextSelectedVersionIds: string[]) => void;
  isMutating: boolean;
  legend?: string;
  emptyMessage?: string;
  readOnly?: boolean;
  showOnlySelected?: boolean;
}

export function RuntimeBindingQualityPackageEditor(
  props: RuntimeBindingQualityPackageEditorProps,
) {
  const visiblePackages = props.availablePackages.filter((record) => {
    const isSelected = props.selectedVersionIds.includes(record.id);

    if (props.showOnlySelected) {
      return isSelected;
    }

    return isSelected || record.status === "published";
  });

  return (
    <fieldset className="admin-governance-module-selector">
      <legend>{props.legend ?? "Quality Packages"}</legend>
      {visiblePackages.length > 0 ? (
        <div className="admin-governance-module-options">
          {visiblePackages.map((record) => {
            const checked = props.selectedVersionIds.includes(record.id);

            return (
              <label key={record.id} className="admin-governance-module-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    if (!props.onChange || props.readOnly) {
                      return;
                    }

                    props.onChange(
                      checked
                        ? props.selectedVersionIds.filter((id) => id !== record.id)
                        : [...props.selectedVersionIds, record.id],
                    );
                  }}
                  disabled={props.isMutating || props.readOnly}
                />
                <span>{formatQualityPackageLabel(record)}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="admin-governance-empty">
          {props.emptyMessage ?? "No quality packages available yet."}
        </p>
      )}
    </fieldset>
  );
}

function formatQualityPackageLabel(
  record: ManuscriptQualityPackageViewModel,
): string {
  return [
    `${record.package_name} v${record.version}`,
    formatQualityPackageKind(record.package_kind),
    record.target_scopes.join(", "),
    record.status,
  ].join(" / ");
}

function formatQualityPackageKind(
  kind: ManuscriptQualityPackageViewModel["package_kind"],
): string {
  switch (kind) {
    case "general_style_package":
      return "General Style";
    case "medical_analyzer_package":
      return "Medical Analyzer";
  }
}
