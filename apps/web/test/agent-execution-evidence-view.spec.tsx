import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AgentExecutionEvidenceView,
} from "../src/features/admin-governance/agent-execution-evidence-view.tsx";

test("agent execution evidence view renders frozen snapshot context and knowledge hit reasons", () => {
  const html = renderToStaticMarkup(
    <AgentExecutionEvidenceView
      evidence={{
        log: {
          id: "log-1",
          manuscript_id: "manuscript-1",
          module: "editing",
          triggered_by: "dev.admin",
          runtime_id: "runtime-1",
          sandbox_profile_id: "sandbox-1",
          agent_profile_id: "agent-profile-1",
          runtime_binding_id: "binding-1",
          tool_permission_policy_id: "policy-1",
          execution_snapshot_id: "snapshot-1",
          knowledge_item_ids: ["knowledge-1", "knowledge-2"],
          verification_evidence_ids: ["evidence-1", "evidence-2"],
          status: "completed",
          started_at: "2026-03-31T08:00:00.000Z",
          finished_at: "2026-03-31T08:01:00.000Z",
        },
        manuscript: {
          id: "manuscript-1",
          title: "Execution evidence manuscript",
          manuscript_type: "review",
          status: "completed",
          created_by: "dev.admin",
          current_editing_asset_id: "asset-1",
          current_template_family_id: "family-1",
          created_at: "2026-03-31T07:45:00.000Z",
          updated_at: "2026-03-31T08:01:00.000Z",
        },
        job: {
          id: "job-1",
          manuscript_id: "manuscript-1",
          module: "editing",
          job_type: "governed_execution",
          status: "completed",
          requested_by: "dev.admin",
          attempt_count: 1,
          started_at: "2026-03-31T08:00:00.000Z",
          finished_at: "2026-03-31T08:01:00.000Z",
          created_at: "2026-03-31T08:00:00.000Z",
          updated_at: "2026-03-31T08:01:00.000Z",
        },
        createdAssets: [
          {
            id: "asset-1",
            manuscript_id: "manuscript-1",
            asset_type: "edited_docx",
            status: "active",
            storage_key: "runs/manuscript-1/editing/final.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            parent_asset_id: "asset-source-1",
            source_module: "editing",
            source_job_id: "job-1",
            created_by: "dev.admin",
            version_no: 2,
            is_current: true,
            file_name: "editing-final.docx",
            created_at: "2026-03-31T08:00:45.000Z",
            updated_at: "2026-03-31T08:01:00.000Z",
          },
        ],
        snapshot: {
          id: "snapshot-1",
          manuscript_id: "manuscript-1",
          module: "editing",
          job_id: "job-1",
          execution_profile_id: "profile-1",
          module_template_id: "template-1",
          module_template_version_no: 3,
          prompt_template_id: "prompt-1",
          prompt_template_version: "1.2.0",
          skill_package_ids: ["skill-1"],
          skill_package_versions: ["1.0.0"],
          model_id: "model-1",
          model_version: "2026-03-01",
          knowledge_item_ids: ["knowledge-1", "knowledge-2"],
          created_asset_ids: ["asset-1"],
          created_at: "2026-03-31T08:00:30.000Z",
        },
        knowledgeHitLogs: [
          {
            id: "hit-1",
            snapshot_id: "snapshot-1",
            knowledge_item_id: "knowledge-1",
            binding_rule_id: "rule-1",
            match_source: "binding_rule",
            match_reasons: ["Required by editing profile"],
            created_at: "2026-03-31T08:00:30.000Z",
          },
          {
            id: "hit-2",
            snapshot_id: "snapshot-1",
            knowledge_item_id: "knowledge-2",
            match_source_id: "knowledge-2",
            match_source: "dynamic_routing",
            match_reasons: ["Matched discussion terminology"],
            section: "discussion",
            created_at: "2026-03-31T08:00:30.000Z",
          },
        ],
        verificationEvidence: [
          {
            id: "evidence-1",
            kind: "url",
            label: "Editing browser QA",
            uri: "https://example.test/evidence/editing-browser-qa",
            created_at: "2026-03-31T08:00:50.000Z",
          },
          {
            id: "evidence-2",
            kind: "artifact",
            label: "Editing artifact evidence",
            artifact_asset_id: "asset-1",
            created_at: "2026-03-31T08:00:55.000Z",
          },
        ],
        unresolvedVerificationEvidenceIds: ["evidence-legacy-1"],
      }}
    />,
  );

  assert.match(html, /Execution Evidence/);
  assert.match(html, /snapshot-1/);
  assert.match(html, /model-1/);
  assert.match(html, /prompt-1/);
  assert.match(html, /Execution Outputs/);
  assert.match(html, /Execution evidence manuscript/);
  assert.match(html, /job-1/);
  assert.match(html, /editing-final\.docx/);
  assert.match(html, /Open Editing Workbench/);
  assert.match(html, /#editing\?manuscriptId=manuscript-1/);
  assert.match(html, /Download editing-final\.docx/);
  assert.match(html, /\/api\/v1\/document-assets\/asset-1\/download/);
  assert.match(html, /Required by editing profile/);
  assert.match(html, /Matched discussion terminology/);
  assert.match(html, /Editing browser QA/);
  assert.match(html, /https:\/\/example\.test\/evidence\/editing-browser-qa/);
  assert.match(html, /Editing artifact evidence/);
  assert.match(html, /\/api\/v1\/document-assets\/asset-1\/download/);
  assert.match(html, /evidence-legacy-1/);
});

test("agent execution evidence view renders a snapshot-pending state for running logs", () => {
  const html = renderToStaticMarkup(
    <AgentExecutionEvidenceView
      evidence={{
        log: {
          id: "log-running-1",
          manuscript_id: "manuscript-2",
          module: "screening",
          triggered_by: "dev.admin",
          runtime_id: "runtime-1",
          sandbox_profile_id: "sandbox-1",
          agent_profile_id: "agent-profile-1",
          runtime_binding_id: "binding-1",
          tool_permission_policy_id: "policy-1",
          knowledge_item_ids: [],
          verification_evidence_ids: [],
          status: "running",
          started_at: "2026-03-31T09:00:00.000Z",
        },
        manuscript: null,
        job: null,
        createdAssets: [],
        snapshot: null,
        knowledgeHitLogs: [],
        verificationEvidence: [],
        unresolvedVerificationEvidenceIds: [],
      }}
    />,
  );

  assert.match(html, /Execution Evidence/);
  assert.match(html, /Snapshot Pending/);
  assert.match(html, /still running or has not written a frozen snapshot/i);
});
