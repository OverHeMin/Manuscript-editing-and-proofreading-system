import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AgentToolingGovernanceSection } from "../src/features/admin-governance/agent-tooling-governance-section.tsx";
import type {
  AdminGovernanceOverview,
  AdminGovernanceWorkbenchController,
} from "../src/features/admin-governance/admin-governance-controller.ts";

test("agent tooling governance section renders execution triage filters and sorts recent logs by priority", () => {
  const html = renderToStaticMarkup(
    <AgentToolingGovernanceSection
      actorRole="admin"
      controller={{} as AdminGovernanceWorkbenchController}
      overview={createOverview({
        agentExecutionLogs: [
          createExecutionLog({
            id: "log-completed",
            manuscriptId: "manuscript-completed",
            status: "completed",
            startedAt: "2026-04-02T10:00:00.000Z",
          }),
          createExecutionLog({
            id: "log-running",
            manuscriptId: "manuscript-running",
            status: "running",
            startedAt: "2026-04-02T11:00:00.000Z",
          }),
          createExecutionLog({
            id: "log-failed",
            manuscriptId: "manuscript-failed",
            status: "failed",
            startedAt: "2026-04-02T09:00:00.000Z",
          }),
        ],
      })}
      isMutating={false}
      runMutation={async () => {}}
      onOverviewChange={() => {}}
    />,
  );

  assert.match(html, /Search executions/i);
  assert.match(html, /All \(3\)/);
  assert.match(html, /Running \(1\)/);
  assert.match(html, /Completed \(1\)/);
  assert.match(html, /Failed \(1\)/);

  const failedIndex = html.indexOf("manuscript-failed");
  const runningIndex = html.indexOf("manuscript-running");
  const completedIndex = html.indexOf("manuscript-completed");

  assert.notEqual(failedIndex, -1);
  assert.notEqual(runningIndex, -1);
  assert.notEqual(completedIndex, -1);
  assert.ok(failedIndex < runningIndex, "failed executions should be shown before running ones");
  assert.ok(runningIndex < completedIndex, "running executions should be shown before completed ones");
});

test("agent tooling governance section renders runtime binding verification expectations", () => {
  const html = renderToStaticMarkup(
    <AgentToolingGovernanceSection
      actorRole="admin"
      controller={{} as AdminGovernanceWorkbenchController}
      overview={createOverview({
        verificationCheckProfiles: [
          {
            id: "check-profile-1",
            name: "Editing Browser QA",
            check_type: "browser_qa",
            status: "published",
            admin_only: true,
          },
        ],
        releaseCheckProfiles: [
          {
            id: "release-profile-1",
            name: "Editing Release Gate",
            check_type: "deploy_verification",
            status: "published",
            verification_check_profile_ids: ["check-profile-1"],
            admin_only: true,
          },
        ],
        evaluationSuites: [
          {
            id: "suite-1",
            name: "Editing Regression Suite",
            suite_type: "regression",
            status: "active",
            verification_check_profile_ids: ["check-profile-1"],
            module_scope: ["editing"],
            admin_only: true,
          },
        ],
        runtimeBindings: [
          {
            id: "binding-1",
            module: "editing",
            manuscript_type: "review",
            template_family_id: "family-1",
            runtime_id: "runtime-1",
            sandbox_profile_id: "sandbox-1",
            agent_profile_id: "agent-profile-1",
            tool_permission_policy_id: "policy-1",
            prompt_template_id: "prompt-1",
            skill_package_ids: ["skill-1"],
            execution_profile_id: "profile-1",
            verification_check_profile_ids: ["check-profile-1"],
            evaluation_suite_ids: ["suite-1"],
            release_check_profile_id: "release-profile-1",
            status: "active",
            version: 1,
          },
        ],
      })}
      isMutating={false}
      runMutation={async () => {}}
      onOverviewChange={() => {}}
    />,
  );

  assert.match(html, /Verification Check Profiles/i);
  assert.match(html, /Evaluation Suites/i);
  assert.match(html, /Release Check Profile/i);
  assert.match(html, /Editing Browser QA/);
  assert.match(html, /Editing Regression Suite/);
  assert.match(html, /Editing Release Gate/);
});

