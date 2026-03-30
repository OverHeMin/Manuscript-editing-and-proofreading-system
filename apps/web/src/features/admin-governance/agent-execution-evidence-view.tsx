import type { AdminGovernanceExecutionEvidence } from "./admin-governance-controller.ts";

export interface AgentExecutionEvidenceViewProps {
  evidence: AdminGovernanceExecutionEvidence;
}

export function AgentExecutionEvidenceView({
  evidence,
}: AgentExecutionEvidenceViewProps) {
  const { log, snapshot, knowledgeHitLogs } = evidence;

  return (
    <section className="admin-governance-evidence" aria-label="Execution evidence">
      <header className="admin-governance-evidence-header">
        <div>
          <h4>Execution Evidence</h4>
          <p>
            Log <code>{log.id}</code> / module <code>{log.module}</code> / status{" "}
            <code>{log.status}</code>
          </p>
        </div>
        <div className="admin-governance-template-actions">
          <span className="admin-governance-badge">{log.status}</span>
          <small>{log.started_at}</small>
        </div>
      </header>

      <div className="admin-governance-resolution-grid">
        <article className="admin-governance-asset-row">
          <span>Manuscript</span>
          <small>{log.manuscript_id}</small>
        </article>
        <article className="admin-governance-asset-row">
          <span>Runtime</span>
          <small>{log.runtime_id}</small>
        </article>
        <article className="admin-governance-asset-row">
          <span>Binding</span>
          <small>{log.runtime_binding_id}</small>
        </article>
        <article className="admin-governance-asset-row">
          <span>Sandbox</span>
          <small>{log.sandbox_profile_id}</small>
        </article>
        <article className="admin-governance-asset-row">
          <span>Agent Profile</span>
          <small>{log.agent_profile_id}</small>
        </article>
        <article className="admin-governance-asset-row">
          <span>Tool Policy</span>
          <small>{log.tool_permission_policy_id}</small>
        </article>
      </div>

      {snapshot ? (
        <>
          <div className="admin-governance-resolution-grid">
            <article className="admin-governance-asset-row">
              <span>Snapshot</span>
              <small>{snapshot.id}</small>
            </article>
            <article className="admin-governance-asset-row">
              <span>Execution Profile</span>
              <small>{snapshot.execution_profile_id}</small>
            </article>
            <article className="admin-governance-asset-row">
              <span>Template</span>
              <small>
                {snapshot.module_template_id} / v{snapshot.module_template_version_no}
              </small>
            </article>
            <article className="admin-governance-asset-row">
              <span>Prompt</span>
              <small>
                {snapshot.prompt_template_id} / {snapshot.prompt_template_version}
              </small>
            </article>
            <article className="admin-governance-asset-row">
              <span>Model</span>
              <small>
                {snapshot.model_id}
                {snapshot.model_version ? ` / ${snapshot.model_version}` : ""}
              </small>
            </article>
            <article className="admin-governance-asset-row">
              <span>Created Assets</span>
              <small>{snapshot.created_asset_ids.join(", ") || "none"}</small>
            </article>
          </div>

          <article className="admin-governance-panel admin-governance-panel-tight">
            <h5>Knowledge Hit Reasons</h5>
            {knowledgeHitLogs.length > 0 ? (
              <ul className="admin-governance-list admin-governance-list-spaced">
                {knowledgeHitLogs.map((record) => (
                  <li key={record.id} className="admin-governance-template-row">
                    <div>
                      <strong>{record.knowledge_item_id}</strong>
                      <p>{record.match_reasons.join("; ")}</p>
                    </div>
                    <div className="admin-governance-template-actions">
                      <span className="admin-governance-badge">{record.match_source}</span>
                      <small>{record.section ?? record.binding_rule_id ?? record.match_source_id ?? "-"}</small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-governance-empty">
                Snapshot exists, but no knowledge-hit details were recorded for this run.
              </p>
            )}
          </article>
        </>
      ) : (
        <article className="admin-governance-panel admin-governance-panel-tight">
          <h5>Snapshot Pending</h5>
          <p className="admin-governance-empty">
            This execution is still running or has not written a frozen snapshot yet.
          </p>
        </article>
      )}

      <article className="admin-governance-panel admin-governance-panel-tight">
        <h5>Verification Evidence</h5>
        {log.verification_evidence_ids.length > 0 ? (
          <ul className="admin-governance-list">
            {log.verification_evidence_ids.map((evidenceId) => (
              <li key={evidenceId} className="admin-governance-asset-row">
                <span>{evidenceId}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-governance-empty">
            This execution has not recorded verification evidence IDs yet.
          </p>
        )}
      </article>
    </section>
  );
}
