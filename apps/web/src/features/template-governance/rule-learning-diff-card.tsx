import type { LearningCandidateViewModel } from "../learning-review/types.ts";
import {
  resolveLearningCandidateAfterFragment,
  resolveLearningCandidateBeforeFragment,
  resolveLearningCandidateEvidenceSummary,
  resolveLearningCandidateExtractionRationale,
  resolveLearningCandidateSelectorSummary,
} from "../learning-review/learning-review-workbench-state.ts";

export interface RuleLearningDiffCardProps {
  candidate: LearningCandidateViewModel | null;
}

export function RuleLearningDiffCard({ candidate }: RuleLearningDiffCardProps) {
  const beforeFragment = resolveLearningCandidateBeforeFragment(candidate);
  const afterFragment = resolveLearningCandidateAfterFragment(candidate);
  const evidenceSummary = resolveLearningCandidateEvidenceSummary(candidate);
  const extractionRationale = resolveLearningCandidateExtractionRationale(candidate);
  const selectorSummary = resolveLearningCandidateSelectorSummary(candidate);

  return (
    <article className="template-governance-card">
      <div className="template-governance-panel-header">
        <div>
          <h3>Rule Candidate Review</h3>
          <p>Inspect the extracted evidence before deciding whether it should become a governed rule.</p>
        </div>
      </div>

      {candidate ? (
        <div className="template-governance-stack">
          <div className="template-governance-detail-grid">
            <div>
              <span>Candidate</span>
              <strong>{candidate.title ?? candidate.id}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{candidate.status}</strong>
            </div>
            <div>
              <span>Module</span>
              <strong>{candidate.module}</strong>
            </div>
            <div>
              <span>Rule Object</span>
              <strong>{candidate.suggested_rule_object ?? "manual_review"}</strong>
            </div>
          </div>

          <div className="template-governance-detail-grid">
            <div>
              <span>Template Family</span>
              <p>{candidate.suggested_template_family_id ?? "not proposed"}</p>
            </div>
            <div>
              <span>Journal Template</span>
              <p>{candidate.suggested_journal_template_id ?? "base family scope"}</p>
            </div>
          </div>

          <div className="template-governance-detail-grid">
            <div>
              <span>Extraction Rationale</span>
              <p>{extractionRationale ?? "No extraction rationale provided."}</p>
            </div>
            <div>
              <span>Evidence Summary</span>
              <p>{evidenceSummary ?? "No evidence summary provided."}</p>
            </div>
          </div>

          <div className="template-governance-learning-diff-grid">
            <div className="template-governance-learning-fragment">
              <span>Before Fragment</span>
              <pre>{beforeFragment ?? "No before fragment."}</pre>
            </div>
            <div className="template-governance-learning-fragment">
              <span>After Fragment</span>
              <pre>{afterFragment ?? "No after fragment."}</pre>
            </div>
          </div>

          <div className="template-governance-learning-fragment">
            <span>Proposed Selector</span>
            <pre>{selectorSummary}</pre>
          </div>
        </div>
      ) : (
        <p className="template-governance-empty">
          Select a pending rule candidate to inspect its evidence and suggested context.
        </p>
      )}
    </article>
  );
}
