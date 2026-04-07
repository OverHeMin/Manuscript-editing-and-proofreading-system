import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { AiGatewayService } from "../../src/modules/ai-gateway/ai-gateway-service.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { InMemoryExecutionGovernanceRepository } from "../../src/modules/execution-governance/in-memory-execution-governance-repository.ts";
import { ExecutionGovernanceService } from "../../src/modules/execution-governance/execution-governance-service.ts";
import { InMemoryKnowledgeRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";
import {
  InMemoryModelRegistryRepository,
  InMemoryModelRoutingPolicyRepository,
} from "../../src/modules/model-registry/in-memory-model-registry-repository.ts";
import { ModelRegistryService } from "../../src/modules/model-registry/model-registry-service.ts";
import { InMemoryPromptSkillRegistryRepository } from "../../src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts";
import { resolveGovernedModuleContext } from "../../src/modules/shared/governed-module-context-resolver.ts";
import { InMemoryModuleTemplateRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";

async function createGovernedContextHarness() {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const promptSkillRegistryRepository = new InMemoryPromptSkillRegistryRepository();
  const knowledgeRepository = new InMemoryKnowledgeRepository();
  const executionGovernanceRepository = new InMemoryExecutionGovernanceRepository();
  const editorialRuleRepository = new InMemoryEditorialRuleRepository();

  const executionGovernanceService = new ExecutionGovernanceService({
    repository: executionGovernanceRepository,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    createId: (() => {
      const ids = ["profile-1"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected an execution governance id to be available.");
        return value;
      };
    })(),
  });

  const modelRepository = new InMemoryModelRegistryRepository();
  const routingPolicyRepository = new InMemoryModelRoutingPolicyRepository();
  const modelRegistryService = new ModelRegistryService({
    repository: modelRepository,
    routingPolicyRepository,
    createId: (() => {
      const ids = ["model-1"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a model id to be available.");
        return value;
      };
    })(),
  });
  const aiGatewayService = new AiGatewayService({
    repository: modelRepository,
    routingPolicyRepository,
    auditService: new InMemoryAuditService(),
    now: () => new Date("2026-04-07T09:00:00.000Z"),
  });

  await modelRegistryService.createModelEntry("admin", {
    provider: "openai",
    modelName: "gpt-5-default",
    modelVersion: "2026-04",
    allowedModules: ["screening", "editing", "proofreading"],
    isProdAllowed: true,
  });
  await modelRegistryService.updateRoutingPolicy("admin", {
    systemDefaultModelId: "model-1",
    moduleDefaults: {
      screening: "model-1",
    },
  });

  await manuscriptRepository.save({
    id: "manuscript-1",
    title: "Governed screening fixture",
    manuscript_type: "clinical_study",
    status: "uploaded",
    created_by: "user-1",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-1",
    created_at: "2026-04-07T08:30:00.000Z",
    updated_at: "2026-04-07T08:30:00.000Z",
  });

  await moduleTemplateRepository.save({
    id: "template-screening-1",
    template_family_id: "family-1",
    module: "screening",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Screening template",
  });

  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-screening-1",
    name: "screening_mainline",
    version: "1.0.0",
    status: "published",
    module: "screening",
    manuscript_types: ["clinical_study"],
  });

  await editorialRuleRepository.saveRuleSet({
    id: "screening-rule-set-1",
    template_family_id: "family-1",
    module: "screening",
    version_no: 1,
    status: "published",
  });
  await editorialRuleRepository.saveRule({
    id: "screening-rule-1",
    rule_set_id: "screening-rule-set-1",
    order_no: 10,
    rule_type: "content",
    execution_mode: "inspect",
    scope: {
      sections: ["abstract"],
    },
    trigger: {
      kind: "structural_presence",
      field: "abstract",
    },
    action: {
      kind: "emit_finding",
      message: "Abstract should be present.",
    },
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  });

  await executionGovernanceRepository.saveProfile({
    id: "profile-1",
    module: "screening",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    module_template_id: "template-screening-1",
    rule_set_id: "screening-rule-set-1",
    prompt_template_id: "prompt-screening-1",
    skill_package_ids: [],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });

  await knowledgeRepository.save({
    id: "knowledge-projection-1",
    title: "Abstract objective heading rule",
    canonical_text: "If the heading is 摘要 目的, normalize it to （摘要　目的）.",
    summary: "Projected rule summary for AI retrieval.",
    knowledge_kind: "prompt_snippet",
    status: "approved",
    routing: {
      module_scope: "any",
      manuscript_types: ["clinical_study"],
    },
    projection_source: {
      source_kind: "editorial_rule_projection",
      rule_set_id: "rule-set-1",
      rule_id: "rule-1",
      projection_kind: "prompt_snippet",
    },
  });

  return {
    aiGatewayService,
    executionGovernanceService,
    knowledgeRepository,
    manuscriptRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
  };
}

test("governed module context preserves projected knowledge provenance through dynamic routing", async () => {
  const harness = await createGovernedContextHarness();

  const screeningContext = await resolveGovernedModuleContext({
    manuscriptId: "manuscript-1",
    module: "screening",
    jobId: "job-1",
    actorId: "screener-1",
    actorRole: "screener",
    manuscriptRepository: harness.manuscriptRepository,
    moduleTemplateRepository: harness.moduleTemplateRepository,
    executionGovernanceService: harness.executionGovernanceService,
    promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
    knowledgeRepository: harness.knowledgeRepository,
    aiGatewayService: harness.aiGatewayService,
  });

  const projectedSelection = screeningContext.knowledgeSelections.find(
    (selection) => selection.knowledgeItem.id === "knowledge-projection-1",
  );

  assert.equal(
    screeningContext.knowledgeSelections.some(
      (selection) => selection.matchSource === "dynamic_routing",
    ),
    true,
  );
  assert.equal(projectedSelection?.matchSource, "dynamic_routing");
  assert.equal(
    projectedSelection?.knowledgeItem.projection_source?.source_kind,
    "editorial_rule_projection",
  );
  assert.equal(
    projectedSelection?.knowledgeItem.projection_source?.rule_set_id,
    "rule-set-1",
  );
  assert.equal(
    projectedSelection?.knowledgeItem.projection_source?.projection_kind,
    "prompt_snippet",
  );
});