test("agent tooling governance section renders routing governance drafts, grouped scopes, and lifecycle actions", () => {
  const html = renderToStaticMarkup(
    <AgentToolingGovernanceSection
      actorRole="admin"
      controller={{} as AdminGovernanceWorkbenchController}
      overview={createOverview({
        modelRegistryEntries: [
          {
            id: "model-primary-1",
            provider: "openai",
            model_name: "gpt-5.4",
            model_version: "2026-04-01",
            allowed_modules: ["screening", "editing", "proofreading"],
            is_prod_allowed: true,
          },
          {
            id: "model-fallback-1",
            provider: "google",
            model_name: "gemini-2.5-pro",
            model_version: "2026-04-01",
            allowed_modules: ["screening", "editing", "proofreading"],
            is_prod_allowed: true,
          },
        ],
        routingPolicies: [
          {
            policy_id: "policy-template-family-1",
            scope_kind: "template_family",
            scope_value: "family-1",
            active_version: {
              id: "policy-version-1",
              policy_scope_id: "policy-template-family-1",
              scope_kind: "template_family",
              scope_value: "family-1",
              version_no: 1,
              primary_model_id: "model-primary-1",
              fallback_model_ids: ["model-fallback-1"],
              evidence_links: [{ kind: "evaluation_run", id: "run-1" }],
              status: "active",
              created_at: "2026-04-03T08:00:00.000Z",
              updated_at: "2026-04-03T08:05:00.000Z",
            },
            versions: [],
            decisions: [],
          },
          {
            policy_id: "policy-module-1",
            scope_kind: "module",
            scope_value: "editing",
            versions: [
              {
                id: "policy-version-2",
                policy_scope_id: "policy-module-1",
                scope_kind: "module",
                scope_value: "editing",
                version_no: 2,
                primary_model_id: "model-primary-1",
                fallback_model_ids: ["model-fallback-1"],
                evidence_links: [{ kind: "evaluation_run", id: "run-2" }],
                notes: "Editing module routing draft",
                status: "draft",
                created_at: "2026-04-03T09:00:00.000Z",
                updated_at: "2026-04-03T09:05:00.000Z",
              },
            ],
            decisions: [],
          },
        ],
      })}
      isMutating={false}
      runMutation={async () => {}}
      onOverviewChange={() => {}}
    />,
  );

  assert.match(html, /Routing Policy Draft/i);
  assert.match(html, /template_family/i);
  assert.match(html, /module/i);
  assert.match(html, /family-1/);
  assert.match(html, /editing/);
  assert.match(html, /New Draft Version/);
  assert.match(html, /Save Draft/);
  assert.match(html, /Submit For Review/);
  assert.match(html, /Approve/);
  assert.match(html, /Activate/);
  assert.match(html, /Rollback/);
  assert.match(html, /run-1/);
  assert.match(html, /run-2/);
  assert.match(html, /model-primary-1/);
  assert.match(html, /model-fallback-1/);
});

function createOverview(
  overrides: Partial<AdminGovernanceOverview> = {},
): AdminGovernanceOverview {
  return {
    templateFamilies: [],
    selectedTemplateFamilyId: null,
    moduleTemplates: [],
    promptTemplates: [],
    skillPackages: [],
    executionProfiles: [],
    modelRegistryEntries: [],
    modelRoutingPolicy: {
      system_default_model_id: null,
      module_defaults: {},
      template_overrides: {},
      updated_at: "2026-04-02T08:00:00.000Z",
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
    agentExecutionLogs: [],
    ...overrides,
  };
}

function createExecutionLog(input: {
  id: string;
  manuscriptId: string;
  status: "running" | "completed" | "failed" | "queued";
  startedAt: string;
}) {
  return {
    id: input.id,
    manuscript_id: input.manuscriptId,
    module: "editing" as const,
    triggered_by: "dev.admin",
    runtime_id: "runtime-1",
    sandbox_profile_id: "sandbox-1",
    agent_profile_id: "agent-profile-1",
    runtime_binding_id: "binding-1",
    tool_permission_policy_id: "policy-1",
    knowledge_item_ids: [],
    verification_check_profile_ids: [],
    evaluation_suite_ids: [],
    release_check_profile_id: undefined,
    verification_evidence_ids: [],
    status: input.status,
    started_at: input.startedAt,
    finished_at: input.status === "running" ? undefined : "2026-04-02T11:30:00.000Z",
  };
}
