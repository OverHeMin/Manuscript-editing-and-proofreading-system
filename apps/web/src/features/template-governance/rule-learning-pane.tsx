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
  const [queueStatus, setQueueStatus] = useState<"idle" | "loading" | "ready" | "error">(
    initialCandidates.length > 0 ? "ready" : "idle",
  );
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
      setStatusMessage(`已载入候选详情：${candidateId}`);
      setErrorMessage(null);
    });
  }

  async function handleApproveCandidate() {
    if (!workbenchState.selectedCandidate) {
      setErrorMessage("请先从队列中选择一个待处理规则候选。");
      return;
    }

    const candidateId = workbenchState.selectedCandidate.id;

    await runBusyTask(async () => {
      const response = await approveLearningCandidate(defaultClient, {
        candidateId,
        actorRole,
      });

      startTransition(() => {
        setApprovedCandidate(response.body);
        setWorkbenchState((current) =>
          applyLearningReviewApprovalSuccess(current, response.body.id),
        );
        setStatusMessage(`已批准候选：${response.body.id}`);
      });
    });
  }

  function handleConvertSelectedCandidateToRuleDraft() {
    if (!selectedCandidate || selectedCandidate.status !== "approved") {
      setErrorMessage("请先批准候选，再转成规则草稿。");
      return;
    }

    onConvertToRuleDraft(
      buildRuleAuthoringPrefillFromLearningCandidate(selectedCandidate, {
        reviewedCaseSnapshotId: prefilledReviewedCaseSnapshotId,
      }),
    );
    setStatusMessage(`已根据 ${selectedCandidate.id} 生成规则草稿预填。`);
    setErrorMessage(null);
  }

  function handleRejectCandidate() {
    setErrorMessage("当前版本尚未接入候选驳回 API。");
  }

  function handleConvertToKnowledgeExplanation() {
    setErrorMessage("转成知识说明仍需通过质量回流与知识回写流程完成。");
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
          当前学习回流来自稿件交接：{prefilledManuscriptId}
        </p>
      ) : null}

      <div className="template-governance-rule-layout">
        <article className="template-governance-card">
          <div className="template-governance-panel-header">
            <div>
              <h3>规则候选队列</h3>
              <p>先复核 AI 提炼出的规则候选，再决定是否进入受控规则草稿。</p>
            </div>
            <button type="button" disabled={isBusy} onClick={() => void loadCandidateQueue()}>
              刷新队列
            </button>
          </div>

          {queueStatus === "loading" && workbenchState.queue.length === 0 ? (
            <p className="template-governance-empty">正在加载规则候选...</p>
          ) : queueStatus === "error" && workbenchState.queue.length === 0 ? (
            <p className="template-governance-empty">规则候选加载失败。</p>
          ) : workbenchState.queue.length === 0 ? (
            <p className="template-governance-empty">当前没有待处理规则候选。</p>
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
  return error instanceof Error ? error.message : "规则学习工作台发生未知错误。";
}
