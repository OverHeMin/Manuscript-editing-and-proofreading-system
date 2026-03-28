import type {
  EvaluationSuiteRecord,
  FrozenExperimentBindingRecord,
} from "./verification-ops-record.ts";

export interface FrozenExperimentBindingInput {
  lane: FrozenExperimentBindingRecord["lane"];
  modelId: string;
  runtimeId: string;
  promptTemplateId: string;
  skillPackageIds: string[];
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
      `Evaluation suite ${input.suite.id} requires exactly one primary A/B difference, received ${diffCount}.`,
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

function countPrimaryDiffs(
  baselineBinding: FrozenExperimentBindingRecord,
  candidateBinding: FrozenExperimentBindingRecord,
): number {
  let diffCount = 0;

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
    baselineBinding.module_template_id !== candidateBinding.module_template_id
  ) {
    diffCount += 1;
  }

  return diffCount;
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
