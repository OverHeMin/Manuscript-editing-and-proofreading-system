import { startTransition, useEffect, useState } from "react";
import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import {
  approveLearningCandidate,
  listPendingLearningReviewCandidates,
  rejectLearningCandidate,
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
  const [resolvedCandidate, setResolvedCandidate] =
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

  const selectedCandidate = resolvedCandidate ?? workbenchState.selectedCandidate;
  const pendingCount = workbenchState.queue.length;

  async function loadCandidateQueue() {
    setQueueStatus("loading");

    try {
      const response = await listPendingLearningReviewCandidates(defaultClient);
      startTransition(() => {
        setResolvedCandidate(null);
        setWorkbenchState((current) => reconcileLearningReviewQueue(current, response.body));
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
      setResolvedCandidate(null);
      setWorkbenchState((current) => selectLearningReviewCandidate(current, candidateId));
      setStatusMessage(`已切换到转规则候选：${candidateId}`);
      setErrorMessage(null);
    });
  }

  async function handleApproveCandidate() {
    if (!workbenchState.selectedCandidate) {
      setErrorMessage("请先从回流候选队列中选择一项。");
      return;
    }

    const candidateId = workbenchState.selectedCandidate.id;

    await runBusyTask(async () => {
      const response = await approveLearningCandidate(defaultClient, {
        candidateId,
        actorRole,
      });

      startTransition(() => {
        setResolvedCandidate(response.body);
        setWorkbenchState((current) =>
          applyLearningReviewApprovalSuccess(current, response.body.id),
        );
        setStatusMessage(`已审核通过回流候选：${response.body.id}`);
      });
    });
  }

  function handleConvertSelectedCandidateToRuleDraft() {
    if (!selectedCandidate || selectedCandidate.status !== "approved") {
      setErrorMessage("请先完成审核通过，再转成规则草稿。");
      return;
    }

    onConvertToRuleDraft(
      buildRuleAuthoringPrefillFromLearningCandidate(selectedCandidate, {
        reviewedCaseSnapshotId: prefilledReviewedCaseSnapshotId,
      }),
    );
    setStatusMessage(`已根据 ${selectedCandidate.id} 打开规则草稿预填。`);
    setErrorMessage(null);
  }

  async function handleRejectCandidateRequest() {
    if (!workbenchState.selectedCandidate) {
      setErrorMessage("请先从回流候选队列中选择一项。");
      return;
    }

    const candidateId = workbenchState.selectedCandidate.id;

    await runBusyTask(async () => {
      const response = await rejectLearningCandidate(defaultClient, {
        candidateId,
        actorRole,
      });

      startTransition(() => {
        setResolvedCandidate(response.body);
        setWorkbenchState((current) =>
          applyLearningReviewApprovalSuccess(current, response.body.id),
        );
        setStatusMessage(`已驳回回流候选：${response.body.id}`);
      });
    });
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
    <section className="template-governance-recovery-shell">
      {(statusMessage || errorMessage) && (
        <p
          className={errorMessage ? "template-governance-error" : "template-governance-status"}
          role="status"
        >
          {errorMessage ?? statusMessage}
        </p>
      )}

      {prefilledManuscriptId || prefilledReviewedCaseSnapshotId ? (
        <p className="template-governance-context-note">
          {prefilledManuscriptId ? `回流来源稿件：${prefilledManuscriptId}` : "回流来源稿件待补充"}
          {prefilledReviewedCaseSnapshotId
            ? ` · 复核快照：${prefilledReviewedCaseSnapshotId}`
            : ""}
        </p>
      ) : null}

      <div className="template-governance-recovery-layout">
        <article className="template-governance-card template-governance-recovery-queue">
          <div className="template-governance-panel-header">
            <div>
              <h3>回流候选</h3>
              <p>先看证据与差异，完成审核结论后再转成规则草稿。</p>
            </div>

            <div className="template-governance-chip-row">
              <span className="template-governance-chip template-governance-chip-secondary">
                待处理 {pendingCount}
              </span>
              <button type="button" disabled={isBusy} onClick={() => void loadCandidateQueue()}>
                刷新候选
              </button>
            </div>
          </div>

          {queueStatus === "loading" && workbenchState.queue.length === 0 ? (
            <p className="template-governance-empty">正在加载回流候选...</p>
          ) : queueStatus === "error" && workbenchState.queue.length === 0 ? (
            <p className="template-governance-empty">回流候选加载失败。</p>
          ) : workbenchState.queue.length === 0 ? (
            <p className="template-governance-empty">当前没有待处理的回流候选。</p>
          ) : (
            <ul className="template-governance-list">
              {workbenchState.queue.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    className={`template-governance-list-button${
                      selectedCandidate?.id === candidate.id ? " is-active" : ""
                    }`}
                    disabled={isBusy}
                    onClick={() => handleSelectCandidate(candidate.id)}
                  >
                    <span>{candidate.title ?? candidate.id}</span>
                    <small>
                      {formatLearningModule(candidate.module)} ·{" "}
                      {formatLearningManuscriptType(candidate.manuscript_type)}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <div className="template-governance-recovery-main">
          <RuleLearningDiffCard candidate={selectedCandidate} />
          <RuleLearningActions
            candidate={selectedCandidate}
            isBusy={isBusy}
            onApproveCandidate={handleApproveCandidate}
            onConvertToRuleDraft={handleConvertSelectedCandidateToRuleDraft}
            onRejectCandidate={handleRejectCandidateRequest}
          />
        </div>
      </div>
    </section>
  );
}

function formatLearningModule(value: string): string {
  switch (value) {
    case "screening":
      return "初筛";
    case "editing":
      return "编辑";
    case "proofreading":
      return "校对";
    case "learning":
      return "学习改写";
    default:
      return value;
  }
}

function formatLearningManuscriptType(value: string): string {
  switch (value) {
    case "clinical_study":
      return "临床研究";
    case "systematic_review":
      return "系统综述";
    case "meta_analysis":
      return "Meta 分析";
    case "case_report":
      return "病例报告";
    case "guideline_interpretation":
      return "指南解读";
    case "expert_consensus":
      return "专家共识";
    case "diagnostic_study":
      return "诊断研究";
    case "basic_research":
      return "基础研究";
    case "nursing_study":
      return "护理研究";
    case "methodology_paper":
      return "方法学论文";
    case "brief_report":
      return "简报";
    case "other":
      return "其他";
    case "review":
    default:
      return "综述";
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "转规则站发生未知错误。";
}
