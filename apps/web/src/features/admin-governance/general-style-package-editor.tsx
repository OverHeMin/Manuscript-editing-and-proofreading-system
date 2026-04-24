type GeneralStyleSeverity = "low" | "medium" | "high" | "critical";
type GeneralStyleAction =
  | "auto_fix"
  | "suggest_fix"
  | "manual_review"
  | "block";

export interface GeneralStylePackageDraft {
  abstractRequiredLabels: string;
  strongClaims: string;
  cautiousClaims: string;
  abstractPosture: string;
  resultsPosture: string;
  conclusionPosture: string;
  genreWordingSuspicions: string;
  sectionExpectationMissingSeverity: GeneralStyleSeverity;
  sectionExpectationMissingAction: GeneralStyleAction;
  resultConclusionJumpSeverity: GeneralStyleSeverity;
  resultConclusionJumpAction: GeneralStyleAction;
  toneOverclaimSeverity: GeneralStyleSeverity;
  toneOverclaimAction: GeneralStyleAction;
  genreWordingSuspicionSeverity: GeneralStyleSeverity;
  genreWordingSuspicionAction: GeneralStyleAction;
}

export interface GeneralStylePackageEditorProps {
  manifest: Record<string, unknown>;
  onChange: (nextManifest: Record<string, unknown>) => void;
  disabled?: boolean;
  surface?: "default" | "harness";
}

const defaultDraft: GeneralStylePackageDraft = {
  abstractRequiredLabels: "objective, methods, results, conclusion",
  strongClaims: "prove, guarantee, definitive, cure",
  cautiousClaims: "suggest, may, appears, is associated with",
  abstractPosture: "objective, methods, results, conclusion",
  resultsPosture: "measured, observed, compared, improved",
  conclusionPosture: "suggest, may, support, indicate",
  genreWordingSuspicions: "news report, experience sharing",
  sectionExpectationMissingSeverity: "medium",
  sectionExpectationMissingAction: "suggest_fix",
  resultConclusionJumpSeverity: "high",
  resultConclusionJumpAction: "manual_review",
  toneOverclaimSeverity: "medium",
  toneOverclaimAction: "suggest_fix",
  genreWordingSuspicionSeverity: "medium",
  genreWordingSuspicionAction: "suggest_fix",
};

const severityOptions: GeneralStyleSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];
const actionOptions: GeneralStyleAction[] = [
  "auto_fix",
  "suggest_fix",
  "manual_review",
  "block",
];

