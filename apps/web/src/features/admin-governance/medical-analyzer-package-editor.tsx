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
  diagnosticMetricAliases: string;
  diagnosticMetricRanges: string;
  confusionMatrixAliases: string;
  diagnosticConfidenceLevels: string;
  regressionFieldAliases: string;
  regressionConfidenceLevels: string;
  unitRangeConflictSeverity: MedicalAnalyzerSeverity;
  unitRangeConflictAction: MedicalAnalyzerAction;
  significanceMismatchSeverity: MedicalAnalyzerSeverity;
  significanceMismatchAction: MedicalAnalyzerAction;
  tableTextDirectionSeverity: MedicalAnalyzerSeverity;
  tableTextDirectionAction: MedicalAnalyzerAction;
  diagnosticMetricOutOfRangeSeverity: MedicalAnalyzerSeverity;
  diagnosticMetricOutOfRangeAction: MedicalAnalyzerAction;
  diagnosticMetricMismatchSeverity: MedicalAnalyzerSeverity;
  diagnosticMetricMismatchAction: MedicalAnalyzerAction;
  aucConfidenceIntervalSeverity: MedicalAnalyzerSeverity;
  aucConfidenceIntervalAction: MedicalAnalyzerAction;
  regressionCoefficientSeverity: MedicalAnalyzerSeverity;
  regressionCoefficientAction: MedicalAnalyzerAction;
  testStatisticConflictSeverity: MedicalAnalyzerSeverity;
  testStatisticConflictAction: MedicalAnalyzerAction;
  statisticalInformationIncompleteSeverity: MedicalAnalyzerSeverity;
  statisticalInformationIncompleteAction: MedicalAnalyzerAction;
  numericConsistencyEnabled: boolean;
  medicalLogicEnabled: boolean;
  tableTextConsistencyEnabled: boolean;
  diagnosticMetricConsistencyEnabled: boolean;
  regressionConsistencyEnabled: boolean;
  statisticalRecheckEnabled: boolean;
  inferentialStatisticConsistencyEnabled: boolean;
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
  diagnosticMetricAliases: [
    "AUC | AUC, area under the curve",
    "sensitivity | sensitivity, sens",
    "specificity | specificity, spec",
  ].join("\n"),
  diagnosticMetricRanges: [
    "AUC | 0.5 | 1",
    "sensitivity | 0 | 1",
    "specificity | 0 | 1",
  ].join("\n"),
  confusionMatrixAliases: [
    "tp | TP, true positive",
    "fp | FP, false positive",
    "fn | FN, false negative",
    "tn | TN, true negative",
  ].join("\n"),
  diagnosticConfidenceLevels: "95",
  regressionFieldAliases: [
    "beta | beta, β",
    "SE | SE, standard error",
    "p_value | P, P value",
    "confidence_interval | 95% CI, confidence interval",
  ].join("\n"),
  regressionConfidenceLevels: "95",
  unitRangeConflictSeverity: "high",
  unitRangeConflictAction: "manual_review",
  significanceMismatchSeverity: "high",
  significanceMismatchAction: "manual_review",
  tableTextDirectionSeverity: "high",
  tableTextDirectionAction: "manual_review",
  diagnosticMetricOutOfRangeSeverity: "medium",
  diagnosticMetricOutOfRangeAction: "manual_review",
  diagnosticMetricMismatchSeverity: "high",
  diagnosticMetricMismatchAction: "manual_review",
  aucConfidenceIntervalSeverity: "high",
  aucConfidenceIntervalAction: "manual_review",
  regressionCoefficientSeverity: "high",
  regressionCoefficientAction: "manual_review",
  testStatisticConflictSeverity: "high",
  testStatisticConflictAction: "manual_review",
  statisticalInformationIncompleteSeverity: "medium",
  statisticalInformationIncompleteAction: "manual_review",
  numericConsistencyEnabled: true,
  medicalLogicEnabled: true,
  tableTextConsistencyEnabled: true,
  diagnosticMetricConsistencyEnabled: true,
  regressionConsistencyEnabled: true,
  statisticalRecheckEnabled: true,
  inferentialStatisticConsistencyEnabled: true,
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

      <fieldset className="admin-governance-module-selector">
        <legend>Diagnostic Metrics</legend>
        <div className="admin-governance-form-grid">
          <label className="admin-governance-field">
            <span>Diagnostic Metric Aliases</span>
            <textarea
              value={draft.diagnosticMetricAliases}
              onChange={(event) =>
                props.onChange(
                  buildMedicalAnalyzerPackageManifest({
                    ...draft,
                    diagnosticMetricAliases: event.target.value,
                  }),
                )
              }
              rows={4}
              disabled={props.disabled}
            />
          </label>

          <label className="admin-governance-field">
            <span>Diagnostic Metric Ranges</span>
            <textarea
              value={draft.diagnosticMetricRanges}
              onChange={(event) =>
                props.onChange(
                  buildMedicalAnalyzerPackageManifest({
                    ...draft,
                    diagnosticMetricRanges: event.target.value,
                  }),
                )
              }
              rows={4}
              disabled={props.disabled}
            />
          </label>

          <label className="admin-governance-field">
            <span>Confusion Matrix Aliases</span>
            <textarea
              value={draft.confusionMatrixAliases}
              onChange={(event) =>
                props.onChange(
                  buildMedicalAnalyzerPackageManifest({
                    ...draft,
                    confusionMatrixAliases: event.target.value,
                  }),
                )
              }
              rows={4}
              disabled={props.disabled}
            />
          </label>

          <label className="admin-governance-field">
            <span>Diagnostic Confidence Levels</span>
            <input
              type="text"
              value={draft.diagnosticConfidenceLevels}
              onChange={(event) =>
                props.onChange(
                  buildMedicalAnalyzerPackageManifest({
                    ...draft,
                    diagnosticConfidenceLevels: event.target.value,
                  }),
                )
              }
              disabled={props.disabled}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="admin-governance-module-selector">
        <legend>Regression Statistics</legend>
        <div className="admin-governance-form-grid">
          <label className="admin-governance-field">
            <span>Regression Field Aliases</span>
            <textarea
              value={draft.regressionFieldAliases}
              onChange={(event) =>
                props.onChange(
                  buildMedicalAnalyzerPackageManifest({
                    ...draft,
                    regressionFieldAliases: event.target.value,
                  }),
                )
              }
              rows={4}
              disabled={props.disabled}
            />
          </label>

          <label className="admin-governance-field">
            <span>Regression Confidence Levels</span>
            <input
              type="text"
              value={draft.regressionConfidenceLevels}
              onChange={(event) =>
                props.onChange(
                  buildMedicalAnalyzerPackageManifest({
                    ...draft,
                    regressionConfidenceLevels: event.target.value,
                  }),
                )
              }
              disabled={props.disabled}
            />
          </label>
        </div>
      </fieldset>

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
        <MedicalPolicyCard
          label="Diagnostic Metric Out Of Range"
          severity={draft.diagnosticMetricOutOfRangeSeverity}
          action={draft.diagnosticMetricOutOfRangeAction}
          onSeverityChange={(severity) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                diagnosticMetricOutOfRangeSeverity: severity,
              }),
            )
          }
          onActionChange={(action) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                diagnosticMetricOutOfRangeAction: action,
              }),
            )
          }
          disabled={props.disabled}
        />
        <MedicalPolicyCard
          label="Diagnostic Metric Mismatch"
          severity={draft.diagnosticMetricMismatchSeverity}
          action={draft.diagnosticMetricMismatchAction}
          onSeverityChange={(severity) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                diagnosticMetricMismatchSeverity: severity,
              }),
            )
          }
          onActionChange={(action) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                diagnosticMetricMismatchAction: action,
              }),
            )
          }
          disabled={props.disabled}
        />
        <MedicalPolicyCard
          label="AUC Confidence Interval Conflict"
          severity={draft.aucConfidenceIntervalSeverity}
          action={draft.aucConfidenceIntervalAction}
          onSeverityChange={(severity) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                aucConfidenceIntervalSeverity: severity,
              }),
            )
          }
          onActionChange={(action) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                aucConfidenceIntervalAction: action,
              }),
            )
          }
          disabled={props.disabled}
        />
        <MedicalPolicyCard
          label="Regression Coefficient Conflict"
          severity={draft.regressionCoefficientSeverity}
          action={draft.regressionCoefficientAction}
          onSeverityChange={(severity) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                regressionCoefficientSeverity: severity,
              }),
            )
          }
          onActionChange={(action) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                regressionCoefficientAction: action,
              }),
            )
          }
          disabled={props.disabled}
        />
        <MedicalPolicyCard
          label="Test Statistic Conflict"
          severity={draft.testStatisticConflictSeverity}
          action={draft.testStatisticConflictAction}
          onSeverityChange={(severity) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                testStatisticConflictSeverity: severity,
              }),
            )
          }
          onActionChange={(action) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                testStatisticConflictAction: action,
              }),
            )
          }
          disabled={props.disabled}
        />
        <MedicalPolicyCard
          label="Statistical Information Incomplete"
          severity={draft.statisticalInformationIncompleteSeverity}
          action={draft.statisticalInformationIncompleteAction}
          onSeverityChange={(severity) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                statisticalInformationIncompleteSeverity: severity,
              }),
            )
          }
          onActionChange={(action) =>
            props.onChange(
              buildMedicalAnalyzerPackageManifest({
                ...draft,
                statisticalInformationIncompleteAction: action,
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
          <ToggleCheckbox
            label="Diagnostic Metric Consistency"
            checked={draft.diagnosticMetricConsistencyEnabled}
            onChange={(checked) =>
              props.onChange(
                buildMedicalAnalyzerPackageManifest({
                  ...draft,
                  diagnosticMetricConsistencyEnabled: checked,
                }),
              )
            }
            disabled={props.disabled}
          />
          <ToggleCheckbox
            label="Regression Consistency"
            checked={draft.regressionConsistencyEnabled}
            onChange={(checked) =>
              props.onChange(
                buildMedicalAnalyzerPackageManifest({
                  ...draft,
                  regressionConsistencyEnabled: checked,
                }),
              )
            }
            disabled={props.disabled}
          />
          <ToggleCheckbox
            label="Statistical Recheck"
            checked={draft.statisticalRecheckEnabled}
            onChange={(checked) =>
              props.onChange(
                buildMedicalAnalyzerPackageManifest({
                  ...draft,
                  statisticalRecheckEnabled: checked,
                }),
              )
            }
            disabled={props.disabled}
          />
          <ToggleCheckbox
            label="Inferential Statistic Consistency"
            checked={draft.inferentialStatisticConsistencyEnabled}
            onChange={(checked) =>
              props.onChange(
                buildMedicalAnalyzerPackageManifest({
                  ...draft,
                  inferentialStatisticConsistencyEnabled: checked,
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
    diagnostic_metrics: {
      metric_aliases: parseAliasDictionary(draft.diagnosticMetricAliases),
      metric_ranges: parseMetricRanges(draft.diagnosticMetricRanges),
      confusion_matrix_aliases: parseAliasDictionary(draft.confusionMatrixAliases),
      ci_confidence_levels: parseNumberList(
        draft.diagnosticConfidenceLevels || defaultDraft.diagnosticConfidenceLevels,
      ),
    },
    regression_metrics: {
      field_aliases: parseAliasDictionary(draft.regressionFieldAliases),
      ci_confidence_levels: parseNumberList(
        draft.regressionConfidenceLevels || defaultDraft.regressionConfidenceLevels,
      ),
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
      diagnostic_metric_out_of_range: {
        severity: draft.diagnosticMetricOutOfRangeSeverity,
        action: draft.diagnosticMetricOutOfRangeAction,
      },
      diagnostic_metric_mismatch: {
        severity: draft.diagnosticMetricMismatchSeverity,
        action: draft.diagnosticMetricMismatchAction,
      },
      auc_confidence_interval_conflict: {
        severity: draft.aucConfidenceIntervalSeverity,
        action: draft.aucConfidenceIntervalAction,
      },
      regression_coefficient_conflict: {
        severity: draft.regressionCoefficientSeverity,
        action: draft.regressionCoefficientAction,
      },
      test_statistic_conflict: {
        severity: draft.testStatisticConflictSeverity,
        action: draft.testStatisticConflictAction,
      },
      statistical_information_incomplete: {
        severity: draft.statisticalInformationIncompleteSeverity,
        action: draft.statisticalInformationIncompleteAction,
      },
    },
    analyzer_toggles: {
      numeric_consistency: draft.numericConsistencyEnabled,
      medical_logic: draft.medicalLogicEnabled,
      table_text_consistency: draft.tableTextConsistencyEnabled,
      diagnostic_metric_consistency: draft.diagnosticMetricConsistencyEnabled,
      regression_consistency: draft.regressionConsistencyEnabled,
      statistical_recheck: draft.statisticalRecheckEnabled,
      inferential_statistic_consistency:
        draft.inferentialStatisticConsistencyEnabled,
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
  const diagnosticMetrics = asRecord(manifest.diagnostic_metrics);
  const regressionMetrics = asRecord(manifest.regression_metrics);
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
    diagnosticMetricAliases: serializeAliasDictionary(
      asRecord(diagnosticMetrics?.metric_aliases),
      defaultDraft.diagnosticMetricAliases,
    ),
    diagnosticMetricRanges: serializeMetricRanges(
      asRecord(diagnosticMetrics?.metric_ranges),
      defaultDraft.diagnosticMetricRanges,
    ),
    confusionMatrixAliases: serializeAliasDictionary(
      asRecord(diagnosticMetrics?.confusion_matrix_aliases),
      defaultDraft.confusionMatrixAliases,
    ),
    diagnosticConfidenceLevels: joinCommaSeparatedNumbers(
      readNumberArray(
        diagnosticMetrics?.ci_confidence_levels,
        parseNumberList(defaultDraft.diagnosticConfidenceLevels),
      ),
    ),
    regressionFieldAliases: serializeAliasDictionary(
      asRecord(regressionMetrics?.field_aliases),
      defaultDraft.regressionFieldAliases,
    ),
    regressionConfidenceLevels: joinCommaSeparatedNumbers(
      readNumberArray(
        regressionMetrics?.ci_confidence_levels,
        parseNumberList(defaultDraft.regressionConfidenceLevels),
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
    diagnosticMetricOutOfRangeSeverity: readPolicySeverity(
      issuePolicy?.diagnostic_metric_out_of_range,
      defaultDraft.diagnosticMetricOutOfRangeSeverity,
    ),
    diagnosticMetricOutOfRangeAction: readPolicyAction(
      issuePolicy?.diagnostic_metric_out_of_range,
      defaultDraft.diagnosticMetricOutOfRangeAction,
    ),
    diagnosticMetricMismatchSeverity: readPolicySeverity(
      issuePolicy?.diagnostic_metric_mismatch,
      defaultDraft.diagnosticMetricMismatchSeverity,
    ),
    diagnosticMetricMismatchAction: readPolicyAction(
      issuePolicy?.diagnostic_metric_mismatch,
      defaultDraft.diagnosticMetricMismatchAction,
    ),
    aucConfidenceIntervalSeverity: readPolicySeverity(
      issuePolicy?.auc_confidence_interval_conflict,
      defaultDraft.aucConfidenceIntervalSeverity,
    ),
    aucConfidenceIntervalAction: readPolicyAction(
      issuePolicy?.auc_confidence_interval_conflict,
      defaultDraft.aucConfidenceIntervalAction,
    ),
    regressionCoefficientSeverity: readPolicySeverity(
      issuePolicy?.regression_coefficient_conflict,
      defaultDraft.regressionCoefficientSeverity,
    ),
    regressionCoefficientAction: readPolicyAction(
      issuePolicy?.regression_coefficient_conflict,
      defaultDraft.regressionCoefficientAction,
    ),
    testStatisticConflictSeverity: readPolicySeverity(
      issuePolicy?.test_statistic_conflict,
      defaultDraft.testStatisticConflictSeverity,
    ),
    testStatisticConflictAction: readPolicyAction(
      issuePolicy?.test_statistic_conflict,
      defaultDraft.testStatisticConflictAction,
    ),
    statisticalInformationIncompleteSeverity: readPolicySeverity(
      issuePolicy?.statistical_information_incomplete,
      defaultDraft.statisticalInformationIncompleteSeverity,
    ),
    statisticalInformationIncompleteAction: readPolicyAction(
      issuePolicy?.statistical_information_incomplete,
      defaultDraft.statisticalInformationIncompleteAction,
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
    diagnosticMetricConsistencyEnabled: readBoolean(
      analyzerToggles?.diagnostic_metric_consistency,
      defaultDraft.diagnosticMetricConsistencyEnabled,
    ),
    regressionConsistencyEnabled: readBoolean(
      analyzerToggles?.regression_consistency,
      defaultDraft.regressionConsistencyEnabled,
    ),
    statisticalRecheckEnabled: readBoolean(
      analyzerToggles?.statistical_recheck,
      defaultDraft.statisticalRecheckEnabled,
    ),
    inferentialStatisticConsistencyEnabled: readBoolean(
      analyzerToggles?.inferential_statistic_consistency,
      defaultDraft.inferentialStatisticConsistencyEnabled,
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

function parseAliasDictionary(text: string): Record<string, string[]> {
  const dictionary: Record<string, string[]> = {};

  for (const line of splitLines(text)) {
    const [metric, aliasesText] = line.split("|").map((part) => part.trim());
    if (!metric) {
      continue;
    }

    dictionary[metric] = splitCommaSeparated(aliasesText);
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

function parseMetricRanges(text: string): Record<string, unknown> {
  const ranges: Record<string, Record<string, number>> = {};

  for (const line of splitLines(text)) {
    const [metric, minText, maxText] = line.split("|").map((part) => part.trim());
    if (!metric) {
      continue;
    }

    const entry: Record<string, number> = {};
    const minValue = parseOptionalNumber(minText);
    const maxValue = parseOptionalNumber(maxText);
    if (minValue !== undefined) {
      entry.min = minValue;
    }
    if (maxValue !== undefined) {
      entry.max = maxValue;
    }

    ranges[metric] = entry;
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

function serializeAliasDictionary(
  dictionary: Record<string, unknown> | null,
  fallback: string,
): string {
  if (!dictionary) {
    return fallback;
  }

  const lines = Object.entries(dictionary)
    .map(([metric, rawAliases]) => {
      if (!Array.isArray(rawAliases)) {
        return null;
      }
      const aliases = rawAliases.filter((entry): entry is string => typeof entry === "string");
      return [metric, joinCommaSeparated(aliases)].join(" | ").trim();
    })
    .filter((line): line is string => line !== null && line.length > 0);

  return lines.length > 0 ? lines.join("\n") : fallback;
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

function serializeMetricRanges(
  ranges: Record<string, unknown> | null,
  fallback: string,
): string {
  if (!ranges) {
    return fallback;
  }

  const lines = Object.entries(ranges)
    .map(([metric, rawRange]) => {
      const range = asRecord(rawRange);
      if (!range) {
        return null;
      }

      return [
        metric,
        formatOptionalNumber(range.min),
        formatOptionalNumber(range.max),
      ].join(" | ");
    })
    .filter((line): line is string => line !== null && line.length > 0);

  return lines.length > 0 ? lines.join("\n") : fallback;
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

function joinCommaSeparatedNumbers(values: readonly number[]): string {
  return values.map((value) => String(value)).join(", ");
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

function parseNumberList(value: string): number[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number.parseFloat(part))
    .filter((part) => Number.isFinite(part));
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

function readNumberArray(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const next = value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));
  return next.length > 0 ? next : fallback;
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
