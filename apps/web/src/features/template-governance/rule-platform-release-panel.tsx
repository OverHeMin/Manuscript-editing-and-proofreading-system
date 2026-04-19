import { useEffect, useState } from "react";
import type { ManuscriptType } from "../manuscripts/types.ts";
import type {
  EditorialRuleSetReleaseScope,
  EditorialRuleSetViewModel,
  EditorialRuleViewModel,
  TransitionEditorialRuleSetInput,
} from "../editorial-rules/index.ts";

interface RulePlatformReleasePanelProps {
  selectedRuleSet: EditorialRuleSetViewModel;
  manuscriptType?: ManuscriptType | null;
  rules: readonly EditorialRuleViewModel[];
  isBusy: boolean;
  onTransitionRuleSet: (
    input: Omit<TransitionEditorialRuleSetInput, "actorRole">,
  ) => Promise<void> | void;
}

interface ReleaseScopeFormState {
  manuscriptTypes: string;
  sections: string;
  objectGranularity: string;
}

export function RulePlatformReleasePanel({
  selectedRuleSet,
  manuscriptType,
  rules,
  isBusy,
  onTransitionRuleSet,
}: RulePlatformReleasePanelProps) {
  const [releaseScope, setReleaseScope] = useState<ReleaseScopeFormState>(() =>
    createReleaseScopeFormState(selectedRuleSet.release_scope, manuscriptType, rules),
  );
  const [candidateValidationRunId, setCandidateValidationRunId] = useState(
    selectedRuleSet.candidate_validation_run_id ?? "",
  );
  const [candidateValidationEvidencePackId, setCandidateValidationEvidencePackId] =
    useState(selectedRuleSet.candidate_validation_evidence_pack_id ?? "");
  const [onlineRegressionRunId, setOnlineRegressionRunId] = useState(
    selectedRuleSet.online_regression_run_id ?? "",
  );
  const [onlineRegressionEvidencePackId, setOnlineRegressionEvidencePackId] =
    useState(selectedRuleSet.online_regression_evidence_pack_id ?? "");

  useEffect(() => {
    setReleaseScope(
      createReleaseScopeFormState(
        selectedRuleSet.release_scope,
        manuscriptType,
        rules,
      ),
    );
    setCandidateValidationRunId(selectedRuleSet.candidate_validation_run_id ?? "");
    setCandidateValidationEvidencePackId(
      selectedRuleSet.candidate_validation_evidence_pack_id ?? "",
    );
    setOnlineRegressionRunId(selectedRuleSet.online_regression_run_id ?? "");
    setOnlineRegressionEvidencePackId(
      selectedRuleSet.online_regression_evidence_pack_id ?? "",
    );
  }, [manuscriptType, rules, selectedRuleSet]);

  const blockedReason = resolveBlockedReason(selectedRuleSet);
  const releaseComparison = selectedRuleSet.release_comparison;
  const rollbackRecommended =
    selectedRuleSet.status === "active" &&
    releaseComparison?.recommendation === "rollback_recommended";

  async function handleCandidateTransition(): Promise<void> {
    await onTransitionRuleSet({
      targetStatus: "candidate",
      releaseScope: toReleaseScopeInput(releaseScope),
    });
  }

  async function handleCanaryTransition(): Promise<void> {
    await onTransitionRuleSet({
      targetStatus: "canary",
      candidateValidationRunId: optionalTrimmed(candidateValidationRunId),
      candidateValidationEvidencePackId: optionalTrimmed(
        candidateValidationEvidencePackId,
      ),
    });
  }

  async function handleActiveTransition(): Promise<void> {
    await onTransitionRuleSet({
      targetStatus: "active",
      onlineRegressionRunId: optionalTrimmed(onlineRegressionRunId),
      onlineRegressionEvidencePackId: optionalTrimmed(
        onlineRegressionEvidencePackId,
      ),
    });
  }

  async function handleRollback(): Promise<void> {
    await onTransitionRuleSet({
      targetStatus: "rolled_back",
    });
  }

  return (
    <article
      className="template-governance-card"
      data-rule-release-panel="field"
      data-release-blocked={String(blockedReason != null)}
      data-release-comparison-status={releaseComparison?.status ?? "unavailable"}
      data-release-comparison-recommendation={
        releaseComparison?.recommendation ?? "hold"
      }
      data-release-rollback-recommended={String(rollbackRecommended)}
    >
      <strong>规则发布轨道</strong>
      <small>
        当前状态：{formatRuleSetReleaseStatus(selectedRuleSet.status)}
      </small>
      <div className="template-governance-detail-grid">
        <div>
          <span>发布阶段</span>
          <p>草稿 {"->"} 候选发布 {"->"} Canary {"->"} 正式生效</p>
        </div>
        <div>
          <span>当前发布范围</span>
          <p>{formatReleaseScopeSummary(selectedRuleSet.release_scope)}</p>
        </div>
      </div>
      {blockedReason ? (
        <p className="template-governance-selected-note">{blockedReason}</p>
      ) : null}
      {releaseComparison ? (
        <div className="template-governance-detail-grid">
          <div>
            <span>Release Comparison</span>
            <p>
              {releaseComparison.status} / {releaseComparison.recommendation}
            </p>
          </div>
          <div>
            <span>Comparison Reasons</span>
            <p>{releaseComparison.reasons.join(" ")}</p>
          </div>
        </div>
      ) : null}
      {rollbackRecommended ? (
        <p className="template-governance-selected-note">
          {releaseComparison?.reasons.join(" ")}
        </p>
      ) : null}

      {selectedRuleSet.status === "draft" ? (
        <div className="template-governance-form-grid">
          <label className="template-governance-field">
            <span>稿件类型范围</span>
            <input
              value={releaseScope.manuscriptTypes}
              onChange={(event) =>
                setReleaseScope((current) => ({
                  ...current,
                  manuscriptTypes: event.target.value,
                }))
              }
              placeholder="clinical_study"
            />
          </label>
          <label className="template-governance-field">
            <span>章节范围</span>
            <input
              value={releaseScope.sections}
              onChange={(event) =>
                setReleaseScope((current) => ({
                  ...current,
                  sections: event.target.value,
                }))
              }
              placeholder="abstract, results"
            />
          </label>
          <label className="template-governance-field">
            <span>对象粒度</span>
            <input
              value={releaseScope.objectGranularity}
              onChange={(event) =>
                setReleaseScope((current) => ({
                  ...current,
                  objectGranularity: event.target.value,
                }))
              }
              placeholder="heading, table"
            />
          </label>
          <div className="template-governance-actions template-governance-actions-full">
            <button type="button" disabled={isBusy} onClick={() => void handleCandidateTransition()}>
              候选发布
            </button>
          </div>
        </div>
      ) : null}

      {selectedRuleSet.status === "candidate" ? (
        <div className="template-governance-form-grid">
          <label className="template-governance-field">
            <span>候选验证 Run ID</span>
            <input
              value={candidateValidationRunId}
              onChange={(event) => setCandidateValidationRunId(event.target.value)}
              placeholder="candidate-validation-run-1"
            />
          </label>
          <label className="template-governance-field">
            <span>候选验证 Evidence Pack ID</span>
            <input
              value={candidateValidationEvidencePackId}
              onChange={(event) =>
                setCandidateValidationEvidencePackId(event.target.value)
              }
              placeholder="candidate-validation-pack-1"
            />
          </label>
          <div className="template-governance-actions template-governance-actions-full">
            <button type="button" disabled={isBusy} onClick={() => void handleCanaryTransition()}>
              进入 Canary
            </button>
          </div>
        </div>
      ) : null}

      {selectedRuleSet.status === "canary" ? (
        <div className="template-governance-form-grid">
          <label className="template-governance-field">
            <span>线上回归 Run ID</span>
            <input
              value={onlineRegressionRunId}
              onChange={(event) => setOnlineRegressionRunId(event.target.value)}
              placeholder="online-regression-run-1"
            />
          </label>
          <label className="template-governance-field">
            <span>线上回归 Evidence Pack ID</span>
            <input
              value={onlineRegressionEvidencePackId}
              onChange={(event) =>
                setOnlineRegressionEvidencePackId(event.target.value)
              }
              placeholder="online-regression-pack-1"
            />
          </label>
          <div className="template-governance-actions template-governance-actions-full">
            <button type="button" disabled={isBusy} onClick={() => void handleActiveTransition()}>
              正式生效
            </button>
          </div>
        </div>
      ) : null}

      {selectedRuleSet.status === "active" ? (
        <div className="template-governance-actions">
          <button type="button" disabled={isBusy} onClick={() => void handleRollback()}>
            回滚到上一版
          </button>
        </div>
      ) : null}
    </article>
  );
}