export function GeneralStylePackageEditor(
  props: GeneralStylePackageEditorProps,
) {
  const isHarnessSurface = props.surface === "harness";
  const draft = parseGeneralStylePackageManifestDraft(props.manifest);

  return (
    <div className="admin-governance-panel admin-governance-panel-nested">
      <h4>{isHarnessSurface ? "结构化风格规则" : "Structured Style Rules"}</h4>
      <p className="admin-governance-empty">
        {isHarnessSurface
          ? "在这里维护文章体例约束，结构化编辑器会同步生成面向执行侧的质量包清单。"
          : "Maintain the article-style expectations here. The editor keeps the generated manifest in sync with the worker-facing package schema."}
      </p>

      <div className="admin-governance-form-grid">
        <label className="admin-governance-field">
          <span>{isHarnessSurface ? "摘要必备标签" : "Abstract Required Labels"}</span>
          <input
            type="text"
            value={draft.abstractRequiredLabels}
            onChange={(event) =>
              props.onChange(
                buildGeneralStylePackageManifest({
                  ...draft,
                  abstractRequiredLabels: event.target.value,
                }),
              )
            }
            disabled={props.disabled}
          />
        </label>

        <label className="admin-governance-field">
          <span>{isHarnessSurface ? "可疑文风词" : "Genre Wording Suspicions"}</span>
          <input
            type="text"
            value={draft.genreWordingSuspicions}
            onChange={(event) =>
              props.onChange(
                buildGeneralStylePackageManifest({
                  ...draft,
                  genreWordingSuspicions: event.target.value,
                }),
              )
            }
            disabled={props.disabled}
          />
        </label>
      </div>

      <div className="admin-governance-form-grid">
        <label className="admin-governance-field">
          <span>{isHarnessSurface ? "强断言词" : "Strong Claims"}</span>
          <textarea
            value={draft.strongClaims}
            onChange={(event) =>
              props.onChange(
                buildGeneralStylePackageManifest({
                  ...draft,
                  strongClaims: event.target.value,
                }),
              )
            }
            rows={3}
            disabled={props.disabled}
          />
        </label>

        <label className="admin-governance-field">
          <span>{isHarnessSurface ? "谨慎表达词" : "Cautious Claims"}</span>
          <textarea
            value={draft.cautiousClaims}
            onChange={(event) =>
              props.onChange(
                buildGeneralStylePackageManifest({
                  ...draft,
                  cautiousClaims: event.target.value,
                }),
              )
            }
            rows={3}
            disabled={props.disabled}
          />
        </label>
      </div>

      <div className="admin-governance-form-grid">
        <label className="admin-governance-field">
          <span>{isHarnessSurface ? "摘要语气检查" : "Abstract Posture Checks"}</span>
          <textarea
            value={draft.abstractPosture}
            onChange={(event) =>
              props.onChange(
                buildGeneralStylePackageManifest({
                  ...draft,
                  abstractPosture: event.target.value,
                }),
              )
            }
            rows={3}
            disabled={props.disabled}
          />
        </label>

        <label className="admin-governance-field">
          <span>{isHarnessSurface ? "结果段语气检查" : "Results Posture Checks"}</span>
          <textarea
            value={draft.resultsPosture}
            onChange={(event) =>
              props.onChange(
                buildGeneralStylePackageManifest({
                  ...draft,
                  resultsPosture: event.target.value,
                }),
              )
            }
            rows={3}
            disabled={props.disabled}
          />
        </label>

        <label className="admin-governance-field">
          <span>{isHarnessSurface ? "结论段语气检查" : "Conclusion Posture Checks"}</span>
          <textarea
            value={draft.conclusionPosture}
            onChange={(event) =>
              props.onChange(
                buildGeneralStylePackageManifest({
                  ...draft,
                  conclusionPosture: event.target.value,
                }),
              )
            }
            rows={3}
            disabled={props.disabled}
          />
        </label>
      </div>

      <div className="admin-governance-policy-grid">
        <PolicyCard
          label={isHarnessSurface ? "章节要求缺失" : "Section Expectation Missing"}
          severity={draft.sectionExpectationMissingSeverity}
          action={draft.sectionExpectationMissingAction}
          onSeverityChange={(severity) =>
            props.onChange(
              buildGeneralStylePackageManifest({
                ...draft,
                sectionExpectationMissingSeverity: severity,
              }),
            )
          }
          onActionChange={(action) =>
            props.onChange(
              buildGeneralStylePackageManifest({
                ...draft,
                sectionExpectationMissingAction: action,
              }),
            )
          }
          disabled={props.disabled}
          surface={props.surface}
        />
        <PolicyCard
          label={isHarnessSurface ? "结果/结论跳跃" : "Result / Conclusion Jump"}
          severity={draft.resultConclusionJumpSeverity}
          action={draft.resultConclusionJumpAction}
          onSeverityChange={(severity) =>
            props.onChange(
              buildGeneralStylePackageManifest({
                ...draft,
                resultConclusionJumpSeverity: severity,
              }),
            )
          }
          onActionChange={(action) =>
            props.onChange(
              buildGeneralStylePackageManifest({
                ...draft,
                resultConclusionJumpAction: action,
              }),
            )
          }
          disabled={props.disabled}
          surface={props.surface}
        />
        <PolicyCard
          label={isHarnessSurface ? "措辞过强" : "Tone Overclaim"}
          severity={draft.toneOverclaimSeverity}
          action={draft.toneOverclaimAction}
          onSeverityChange={(severity) =>
            props.onChange(
              buildGeneralStylePackageManifest({
                ...draft,
                toneOverclaimSeverity: severity,
              }),
            )
          }
          onActionChange={(action) =>
            props.onChange(
              buildGeneralStylePackageManifest({
                ...draft,
                toneOverclaimAction: action,
              }),
            )
          }
          disabled={props.disabled}
          surface={props.surface}
        />
        <PolicyCard
          label={isHarnessSurface ? "文风可疑" : "Genre Wording Suspicion"}
          severity={draft.genreWordingSuspicionSeverity}
          action={draft.genreWordingSuspicionAction}
          onSeverityChange={(severity) =>
            props.onChange(
              buildGeneralStylePackageManifest({
                ...draft,
                genreWordingSuspicionSeverity: severity,
              }),
            )
          }
          onActionChange={(action) =>
            props.onChange(
              buildGeneralStylePackageManifest({
                ...draft,
                genreWordingSuspicionAction: action,
              }),
            )
          }
          disabled={props.disabled}
          surface={props.surface}
        />
      </div>
    </div>
  );
}

