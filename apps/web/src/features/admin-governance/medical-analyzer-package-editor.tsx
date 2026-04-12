type MedicalAnalyzerSeverity = "low" | "medium" | "high" | "critical";
type MedicalAnalyzerAction =
  | "auto_fix"
  | "suggest_fix"
  | "manual_review"
  | "block";

export interface MedicalAnalyzerPackageDraft {
  indicators: string;
  unitRanges: string;
  prePostTemplates: string;
  groupComparisonTemplates: string;
  percentMax: string;
  unitRangeConflictSeverity: MedicalAnalyzerSeverity;
  unitRangeConflictAction: MedicalAnalyzerAction;
  significanceMismatchSeverity: MedicalAnalyzerSeverity;
  significanceMismatchAction: MedicalAnalyzerAction;
  tableTextDirectionSeverity: MedicalAnalyzerSeverity;
  tableTextDirectionAction: MedicalAnalyzerAction;
  numericConsistencyEnabled: boolean;
  medicalLogicEnabled: boolean;
  tableTextConsistencyEnabled: boolean;
}

export interface MedicalAnalyzerPackageEditorProps {
  manifest: Record<string, unknown>;
  onChange: (nextManifest: Record<string, unknown>) => void;
  disabled?: boolean;
}

const defaultDraft: MedicalAnalyzerPackageDraft = {
  indicators: [
    "ALT | alanine aminotransferase | U/L",
    "AST | aspartate aminotransferase | U/L",
  ].join("\n"),
  unitRanges: [
    "ALT | U/L | 0 | 1000",
    "percent | % | 0 | 100",
  ].join("\n"),
  prePostTemplates: "before treatment|after treatment, baseline|follow-up",
  groupComparisonTemplates: "treatment group|control group",
  percentMax: "100",
  unitRangeConflictSeverity: "high",
  unitRangeConflictAction: "manual_review",
  significanceMismatchSeverity: "high",
  significanceMismatchAction: "manual_review",
  tableTextDirectionSeverity: "high",
  tableTextDirectionAction: "manual_review",
  numericConsistencyEnabled: true,
  medicalLogicEnabled: true,
  tableTextConsistencyEnabled: true,
};

const severityOptions: MedicalAnalyzerSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];
const actionOptions: MedicalAnalyzerAction[] = [
  "auto_fix",
  "suggest_fix",
  "manual_review",
  "block",
];