function createReleaseScopeFormState(
  releaseScope: EditorialRuleSetReleaseScope | undefined,
  manuscriptType: ManuscriptType | null | undefined,
  rules: readonly EditorialRuleViewModel[],
): ReleaseScopeFormState {
  const sections =
    releaseScope?.sections ??
    collectUniqueStrings(
      rules.flatMap((rule) =>
        Array.isArray(rule.scope.sections)
          ? rule.scope.sections.filter(
              (section): section is string => typeof section === "string",
            )
          : [],
      ),
    );
  const objectGranularity =
    releaseScope?.object_granularity ??
    collectUniqueStrings(
      rules.flatMap((rule) => {
        const values: string[] = [];
        if (typeof rule.scope.block_kind === "string") {
          values.push(rule.scope.block_kind);
        }
        if (rule.rule_object && rule.rule_object !== "generic") {
          values.push(rule.rule_object);
        }
        return values;
      }),
    );

  return {
    manuscriptTypes: (releaseScope?.manuscript_types ?? (manuscriptType ? [manuscriptType] : []))
      .join(", "),
    sections: sections.join(", "),
    objectGranularity: objectGranularity.join(", "),
  };
}

function resolveBlockedReason(
  selectedRuleSet: EditorialRuleSetViewModel,
): string | null {
  if (
    selectedRuleSet.status === "candidate" &&
    (!selectedRuleSet.candidate_validation_run_id ||
      !selectedRuleSet.candidate_validation_evidence_pack_id)
  ) {
    return "缺少候选验证证据";
  }

  if (
    selectedRuleSet.status === "canary" &&
    (!selectedRuleSet.online_regression_run_id ||
      !selectedRuleSet.online_regression_evidence_pack_id)
  ) {
    return "缺少线上执行回归证据";
  }

  if (
    selectedRuleSet.status === "canary" &&
    selectedRuleSet.release_comparison?.status === "degraded"
  ) {
    return selectedRuleSet.release_comparison.reasons.join(" ");
  }

  return null;
}

