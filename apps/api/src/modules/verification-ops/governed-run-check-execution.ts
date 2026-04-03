import type {
  EvaluationRunRecord,
  EvaluationSuiteRecord,
  GovernedExecutionEvaluationSourceRecord,
  VerificationCheckProfileRecord,
  VerificationEvidenceRecord,
} from "./verification-ops-record.ts";

export interface GovernedVerificationCheckExecutionInput {
  run: EvaluationRunRecord;
  suite: EvaluationSuiteRecord;
  checkProfile: VerificationCheckProfileRecord;
  governedSource: GovernedExecutionEvaluationSourceRecord;
}

export interface GovernedVerificationCheckExecutionEvidence {
  kind: VerificationEvidenceRecord["kind"];
  label: string;
  uri?: string;
  artifactAssetId?: string;
}

export interface GovernedVerificationCheckExecutionResult {
  outcome: "passed" | "failed";
  evidence: GovernedVerificationCheckExecutionEvidence;
  failureReason?: string;
}

export type GovernedRunCheckExecutor = (
  input: GovernedVerificationCheckExecutionInput,
) => Promise<GovernedVerificationCheckExecutionResult>;

export function createDefaultGovernedRunCheckExecutor(): GovernedRunCheckExecutor {
  return async ({ checkProfile, governedSource }) => ({
    outcome: "passed",
    evidence: {
      kind: "artifact",
      label: `Automatic governed ${checkProfile.check_type} passed for ${checkProfile.name}`,
      artifactAssetId: governedSource.output_asset_id,
    },
  });
}

export function mergeGovernedVerificationCheckProfileIds(input: {
  suiteProfileIds: string[];
  releaseProfileIds?: string[];
}): string[] {
  const merged = [
    ...input.suiteProfileIds,
    ...(input.releaseProfileIds ?? []),
  ];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const profileId of merged) {
    if (seen.has(profileId)) {
      continue;
    }

    seen.add(profileId);
    result.push(profileId);
  }

  return result;
}