export function MedicalAnalyzerPackageEditor(
  props: MedicalAnalyzerPackageEditorProps,
) {
  const draft = parseMedicalAnalyzerPackageManifestDraft(props.manifest);

  return (
    <div className="admin-governance-panel admin-governance-panel-nested">
      <h4>Structured Medical Analyzer Rules</h4>
      <p className="admin-governance-empty">
        Maintain governed medical analyzers here. The editor keeps indicator dictionaries, ranges,
        policies, and toggles aligned with the worker-facing medical package schema.
      </p>

      <div className="admin-governance-form-grid">
        <label className="admin-governance-field">
          <span>Indicator Dictionary</span>
          <textarea
            value={draft.indicators}
            onChange={(event) =>
              props.onChange(
                buildMedicalAnalyzerPackageManifest({
                  ...draft,
                  indicators: event.target.value,
                }),
              )
            }
            rows={4}
            disabled={props.disabled}
          />
        </label>

        <label className="admin-governance-field">
          <span>Unit Ranges</span>
          <textarea
            value={draft.unitRanges}
            onChange={(event) =>
              props.onChange(
                buildMedicalAnalyzerPackageManifest({
                  ...draft,
                  unitRanges: event.target.value,
                }),
              )
            }
            rows={4}
            disabled={props.disabled}
          />
        </label>
      </div>

      <div className="admin-governance-form-grid">
        <label className="admin-governance-field">
          <span>Pre/Post Templates</span>
          <textarea
            value={draft.prePostTemplates}
            onChange={(event) =>
              props.onChange(
                buildMedicalAnalyzerPackageManifest({
                  ...draft,
                  prePostTemplates: event.target.value,
                }),
              )
            }
            rows={3}
            disabled={props.disabled}
          />
        </label>

        <label className="admin-governance-field">
          <span>Group Comparison Templates</span>
          <textarea
            value={draft.groupComparisonTemplates}
            onChange={(event) =>
              props.onChange(
                buildMedicalAnalyzerPackageManifest({
                  ...draft,
                  groupComparisonTemplates: event.target.value,
                }),
              )
            }
            rows={3}
            disabled={props.disabled}
          />
        </label>

        <label className="admin-governance-field">
          <span>Percent Max</span>
          <input
            type="text"
            value={draft.percentMax}
            onChange={(event) =>
              props.onChange(
                buildMedicalAnalyzerPackageManifest({
                  ...draft,
                  percentMax: event.target.value,
                }),
              )
            }
            disabled={props.disabled}
          />
        </label>
      </div>

      <div className="admin-governance-policy-grid">
        <MedicalPolicyCard
          label="Unit Range Conflict"
          severity={draft.unitRangeConflictSeverity}
          action={draft.unitRangeConflictAction}
          onSeverityChange={(severity) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                unitRangeConflictSeverity: severity,
              }),
            )
          }
          onActionChange={(action) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                unitRangeConflictAction: action,
              }),
            )
          }
          disabled={props.disabled}
        />
        <MedicalPolicyCard
          label="Significance Mismatch"
          severity={draft.significanceMismatchSeverity}
          action={draft.significanceMismatchAction}
          onSeverityChange={(severity) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                significanceMismatchSeverity: severity,
              }),
            )
          }
          onActionChange={(action) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                significanceMismatchAction: action,
              }),
            )
          }
          disabled={props.disabled}
        />
        <MedicalPolicyCard
          label="Table Text Direction Conflict"
          severity={draft.tableTextDirectionSeverity}
          action={draft.tableTextDirectionAction}
          onSeverityChange={(severity) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                tableTextDirectionSeverity: severity,
              }),
            )
          }
          onActionChange={(action) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                tableTextDirectionAction: action,
              }),
            )
          }
          disabled={props.disabled}
        />
      </div>

      <fieldset className="admin-governance-module-selector">
        <legend>Analyzer Toggles</legend>
        <div className="admin-governance-module-options">
          <ToggleCheckbox
            label="Numeric Consistency"
            checked={draft.numericConsistencyEnabled}
            onChange={(checked) =>
              props.onChange(
                buildMedicalAnalyzerPackageManifest({
                  ...draft,
                  numericConsistencyEnabled: checked,
                }),
              )
            }
            disabled={props.disabled}
          />
          <ToggleCheckbox
            label="Medical Logic"
            checked={draft.medicalLogicEnabled}
            onChange={(checked) =>
              props.onChange(
                buildMedicalAnalyzerPackageManifest({
                  ...draft,
                  medicalLogicEnabled: checked,
                }),
              )
            }
            disabled={props.disabled}
          />
          <ToggleCheckbox
            label="Table Text Consistency"
            checked={draft.tableTextConsistencyEnabled}
            onChange={(checked) =>
              props.onChange(
                buildMedicalAnalyzerPackageManifest({
                  ...draft,
                  tableTextConsistencyEnabled: checked,
                }),
              )
            }
            disabled={props.disabled}
          />
        </div>
      </fieldset>
    </div>
  );
}

interface MedicalPolicyCardProps {
  label: string;
  severity: MedicalAnalyzerSeverity;
  action: MedicalAnalyzerAction;
  onSeverityChange: (severity: MedicalAnalyzerSeverity) => void;
  onActionChange: (action: MedicalAnalyzerAction) => void;
  disabled?: boolean;
}

