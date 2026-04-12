import type {
  ModuleExecutionProfileRecord,
} from "../execution-governance/execution-governance-record.ts";
import type {
  ManualReviewPolicyRecord,
} from "../manual-review-policies/manual-review-policy-record.ts";
import type {
  ModelRoutingPolicyVersionRecord,
} from "../model-routing-governance/model-routing-governance-record.ts";
import type {
  RetrievalPresetRecord,
} from "../retrieval-presets/retrieval-preset-record.ts";
import type { RuntimeBindingRecord } from "../runtime-bindings/runtime-binding-record.ts";

export interface HarnessEnvironmentRecord {
  execution_profile: ModuleExecutionProfileRecord;
  runtime_binding: RuntimeBindingRecord;
  model_routing_policy_version: ModelRoutingPolicyVersionRecord;
  retrieval_preset?: RetrievalPresetRecord;
  manual_review_policy?: ManualReviewPolicyRecord;
}

export type HarnessEnvironmentComponent =
  | "execution_profile"
  | "runtime_binding"
  | "model_routing_policy_version"
  | "retrieval_preset"
  | "manual_review_policy";

export interface HarnessEnvironmentDiffRecord {
  changed_components: HarnessEnvironmentComponent[];
}

export interface HarnessEnvironmentPreviewRecord {
  active_environment: HarnessEnvironmentRecord;
  candidate_environment: HarnessEnvironmentRecord;
  diff: HarnessEnvironmentDiffRecord;
}