function formatReleaseScopeSummary(
  releaseScope: EditorialRuleSetReleaseScope | undefined,
): string {
  if (!releaseScope) {
    return "未限定，沿用规则集当前范围。";
  }

  const segments: string[] = [];
  if (releaseScope.manuscript_types?.length) {
    segments.push(`稿件类型：${releaseScope.manuscript_types.join("、")}`);
  }
  if (releaseScope.sections?.length) {
    segments.push(`章节：${releaseScope.sections.join("、")}`);
  }
  if (releaseScope.object_granularity?.length) {
    segments.push(`对象粒度：${releaseScope.object_granularity.join("、")}`);
  }

  return segments.length > 0 ? segments.join("；") : "未限定，沿用规则集当前范围。";
}

function toReleaseScopeInput(
  form: ReleaseScopeFormState,
): EditorialRuleSetReleaseScope | undefined {
  const manuscriptTypes = splitCommaSeparated(form.manuscriptTypes);
  const sections = splitCommaSeparated(form.sections);
  const objectGranularity = splitCommaSeparated(form.objectGranularity);

  if (
    manuscriptTypes.length === 0 &&
    sections.length === 0 &&
    objectGranularity.length === 0
  ) {
    return undefined;
  }

  return {
    ...(manuscriptTypes.length > 0 ? { manuscript_types: manuscriptTypes } : {}),
    ...(sections.length > 0 ? { sections } : {}),
    ...(objectGranularity.length > 0
      ? { object_granularity: objectGranularity }
      : {}),
  };
}

function splitCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function collectUniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function formatRuleSetReleaseStatus(status: EditorialRuleSetViewModel["status"]): string {
  switch (status) {
    case "draft":
      return "草稿";
    case "candidate":
      return "候选发布";
    case "canary":
      return "Canary";
    case "active":
      return "正式生效";
    case "rolled_back":
      return "已回滚";
    case "published":
      return "已发布";
    case "archived":
      return "已归档";
    default:
      return status;
  }
}

function optionalTrimmed(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