interface PolicyCardProps {
  label: string;
  severity: GeneralStyleSeverity;
  action: GeneralStyleAction;
  onSeverityChange: (severity: GeneralStyleSeverity) => void;
  onActionChange: (action: GeneralStyleAction) => void;
  disabled?: boolean;
  surface?: "default" | "harness";
}

function PolicyCard(props: PolicyCardProps) {
  const isHarnessSurface = props.surface === "harness";

  return (
    <article className="admin-governance-asset-row">
      <span>{props.label}</span>
      <div className="admin-governance-form-grid">
        <label className="admin-governance-field">
          <span>{isHarnessSurface ? "严重级别" : "Severity"}</span>
          <select
            value={props.severity}
            onChange={(event) =>
              props.onSeverityChange(event.target.value as GeneralStyleSeverity)
            }
            disabled={props.disabled}
          >
            {severityOptions.map((severity) => (
              <option key={severity} value={severity}>
                {isHarnessSurface ? formatGeneralStyleSeverityLabel(severity) : severity}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-governance-field">
          <span>{isHarnessSurface ? "处理动作" : "Action"}</span>
          <select
            value={props.action}
            onChange={(event) =>
              props.onActionChange(event.target.value as GeneralStyleAction)
            }
            disabled={props.disabled}
          >
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {isHarnessSurface ? formatGeneralStyleActionLabel(action) : action}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}

export function createDefaultGeneralStylePackageManifest(): Record<string, unknown> {
  return buildGeneralStylePackageManifest(defaultDraft);
}

export function parseGeneralStylePackageManifestDraft(
  manifest: Record<string, unknown>,
): GeneralStylePackageDraft {
  const sectionExpectations = asRecord(manifest.section_expectations);
  const abstractExpectation = asRecord(sectionExpectations?.abstract);
  const toneMarkers = asRecord(manifest.tone_markers);
  const postureChecks = asRecord(manifest.posture_checks);
  const issuePolicy = asRecord(manifest.issue_policy);

  return {
    abstractRequiredLabels: joinCommaSeparated(
      readStringArray(
        abstractExpectation?.required_labels,
        splitCommaSeparated(defaultDraft.abstractRequiredLabels),
      ),
    ),
    strongClaims: joinCommaSeparated(
      readStringArray(
        toneMarkers?.strong_claims,
        splitCommaSeparated(defaultDraft.strongClaims),
      ),
    ),
    cautiousClaims: joinCommaSeparated(
      readStringArray(
        toneMarkers?.cautious_claims,
        splitCommaSeparated(defaultDraft.cautiousClaims),
      ),
    ),
    abstractPosture: joinCommaSeparated(
      readStringArray(
        postureChecks?.abstract,
        splitCommaSeparated(defaultDraft.abstractPosture),
      ),
    ),
    resultsPosture: joinCommaSeparated(
      readStringArray(
        postureChecks?.results,
        splitCommaSeparated(defaultDraft.resultsPosture),
      ),
    ),
    conclusionPosture: joinCommaSeparated(
      readStringArray(
        postureChecks?.conclusion,
        splitCommaSeparated(defaultDraft.conclusionPosture),
      ),
    ),
    genreWordingSuspicions: joinCommaSeparated(
      readStringArray(
        manifest.genre_wording_suspicions,
        splitCommaSeparated(defaultDraft.genreWordingSuspicions),
      ),
    ),
    sectionExpectationMissingSeverity: readPolicySeverity(
      issuePolicy?.section_expectation_missing,
      defaultDraft.sectionExpectationMissingSeverity,
    ),
    sectionExpectationMissingAction: readPolicyAction(
      issuePolicy?.section_expectation_missing,
      defaultDraft.sectionExpectationMissingAction,
    ),
    resultConclusionJumpSeverity: readPolicySeverity(
      issuePolicy?.result_conclusion_jump,
      defaultDraft.resultConclusionJumpSeverity,
    ),
    resultConclusionJumpAction: readPolicyAction(
      issuePolicy?.result_conclusion_jump,
      defaultDraft.resultConclusionJumpAction,
    ),
    toneOverclaimSeverity: readPolicySeverity(
      issuePolicy?.tone_overclaim,
      defaultDraft.toneOverclaimSeverity,
    ),
    toneOverclaimAction: readPolicyAction(
      issuePolicy?.tone_overclaim,
      defaultDraft.toneOverclaimAction,
    ),
    genreWordingSuspicionSeverity: readPolicySeverity(
      issuePolicy?.genre_wording_suspicion,
      defaultDraft.genreWordingSuspicionSeverity,
    ),
    genreWordingSuspicionAction: readPolicyAction(
      issuePolicy?.genre_wording_suspicion,
      defaultDraft.genreWordingSuspicionAction,
    ),
  };
}

export function buildGeneralStylePackageManifest(
  draft: GeneralStylePackageDraft,
): Record<string, unknown> {
  return {
    section_expectations: {
      abstract: {
        required_labels: splitCommaSeparated(draft.abstractRequiredLabels),
      },
    },
    tone_markers: {
      strong_claims: splitCommaSeparated(draft.strongClaims),
      cautious_claims: splitCommaSeparated(draft.cautiousClaims),
    },
    posture_checks: {
      abstract: splitCommaSeparated(draft.abstractPosture),
      results: splitCommaSeparated(draft.resultsPosture),
      conclusion: splitCommaSeparated(draft.conclusionPosture),
    },
    genre_wording_suspicions: splitCommaSeparated(draft.genreWordingSuspicions),
    issue_policy: {
      section_expectation_missing: {
        severity: draft.sectionExpectationMissingSeverity,
        action: draft.sectionExpectationMissingAction,
      },
      result_conclusion_jump: {
        severity: draft.resultConclusionJumpSeverity,
        action: draft.resultConclusionJumpAction,
      },
      tone_overclaim: {
        severity: draft.toneOverclaimSeverity,
        action: draft.toneOverclaimAction,
      },
      genre_wording_suspicion: {
        severity: draft.genreWordingSuspicionSeverity,
        action: draft.genreWordingSuspicionAction,
      },
    },
  };
}

function splitCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function joinCommaSeparated(values: readonly string[]): string {
  return values.join(", ");
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

  const filtered = value.filter((entry): entry is string => typeof entry === "string");
  return filtered.length > 0 ? filtered : fallback;
}

function readPolicySeverity(
  value: unknown,
  fallback: GeneralStyleSeverity,
): GeneralStyleSeverity {
  const record = asRecord(value);
  const severity = record?.severity;
  return severityOptions.includes(severity as GeneralStyleSeverity)
    ? (severity as GeneralStyleSeverity)
    : fallback;
}

function readPolicyAction(
  value: unknown,
  fallback: GeneralStyleAction,
): GeneralStyleAction {
  const record = asRecord(value);
  const action = record?.action;
  return actionOptions.includes(action as GeneralStyleAction)
    ? (action as GeneralStyleAction)
    : fallback;
}

function formatGeneralStyleSeverityLabel(severity: GeneralStyleSeverity): string {
  switch (severity) {
    case "low":
      return "低";
    case "medium":
      return "中";
    case "high":
      return "高";
    case "critical":
      return "阻断";
  }
}

function formatGeneralStyleActionLabel(action: GeneralStyleAction): string {
  switch (action) {
    case "auto_fix":
      return "自动修复";
    case "suggest_fix":
      return "建议修复";
    case "manual_review":
      return "人工复核";
    case "block":
      return "阻断";
  }
}
