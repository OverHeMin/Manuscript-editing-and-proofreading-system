import test from "node:test";
import assert from "node:assert/strict";
import type { ManuscriptRecord } from "../../src/modules/manuscripts/manuscript-record.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";
import {
  resolveBareModuleContext,
} from "../../src/modules/shared/bare-module-context-resolver.ts";
import { getBareModulePromptSkeleton } from "../../src/modules/shared/bare-module-prompt-skeletons.ts";

test("bare module context resolves module-scoped model routing without template-family governance", async () => {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const modelSelectionInputs: Array<Record<string, unknown>> = [];

  await manuscriptRepository.save({
    id: "manuscript-bare-1",
    title: "Bare mode manuscript",
    manuscript_type: "clinical_study",
    status: "uploaded",
    created_by: "user-1",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: undefined,
    created_at: "2026-04-16T10:00:00.000Z",
    updated_at: "2026-04-16T10:00:00.000Z",
  } satisfies ManuscriptRecord);

  const context = await resolveBareModuleContext({
    manuscriptId: "manuscript-bare-1",
    module: "editing",
    jobId: "job-bare-1",
    actorId: "editor-1",
    actorRole: "editor",
    manuscriptRepository,
    aiGatewayService: {
      async resolveModelSelection(input: Record<string, unknown>) {
        modelSelectionInputs.push(input);
        return {
          layer: "legacy_module_default" as const,
          model: {
            id: "model-bare-editing-1",
            provider: "openai",
            model_name: "bare-editing-model",
            model_version: "2026-04-16",
            allowed_modules: ["editing"],
            is_prod_allowed: true,
          },
          fallback_chain: [],
          warnings: [],
          policy_scope_kind: "module" as const,
          policy_scope_value: "editing",
          policy_version_id: "routing-policy-editing-bare-1",
        };
      },
    } as never,
  });

  assert.equal(context.executionMode, "bare");
  const promptSkeleton = getBareModulePromptSkeleton("editing");
  assert.equal(context.moduleTemplateId, promptSkeleton.templateId);
  assert.equal(context.promptTemplateId, promptSkeleton.id);
  assert.equal(context.modelSelection.model.id, "model-bare-editing-1");
  assert.equal(context.promptSkeleton.id, promptSkeleton.id);
  assert.deepEqual(context.skillPackageIds, []);
  assert.deepEqual(context.knowledgeHits, []);
  assert.deepEqual(modelSelectionInputs, [
    {
      module: "editing",
      taskId: "job-bare-1",
      actorId: "editor-1",
      actorRole: "editor",
    },
  ]);
});

test("bare module prompt skeleton IDs stay UUID-compatible for persistent runtime lookups", () => {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

  for (const module of ["screening", "editing", "proofreading"] as const) {
    const skeleton = getBareModulePromptSkeleton(module);
    assert.match(skeleton.id, uuidPattern);
    assert.match(skeleton.templateId, uuidPattern);
    assert.match(skeleton.executionProfileId, uuidPattern);
  }
});
