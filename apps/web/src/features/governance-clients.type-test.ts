import {
  createExecutionProfile,
  listExecutionProfiles,
  resolveExecutionBundlePreview,
  type CreateExecutionProfileInput,
  type ExecutionProfileStatus,
  type ModuleExecutionProfileViewModel,
  type ResolvedExecutionBundleViewModel,
} from "./execution-governance/index.ts";
import {
  listKnowledgeHitLogsBySnapshotId,
  recordExecutionSnapshot,
  type KnowledgeHitMatchSource,
  type ModuleExecutionSnapshotViewModel,
  type RecordExecutionSnapshotInput,
} from "./execution-tracking/index.ts";
import {
  recordHumanFeedback,
  type HumanFeedbackRecordViewModel,
  type HumanFeedbackType,
  type RecordHumanFeedbackInput,
} from "./feedback-governance/index.ts";

const executionProfileStatusCheck: ExecutionProfileStatus = "active";
const feedbackTypeCheck: HumanFeedbackType = "manual_correction";
const knowledgeHitSourceCheck: KnowledgeHitMatchSource = "template_binding";

const profileViewModelCheck: ModuleExecutionProfileViewModel = {
  id: "profile-1",
  module: "editing",
  manuscript_type: "clinical_study",
  template_family_id: "family-1",
  module_template_id: "template-1",
  rule_set_id: "rule-set-1",
  prompt_template_id: "prompt-1",
  skill_package_ids: ["skill-1"],
  knowledge_binding_mode: "profile_plus_dynamic",
  status: executionProfileStatusCheck,
  version: 2,
};

const resolvedExecutionBundleCheck: ResolvedExecutionBundleViewModel = {
  profile: profileViewModelCheck,
  module_template: {
    id: "template-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 2,
    status: "published",
    prompt: "Editing template",
  },
  rule_set: {
    id: "rule-set-1",
    template_family_id: "family-1",
    module: "editing",
    version_no: 1,
    status: "published",
  },
  rules: [
    {
      id: "editorial-rule-1",
      rule_set_id: "rule-set-1",
      order_no: 10,
      rule_type: "format",
      execution_mode: "apply_and_inspect",
      scope: {
        section: "abstract",
      },
      trigger: {
        kind: "heading_equals",
        text: "摘要 目的",
      },
      action: {
        kind: "replace_heading",
        to: "（摘要　目的）",
      },
      confidence_policy: "always_auto",
      severity: "warning",
      enabled: true,
    },
  ],
  prompt_template: {
    id: "prompt-1",
    name: "editing_mainline",
    version: "1.0.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
    template_kind: "editing_instruction",
  },
  skill_packages: [
    {
      id: "skill-1",
      name: "editing_skills",
      version: "1.0.0",
      scope: "admin_only",
      status: "published",
      applies_to_modules: ["editing"],
    },
  ],
  resolved_model: {
    id: "model-1",
    provider: "openai",
    model_name: "gpt-5.4",
    model_version: "2026-03-01",
    allowed_modules: ["editing"],
    is_prod_allowed: true,
  },
  model_source: "legacy_module_default",
  knowledge_binding_rules: [
    {
      id: "rule-1",
      knowledge_item_id: "knowledge-1",
      module: "editing",
      manuscript_types: ["clinical_study"],
      priority: 10,
      binding_purpose: "required",
      status: "active",
    },
  ],
  knowledge_items: [
    {
      id: "knowledge-1",
      title: "Editing rule",
      canonical_text: "Approved editing rule",
      knowledge_kind: "rule",
      status: "approved",
      routing: {
        module_scope: "editing",
        manuscript_types: ["clinical_study"],
      },
    },
  ],
};

const snapshotViewModelCheck: ModuleExecutionSnapshotViewModel = {
  id: "snapshot-1",
  manuscript_id: "manuscript-1",
  module: "editing",
  job_id: "job-1",
  execution_profile_id: "profile-1",
  module_template_id: "template-1",
  module_template_version_no: 2,
  prompt_template_id: "prompt-1",
  prompt_template_version: "1.0.0",
  skill_package_ids: ["skill-1"],
  skill_package_versions: ["1.0.0"],
  model_id: "model-1",
  knowledge_item_ids: ["knowledge-1"],
  created_asset_ids: ["asset-1"],
  created_at: "2026-03-28T12:00:00.000Z",
};

const humanFeedbackViewModelCheck: HumanFeedbackRecordViewModel = {
  id: "feedback-1",
  manuscript_id: "manuscript-1",
  module: "editing",
  snapshot_id: "snapshot-1",
  feedback_type: feedbackTypeCheck,
  created_by: "editor-1",
  created_at: "2026-03-28T12:05:00.000Z",
};

const executionGovernanceInputCheck: CreateExecutionProfileInput = {
  actorRole: "admin",
  module: "editing",
  manuscriptType: "clinical_study",
  templateFamilyId: "family-1",
  moduleTemplateId: "template-1",
  ruleSetId: "rule-set-1",
  promptTemplateId: "prompt-1",
  skillPackageIds: ["skill-1"],
  knowledgeBindingMode: "profile_only",
};

const executionTrackingInputCheck: RecordExecutionSnapshotInput = {
  manuscriptId: "manuscript-1",
  module: "editing",
  jobId: "job-1",
  executionProfileId: "profile-1",
  moduleTemplateId: "template-1",
  moduleTemplateVersionNo: 2,
  promptTemplateId: "prompt-1",
  promptTemplateVersion: "1.0.0",
  skillPackageIds: ["skill-1"],
  skillPackageVersions: ["1.0.0"],
  modelId: "model-1",
  knowledgeHits: [
    {
      knowledgeItemId: "knowledge-1",
      matchSource: knowledgeHitSourceCheck,
      matchReasons: ["template_family"],
    },
  ],
};

const feedbackInputCheck: RecordHumanFeedbackInput = {
  manuscriptId: "manuscript-1",
  module: "editing",
  snapshotId: "snapshot-1",
  feedbackType: feedbackTypeCheck,
  createdBy: "editor-1",
};

const client = {
  async request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }) {
    void input;
    return {
      status: 200,
      body: undefined as TResponse,
    };
  },
};

void createExecutionProfile(client, executionGovernanceInputCheck);
void listExecutionProfiles(client);
void resolveExecutionBundlePreview(client, {
  module: "editing",
  manuscriptType: "clinical_study",
  templateFamilyId: "family-1",
});
void recordExecutionSnapshot(client, executionTrackingInputCheck);
void listKnowledgeHitLogsBySnapshotId(client, "snapshot-1");
void recordHumanFeedback(client, feedbackInputCheck);

export {
  executionProfileStatusCheck,
  feedbackTypeCheck,
  humanFeedbackViewModelCheck,
  knowledgeHitSourceCheck,
  profileViewModelCheck,
  resolvedExecutionBundleCheck,
  snapshotViewModelCheck,
};
