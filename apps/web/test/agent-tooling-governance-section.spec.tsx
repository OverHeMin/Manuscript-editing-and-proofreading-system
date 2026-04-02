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
    toolGatewayTools: [],
    sandboxProfiles: [],
    agentProfiles: [],
    agentRuntimes: [],
    toolPermissionPolicies: [],
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
    verification_evidence_ids: [],
    status: input.status,
    started_at: input.startedAt,
    finished_at: input.status === "running" ? undefined : "2026-04-02T11:30:00.000Z",
  };
}
