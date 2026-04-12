import type {
  EvaluationSuiteRecord,
  FrozenExperimentBindingRecord,
} from "./verification-ops-record.ts";

export interface FrozenExperimentBindingInput {
  lane: FrozenExperimentBindingRecord["lane"];
  executionProfileId?: string;
  runtimeBindingId?: string;
  modelRoutingPolicyVersionId?: string;
  retrievalPresetId?: string;
  manualReviewPolicyId?: string;
  modelId: string;
  runtimeId: string;
  promptTemplateId: string;
  skillPackageIds: string[];
  qualityPackageVersionIds?: string[];
  moduleTemplateId: string;
}

export class EvaluationExperimentBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvaluationExperimentBindingError";
  }
}

export function freezeExperimentBindings(input: {
  suite: EvaluationSuiteRecord;
  baselineBinding?: FrozenExperimentBindingInput;
  candidateBinding?: FrozenExperimentBindingInput;
}): {
  baselineBinding: FrozenExperimentBindingRecord;
  candidateBinding: FrozenExperimentBindingRecord;
} {
  if (!input.baselineBinding || !input.candidateBinding) {
    throw new EvaluationExperimentBindingError(
      "Evaluation runs require both baseline and candidate frozen bindings.",
    );
  }

  const baselineBinding = freezeBinding(input.baselineBinding, "baseline");
  const candidateBinding = freezeBinding(input.candidateBinding, "candidate");
  const diffCount = countPrimaryDiffs(baselineBinding, candidateBinding);

  if (input.suite.supports_ab_comparison && diffCount !== 1) {
    throw new EvaluationExperimentBindingError(
      `Evaluation suite ${input.suite.id} requires exactly one primary A/B difference.`,
    );
  }

  if (!input.suite.supports_ab_comparison && diffCount > 0) {
    throw new EvaluationExperimentBindingError(
      `Evaluation suite ${input.suite.id} does not allow A/B comparisons.`,
    );
  }

  return {
    baselineBinding,
    candidateBinding,
  };
}

function freezeBinding(
  input: FrozenExperimentBindingInput,
  expectedLane: FrozenExperimentBindingRecord["lane"],
): FrozenExperimentBindingRecord {
  if (input.lane !== expectedLane) {
    throw new EvaluationExperimentBindingError(
      `Expected ${expectedLane} binding lane, received ${input.lane}.`,
    );
  }

  return {
    lane: input.lane,
    ...withOptionalField(
      "execution_profile_id",
      optionalValue(input.executionProfileId),
    ),
    ...withOptionalField(
      "runtime_binding_id",
      optionalValue(input.runtimeBindingId),
    ),
    ...withOptionalField(
      "model_routing_policy_version_id",
      optionalValue(input.modelRoutingPolicyVersionId),
    ),
    ...withOptionalField(
      "retrieval_preset_id",
      optionalValue(input.retrievalPresetId),
    ),
    ...withOptionalField(
      "manual_review_policy_id",
      optionalValue(input.manualReviewPolicyId),
    ),
    model_id: requireValue(input.modelId, `${expectedLane}.modelId`),
    runtime_id: requireValue(input.runtimeId, `${expectedLane}.runtimeId`),
    prompt_template_id: requireValue(
      input.promptTemplateId,
      `${expectedLane}.promptTemplateId`,
    ),
    skill_package_ids: dedupePreserveOrder(
      input.skillPackageIds.map((value) =>
        requireValue(value, `${expectedLane}.skillPackageIds[]`),
      ),
    ),
    ...withOptionalField(
      "quality_package_version_ids",
      optionalOrderedValues(
        input.qualityPackageVersionIds,
        `${expectedLane}.qualityPackageVersionIds[]`,
      ),
    ),
    module_template_id: requireValue(
      input.moduleTemplateId,
      `${expectedLane}.moduleTemplateId`,
    ),
  };
}

function requireValue(value: string, label: string): string {
  if (value.trim().length === 0) {
    throw new EvaluationExperimentBindingError(
      `Frozen experiment binding field ${label} is required.`,
    );
  }

  return value;
}

function optionalValue(value: string | undefined): string | undefined {
  return value?.trim().length ? value.trim() : undefined;
}

function optionalOrderedValues(
  values: string[] | undefined,
  label: string,
): string[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  return dedupePreserveOrder(values.map((value) => requireValue(value, label)));
}

function countPrimaryDiffs(
  baselineBinding: FrozenExperimentBindingRecord,
  candidateBinding: FrozenExperimentBindingRecord,
): number {
  let diffCount = 0;

  if (
    baselineBinding.execution_profile_id !== candidateBinding.execution_profile_id
  ) {
    diffCount += 1;
  }
  if (baselineBinding.runtime_binding_id !== candidateBinding.runtime_binding_id) {
    diffCount += 1;
  }
  if (
    baselineBinding.model_routing_policy_version_id !==
    candidateBinding.model_routing_policy_version_id
  ) {
    diffCount += 1;
  }
  if (
    baselineBinding.retrieval_preset_id !== candidateBinding.retrieval_preset_id
  ) {
    diffCount += 1;
  }
  if (
    baselineBinding.manual_review_policy_id !==
    candidateBinding.manual_review_policy_id
  ) {
    diffCount += 1;
  }
  if (baselineBinding.model_id !== candidateBinding.model_id) {
    diffCount += 1;
  }
  if (baselineBinding.runtime_id !== candidateBinding.runtime_id) {
    diffCount += 1;
  }
  if (
    baselineBinding.prompt_template_id !== candidateBinding.prompt_template_id
  ) {
    diffCount += 1;
  }
  if (
    !sameOrderedIds(
      baselineBinding.skill_package_ids,
      candidateBinding.skill_package_ids,
    )
  ) {
    diffCount += 1;
  }
  if (
    !sameOrderedIds(
      baselineBinding.quality_package_version_ids ?? [],
      candidateBinding.quality_package_version_ids ?? [],
    )
  ) {
    diffCount += 1;
  }
  if (
    baselineBinding.module_template_id !== candidateBinding.module_template_id
  ) {
    diffCount += 1;
  }

  return diffCount;
}

function withOptionalField<TKey extends keyof FrozenExperimentBindingRecord>(
  key: TKey,
  value: FrozenExperimentBindingRecord[TKey] | undefined,
): Partial<FrozenExperimentBindingRecord> {
  return value === undefined ? {} : { [key]: value };
}

function sameOrderedIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function dedupePreserveOrder<T extends string>(values: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}
