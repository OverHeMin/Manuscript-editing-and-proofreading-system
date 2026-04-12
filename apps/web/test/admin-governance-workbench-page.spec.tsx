import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AdminGovernanceWorkbenchPage,
} from "../src/features/admin-governance/admin-governance-workbench-page.tsx";

function buildOverview() {
  return {
    templateFamilies: [
      {
        id: "family-1",
        manuscript_type: "clinical_study",
        name: "Clinical Study Family",
        status: "active",
      },
    ],
    selectedTemplateFamilyId: "family-1",
    moduleTemplates: [],
    promptTemplates: [],
    skillPackages: [],
    executionProfiles: [],
    qualityPackages: [],
    modelRegistryEntries: [
      {
        id: "model-qwen-1",
        provider: "openai",
        model_name: "qwen-max",
        model_version: "2026-04-10",
        allowed_modules: ["editing"],
        is_prod_allowed: true,
        connection_id: "connection-qwen-1",
        fallback_model_id: "model-fallback-1",
      },
      {
        id: "model-fallback-1",
        provider: "openai",
        model_name: "deepseek-chat",
        model_version: "2026-04-10",
        allowed_modules: ["editing"],
        is_prod_allowed: true,
        connection_id: "connection-deepseek-1",
      },
    ],
    modelRoutingPolicy: {
      system_default_model_id: "model-qwen-1",
      module_defaults: {
        editing: "model-qwen-1",
      },
      template_overrides: {},
    },
    routingPolicies: [],
    toolGatewayTools: [],
    sandboxProfiles: [],
    agentProfiles: [],
    agentRuntimes: [],
    toolPermissionPolicies: [],
    verificationCheckProfiles: [],
    releaseCheckProfiles: [],
    evaluationSuites: [],
    runtimeBindings: [],
    harnessAdapters: [],
    harnessAdapterHealth: [],
    latestJudgeCalibrationBatchOutcome: null,
    agentExecutionLogs: [],
    aiProviderConnections: [
      {
        id: "connection-qwen-1",
        name: "Qwen Production",
        provider_kind: "qwen",
        compatibility_mode: "openai_chat_compatible",
        enabled: true,
        last_test_status: "unknown",
        credential_summary: {
          mask: "sk-***a562",
          version: 1,
        },
      },
      {
        id: "connection-deepseek-1",
        name: "DeepSeek Production",
        provider_kind: "deepseek",
        compatibility_mode: "openai_chat_compatible",
        enabled: true,
        last_test_status: "passed",
        credential_summary: {
          mask: "sk-***c101",
          version: 2,
        },
      },
    ],
  };
}

function buildExecutionPreview() {
  return {
    profile: {
      id: "profile-1",
      module: "editing",
      manuscript_type: "clinical_study",
      template_family_id: "family-1",
      module_template_id: "template-1",
      prompt_template_id: "prompt-1",
      skill_package_ids: [],
      knowledge_binding_mode: "profile_only",
      status: "active",
      version: 1,
    },
    module_template: {
      id: "template-1",
      template_family_id: "family-1",
      module: "editing",
      manuscript_type: "clinical_study",
      version_no: 1,
      status: "published",
      prompt: "Editing template",
    },
    rule_set: {
      id: "rule-set-1",
      module: "editing",
      status: "published",
      version_no: 1,
      name: "Editing rules",
    },
    rules: [],
    prompt_template: {
      id: "prompt-1",
      name: "editing_mainline",
      version: "1.0.0",
      status: "published",
      module: "editing",
      manuscript_types: ["clinical_study"],
    },
    skill_packages: [],
    knowledge_binding_rules: [],
    knowledge_items: [],
    resolved_model: {
      id: "model-qwen-1",
      provider: "openai",
      model_name: "qwen-max",
      model_version: "2026-04-10",
      allowed_modules: ["editing"],
      is_prod_allowed: true,
      connection_id: "connection-qwen-1",
    },
    model_source: "legacy_module_default",
    resolved_connection: {
      id: "connection-qwen-1",
      name: "Qwen Production",
      provider_kind: "qwen",
      compatibility_mode: "openai_chat_compatible",
      enabled: true,
      last_test_status: "unknown",
      credential_present: true,
    },
    provider_readiness: {
      status: "warning",
      issues: [
        {
          code: "connection_test_unknown",
          message: "Connection has not been tested yet.",
        },
      ],
    },
    fallback_chain: [
      {
        id: "model-fallback-1",
        provider: "openai",
        model_name: "deepseek-chat",
        model_version: "2026-04-10",
        allowed_modules: ["editing"],
        is_prod_allowed: true,
        connection_id: "connection-qwen-1",
      },
    ],
    warnings: [
      {
        code: "legacy_unbound",
        message: "Resolved model is still using legacy provider fields without connection_id.",
      },
    ],
  };
}

test("admin governance workbench page renders management overview routing cards instead of a parameter wall", () => {
  const markup = renderToStaticMarkup(
    <AdminGovernanceWorkbenchPage
      actorRole="admin"
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      } as never}
      initialOverview={buildOverview() as never}
      initialExecutionPreview={buildExecutionPreview() as never}
    />,
  );

  assert.match(markup, /管理总览/);
  assert.match(markup, /AI 接入/);
  assert.match(markup, /账号与权限/);
  assert.match(markup, /Harness 控制/);
  assert.match(markup, /规则中心/);
  assert.match(markup, /#system-settings\?settingsSection=ai-access/);
  assert.match(markup, /#system-settings\?settingsSection=accounts/);
  assert.match(markup, /#evaluation-workbench\?harnessSection=overview/);
  assert.match(markup, /#evaluation-workbench\?harnessSection=runs/);
  assert.match(markup, /#harness-datasets/);
  assert.match(markup, /#template-governance\?ruleCenterMode=authoring/);
  assert.doesNotMatch(markup, /Harness Control Plane/);
  assert.doesNotMatch(markup, /Create Template Family/);
  assert.doesNotMatch(markup, /Environment Editor/);
});

test("admin governance workbench page renders AI and harness snapshots without exposing old edit-first sections", () => {
  const markup = renderToStaticMarkup(
    <AdminGovernanceWorkbenchPage
      actorRole="admin"
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      } as never}
      initialOverview={buildOverview() as never}
      initialExecutionPreview={buildExecutionPreview() as never}
    />,
  );

  assert.match(markup, /AI 接入快照/);
  assert.match(markup, /Qwen Production/);
  assert.match(markup, /DeepSeek Production/);
  assert.match(markup, /当前生效连接/);
  assert.match(markup, /connection-qwen-1/);
  assert.match(markup, /openai_chat_compatible/);
  assert.match(markup, /回退模型/);
  assert.match(markup, /openai \/ deepseek-chat \(model-fallback-1\)/);
  assert.match(markup, /预览预警/);
  assert.match(markup, /legacy_unbound/);
  assert.match(markup, /连通提醒/);
  assert.match(markup, /connection_test_unknown/);
  assert.match(markup, /Harness 运行体征/);
  assert.match(markup, /查看治理资产明细/);
  assert.doesNotMatch(markup, /Save Model Changes/);
  assert.doesNotMatch(markup, /Legacy Fallback Defaults/);
});
