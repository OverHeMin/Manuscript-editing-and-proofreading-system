import test from "node:test";
import assert from "node:assert/strict";
import {
  freezeExperimentBindings,
} from "../../src/modules/verification-ops/experiment-binding-guard.ts";
import type { EvaluationSuiteRecord } from "../../src/modules/verification-ops/verification-ops-record.ts";

const abSuite: EvaluationSuiteRecord = {
  id: "suite-1",
  name: "Editing A/B Suite",
  suite_type: "regression",
  status: "active",
  verification_check_profile_ids: ["check-profile-1"],
  module_scope: ["editing"],
  requires_production_baseline: true,
  supports_ab_comparison: true,
  hard_gate_policy: {
    must_use_deidentified_samples: true,
    requires_parsable_output: true,
  },
  score_weights: {
    structure: 25,
    terminology: 20,
    knowledge_coverage: 20,
    risk_detection: 20,
    human_edit_burden: 10,
    cost_and_latency: 5,
  },
  admin_only: true,
};

test("freezeExperimentBindings freezes quality package refs and treats them as a primary diff", () => {
  const result = freezeExperimentBindings({
    suite: abSuite,
    baselineBinding: {
      lane: "baseline",
      runtimeBindingId: "binding-shared-1",
      modelId: "model-prod-1",
      runtimeId: "runtime-prod-1",
      promptTemplateId: "prompt-prod-1",
      skillPackageIds: ["skill-prod-1"],
      moduleTemplateId: "template-prod-1",
      qualityPackageVersionIds: [
        "quality-package-version-1",
        "quality-package-version-1",
      ],
    } as never,
    candidateBinding: {
      lane: "candidate",
      runtimeBindingId: "binding-shared-1",
      modelId: "model-prod-1",
      runtimeId: "runtime-prod-1",
      promptTemplateId: "prompt-prod-1",
      skillPackageIds: ["skill-prod-1"],
      moduleTemplateId: "template-prod-1",
      qualityPackageVersionIds: ["quality-package-version-2"],
    } as never,
  });

  assert.deepEqual(result.baselineBinding, {
    lane: "baseline",
    runtime_binding_id: "binding-shared-1",
    model_id: "model-prod-1",
    runtime_id: "runtime-prod-1",
    prompt_template_id: "prompt-prod-1",
    skill_package_ids: ["skill-prod-1"],
    quality_package_version_ids: ["quality-package-version-1"],
    module_template_id: "template-prod-1",
  });
  assert.deepEqual(result.candidateBinding, {
    lane: "candidate",
    runtime_binding_id: "binding-shared-1",
    model_id: "model-prod-1",
    runtime_id: "runtime-prod-1",
    prompt_template_id: "prompt-prod-1",
    skill_package_ids: ["skill-prod-1"],
    quality_package_version_ids: ["quality-package-version-2"],
    module_template_id: "template-prod-1",
  });
});