function MedicalPolicyCard(props: MedicalPolicyCardProps) {
  return (
    <article className="admin-governance-asset-row">
      <span>{props.label}</span>
      <div className="admin-governance-form-grid">
        <label className="admin-governance-field">
          <span>Severity</span>
          <select
            value={props.severity}
            onChange={(event) =>
              props.onSeverityChange(event.target.value as MedicalAnalyzerSeverity)
            }
            disabled={props.disabled}
          >
            {severityOptions.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-governance-field">
          <span>Action</span>
          <select
            value={props.action}
            onChange={(event) =>
              props.onActionChange(event.target.value as MedicalAnalyzerAction)
            }
            disabled={props.disabled}
          >
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}

interface ToggleCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleCheckbox(props: ToggleCheckboxProps) {
  return (
    <label className="admin-governance-module-option">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
        disabled={props.disabled}
      />
      <span>{props.label}</span>
    </label>
  );
}

export function createDefaultMedicalAnalyzerPackageManifest(): Record<string, unknown> {
  return buildMedicalAnalyzerPackageManifest(defaultDraft);
}

export function buildMedicalAnalyzerPackageManifest(
  draft: MedicalAnalyzerPackageDraft,
): Record<string, unknown> {
  return {
    indicator_dictionary: parseIndicatorDictionary(draft.indicators),
    unit_ranges: parseUnitRanges(draft.unitRanges),
    comparison_templates: {
      pre_post: splitCommaSeparated(draft.prePostTemplates),
      group_comparison: splitCommaSeparated(draft.groupComparisonTemplates),
    },
    count_constraints: {
      percent: {
        max_percent: Number.parseFloat(draft.percentMax || defaultDraft.percentMax),
      },
    },
    issue_policy: {
      unit_range_conflict: {
        severity: draft.unitRangeConflictSeverity,
        action: draft.unitRangeConflictAction,
      },
      significance_claim_conflict: {
        severity: draft.significanceMismatchSeverity,
        action: draft.significanceMismatchAction,
      },
      table_text_direction_conflict: {
        severity: draft.tableTextDirectionSeverity,
        action: draft.tableTextDirectionAction,
      },
    },
    analyzer_toggles: {
      numeric_consistency: draft.numericConsistencyEnabled,
      medical_logic: draft.medicalLogicEnabled,
      table_text_consistency: draft.tableTextConsistencyEnabled,
    },
  };
}

export function parseMedicalAnalyzerPackageManifestDraft(
  manifest: Record<string, unknown>,
): MedicalAnalyzerPackageDraft {
  const indicatorDictionary = asRecord(manifest.indicator_dictionary);
  const unitRanges = asRecord(manifest.unit_ranges);
  const comparisonTemplates = asRecord(manifest.comparison_templates);
  const countConstraints = asRecord(manifest.count_constraints);
  const percentConstraint = asRecord(countConstraints?.percent);
  const issuePolicy = asRecord(manifest.issue_policy);
  const analyzerToggles = asRecord(manifest.analyzer_toggles);

  return {
    indicators: serializeIndicatorDictionary(indicatorDictionary),
    unitRanges: serializeUnitRanges(unitRanges),
    prePostTemplates: joinCommaSeparated(
      readStringArray(
        comparisonTemplates?.pre_post,
        splitCommaSeparated(defaultDraft.prePostTemplates),
      ),
    ),
    groupComparisonTemplates: joinCommaSeparated(
      readStringArray(
        comparisonTemplates?.group_comparison,
        splitCommaSeparated(defaultDraft.groupComparisonTemplates),
      ),
    ),
    percentMax: String(
      readNumber(
        percentConstraint?.max_percent,
        Number.parseFloat(defaultDraft.percentMax),
      ),
    ),
    unitRangeConflictSeverity: readPolicySeverity(
      issuePolicy?.unit_range_conflict,
      defaultDraft.unitRangeConflictSeverity,
    ),
    unitRangeConflictAction: readPolicyAction(
      issuePolicy?.unit_range_conflict,
      defaultDraft.unitRangeConflictAction,
    ),
    significanceMismatchSeverity: readPolicySeverity(
      issuePolicy?.significance_claim_conflict,
      defaultDraft.significanceMismatchSeverity,
    ),
    significanceMismatchAction: readPolicyAction(
      issuePolicy?.significance_claim_conflict,
      defaultDraft.significanceMismatchAction,
    ),
    tableTextDirectionSeverity: readPolicySeverity(
      issuePolicy?.table_text_direction_conflict,
      defaultDraft.tableTextDirectionSeverity,
    ),
    tableTextDirectionAction: readPolicyAction(
      issuePolicy?.table_text_direction_conflict,
      defaultDraft.tableTextDirectionAction,
    ),
    numericConsistencyEnabled: readBoolean(
      analyzerToggles?.numeric_consistency,
      defaultDraft.numericConsistencyEnabled,
    ),
    medicalLogicEnabled: readBoolean(
      analyzerToggles?.medical_logic,
      defaultDraft.medicalLogicEnabled,
    ),
    tableTextConsistencyEnabled: readBoolean(
      analyzerToggles?.table_text_consistency,
      defaultDraft.tableTextConsistencyEnabled,
    ),
  };
}

function parseIndicatorDictionary(text: string): Record<string, unknown> {
  const dictionary: Record<string, unknown> = {};

  for (const line of splitLines(text)) {
    const [metric, aliasesText, defaultUnit] = line.split("|").map((part) => part.trim());
    if (!metric) {
      continue;
    }

    dictionary[metric] = {
      aliases: splitCommaSeparated(aliasesText),
      ...(defaultUnit ? { default_unit: defaultUnit } : {}),
    };
  }

  return dictionary;
}

function parseUnitRanges(text: string): Record<string, unknown> {
  const ranges: Record<string, Array<Record<string, number | string>>> = {};

  for (const line of splitLines(text)) {
    const [metric, unit, minText, maxText] = line.split("|").map((part) => part.trim());
    if (!metric || !unit) {
      continue;
    }

    const entry: Record<string, number | string> = { unit };
    const minValue = parseOptionalNumber(minText);
    const maxValue = parseOptionalNumber(maxText);
    if (minValue !== undefined) {
      entry.min = minValue;
    }
    if (maxValue !== undefined) {
      entry.max = maxValue;
    }

    ranges[metric] ??= [];
    ranges[metric].push(entry);
  }

  return ranges;
}

function serializeIndicatorDictionary(
  dictionary: Record<string, unknown> | null,
): string {
  if (!dictionary) {
    return defaultDraft.indicators;
  }

  const lines = Object.entries(dictionary)
    .map(([metric, rawDefinition]) => {
      const definition = asRecord(rawDefinition);
      if (!definition) {
        return null;
      }
      const aliases = joinCommaSeparated(readStringArray(definition.aliases, []));
      const defaultUnit = readString(definition.default_unit, "");
      return [metric, aliases, defaultUnit].join(" | ").trim();
    })
    .filter((line): line is string => line !== null && line.length > 0);

  return lines.length > 0 ? lines.join("\n") : defaultDraft.indicators;
}

function serializeUnitRanges(
  unitRanges: Record<string, unknown> | null,
): string {
  if (!unitRanges) {
    return defaultDraft.unitRanges;
  }

  const lines: string[] = [];
  for (const [metric, rawEntries] of Object.entries(unitRanges)) {
    if (!Array.isArray(rawEntries)) {
      continue;
    }

    for (const rawEntry of rawEntries) {
      const entry = asRecord(rawEntry);
      if (!entry) {
        continue;
      }
      const unit = readString(entry.unit, "");
      if (!unit) {
        continue;
      }

      lines.push(
        [
          metric,
          unit,
          formatOptionalNumber(entry.min),
          formatOptionalNumber(entry.max),
        ].join(" | "),
      );
    }
  }

  return lines.length > 0 ? lines.join("\n") : defaultDraft.unitRanges;
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function splitCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function joinCommaSeparated(values: readonly string[]): string {
  return values.join(", ");
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatOptionalNumber(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const next = value.filter((entry): entry is string => typeof entry === "string");
  return next.length > 0 ? next : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readPolicySeverity(
  value: unknown,
  fallback: MedicalAnalyzerSeverity,
): MedicalAnalyzerSeverity {
  const policy = asRecord(value);
  const severity = policy?.severity;
  return severityOptions.includes(severity as MedicalAnalyzerSeverity)
    ? (severity as MedicalAnalyzerSeverity)
    : fallback;
}

function readPolicyAction(
  value: unknown,
  fallback: MedicalAnalyzerAction,
): MedicalAnalyzerAction {
  const policy = asRecord(value);
  const action = policy?.action;
  return actionOptions.includes(action as MedicalAnalyzerAction)
    ? (action as MedicalAnalyzerAction)
    : fallback;
}
