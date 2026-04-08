import { startTransition, useEffect, useState } from "react";
import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import {
  approveLearningCandidate,
  listPendingLearningReviewCandidates,
} from "../learning-review/learning-review-api.ts";
import {
  buildRuleAuthoringPrefillFromLearningCandidate,
  type RuleAuthoringPrefillFromLearningCandidate,
} from "../learning-review/learning-review-prefill.ts";
import {
  applyLearningReviewApprovalSuccess,
  createLearningReviewWorkbenchState,
  reconcileLearningReviewQueue,
  selectLearningReviewCandidate,
} from "../learning-review/learning-review-workbench-state.ts";
import type { LearningCandidateViewModel } from "../learning-review/types.ts";
import { RuleLearningActions } from "./rule-learning-actions.tsx";
import { RuleLearningDiffCard } from "./rule-learning-diff-card.tsx";

const defaultClient = createBrowserHttpClient();

export interface RuleLearningPaneProps {
  actorRole?: AuthRole;
  prefilledManuscriptId?: string;
  prefilledReviewedCaseSnapshotId?: string;
  initialCandidates?: readonly LearningCandidateViewModel[];
  initialSelectedCandidateId?: string;
  onConvertToRuleDraft: (prefill: RuleAuthoringPrefillFromLearningCandidate) => void;
}

export function RuleLearningPane({
  actorRole = "admin",
  prefilledManuscriptId,
  prefilledReviewedCaseSnapshotId,
  initialCandidates = [],
  initialSelectedCandidateId,
  onConvertToRuleDraft,
}: RuleLearningPaneProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [queueStatus, setQueueStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >(initialCandidates.length > 0 ? "ready" : "idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [approvedCandidate, setApprovedCandidate] =
    useState<LearningCandidateViewModel | null>(null);
  const [workbenchState, setWorkbenchState] = useState(() =>
    createLearningReviewWorkbenchState({
      queue: initialCandidates,
      activeCandidateId: initialSelectedCandidateId ?? null,
    }),
  );

  useEffect(() => {
    void loadCandidateQueue();
  }, []);

  const selectedCandidate = approvedCandidate ?? workbenchState.selectedCandidate;

  async function loadCandidateQueue() {
    setQueueStatus("loading");

    try {
      const response = await listPendingLearningReviewCandidates(defaultClient);
      startTransition(() => {
        setWorkbenchState((current) =>
          reconcileLearningReviewQueue(current, response.body),
        );
        setQueueStatus("ready");
      });
    } catch (error) {
      startTransition(() => {
        setQueueStatus("error");
        setErrorMessage(toErrorMessage(error));
      });
    }
  }

  function handleSelectCandidate(candidateId: string) {
    startTransition(() => {
      setApprovedCandidate(null);
      setWorkbenchState((current) => selectLearningReviewCandidate(current, candidateId));
      setStatusMessage(`Loaded candidate detail: ${candidateId}`);
      setErrorMessage(null);
    });
  }

  async function handleApproveCandidate() {
    if (!workbenchState.selectedCandidate) {
      setErrorMessage("Select a pending rule candidate before approval.");
      return;
    }

    await runBusyTask(async () => {
      const response = await approveLearningCandidate(defaultClient, {
        candidateId: workbenchState.selectedCandidate!.id,
        actorRole,
      });

      startTransition(() => {
        setApprovedCandidate(response.body);
        setWorkbenchState((current) =>
          applyLearningReviewApprovalSuccess(current, response.body.id),
        );
        setStatusMessage(`Learning candidate approved: ${response.body.id}`);
      });
    });
  }

  function handleConvertSelectedCandidateToRuleDraft() {
    if (!selectedCandidate || selectedCandidate.status !== "approved") {
      setErrorMessage("Approve the candidate before opening a governed rule draft handoff.");
      return;
    }

    onConvertToRuleDraft(
      buildRuleAuthoringPrefillFromLearningCandidate(selectedCandidate, {
        reviewedCaseSnapshotId: prefilledReviewedCaseSnapshotId,
      }),
    );
    setStatusMessage(`Rule draft handoff prepared from ${selectedCandidate.id}.`);
    setErrorMessage(null);
  }

  function handleRejectCandidate() {
    setErrorMessage("Governed reject API has not been wired into the rule center yet.");
  }

  function handleConvertToKnowledgeExplanation() {
    setErrorMessage(
      "Knowledge-only conversion still runs through the governed writeback flow.",
    );
  }

  async function runBusyTask(task: () => Promise<void>) {
    setIsBusy(true);
    setErrorMessage(null);

    try {
      await task();
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="template-governance-learning-shell">
      {(statusMessage || errorMessage) && (
        <p
          className={errorMessage ? "template-governance-error" : "template-governance-status"}
          role="status"
        >
          {errorMessage ?? statusMessage}
        </p>
      )}

      {prefilledManuscriptId ? (
        <p className="template-governance-context-note">
          This rule-learning desk was opened from manuscript handoff {prefilledManuscriptId}.
        </p>
      ) : null}

      <div className="template-governance-rule-layout">
        <article className="template-governance-card">
          <div className="template-governance-panel-header">
            <div>
              <h3>Pending Rule Candidates</h3>
              <p>Review AI-discovered rule candidates before turning them into governed drafts.</p>
            </div>
            <button type="button" disabled={isBusy} onClick={() => void loadCandidateQueue()}>
              Refresh Queue
            </button>
          </div>

          {queueStatus === "loading" && workbenchState.queue.length === 0 ? (
            <p className="template-governance-empty">Loading pending rule candidates...</p>
          ) : queueStatus === "error" && workbenchState.queue.length === 0 ? (
            <p className="template-governance-empty">Pending rule candidates could not be loaded.</p>
          ) : workbenchState.queue.length === 0 ? (
            <p className="template-governance-empty">No pending rule candidates right now.</p>
          ) : (
            <ul className="template-governance-list">
              {workbenchState.queue.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    className={`template-governance-list-button${
                      workbenchState.selectedCandidate?.id === candidate.id ? " is-active" : ""
                    }`}
                    disabled={isBusy}
                    onClick={() => handleSelectCandidate(candidate.id)}
                  >
                    <span>{candidate.title ?? candidate.id}</span>
                    <small>
                      {candidate.module} · {candidate.suggested_rule_object ?? candidate.type}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <div className="template-governance-rule-layout-main">
          <RuleLearningDiffCard candidate={selectedCandidate} />
          <RuleLearningActions
            candidate={selectedCandidate}
            isBusy={isBusy}
            onApproveCandidate={handleApproveCandidate}
            onConvertToRuleDraft={handleConvertSelectedCandidateToRuleDraft}
            onRejectCandidate={handleRejectCandidate}
            onConvertToKnowledgeExplanation={handleConvertToKnowledgeExplanation}
          />
        </div>
      </div>
    </section>
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown learning workbench error.";
}
