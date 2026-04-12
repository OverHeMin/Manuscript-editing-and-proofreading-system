import { startTransition, useEffect, useState, type ReactNode } from "react";
import { WorkbenchCoreStrip } from "../../app/workbench-core-strip.tsx";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import { submitKnowledgeForReview } from "../knowledge/index.ts";
import {
  applyLearningWriteback,
  createLearningWriteback,
  listLearningWritebacksByCandidate,
  type ApplyLearningWritebackInput,
  type ApplyKnowledgeWritebackInput,
  type LearningWritebackViewModel,
} from "../learning-governance/index.ts";
import type { ManuscriptType, ManuscriptModule } from "../manuscripts/types.ts";
import {
  approveLearningCandidate,
  createGovernedLearningCandidate,
  createReviewedCaseSnapshot,
  listPendingLearningReviewCandidates,
} from "./learning-review-api.ts";
import {
  applyLearningReviewApprovalSuccess,
  createLearningReviewWorkbenchState,
  mergeLearningCandidateWritebackSummaries,
  reconcileLearningReviewQueue,
  resolveLearningReviewActionTargets,
  resolveLearningReviewActiveDraftWritebackId,
  selectLearningReviewCandidate,
} from "./learning-review-workbench-state.ts";
import { loadLearningReviewPrefill } from "./learning-review-prefill.ts";
import type {
  CreateGovernedLearningCandidateInput,
  CreateReviewedCaseSnapshotInput,
  LearningCandidateType,
  LearningCandidateViewModel,
  ReviewedCaseSnapshotViewModel,
} from "./types.ts";

if (typeof document !== "undefined") {
  void import("./learning-review-workbench.css");
}

export interface LearningReviewWorkbenchPageProps {
  actorRole?: AuthRole;
  prefilledManuscriptId?: string;
}

const defaultClient = createBrowserHttpClient();
const manuscriptTypes: ManuscriptType[] = [
  "clinical_study",
  "review",
  "systematic_review",
  "meta_analysis",
  "case_report",
  "guideline_interpretation",
  "expert_consensus",
  "diagnostic_study",
  "basic_research",
  "nursing_study",
  "methodology_paper",
  "brief_report",
  "other",
];
const manuscriptModules: ManuscriptModule[] = [
  "screening",
  "editing",
  "proofreading",
];
const candidateTypes: LearningCandidateType[] = [
  "rule_candidate",
  "case_pattern_candidate",
  "template_update_candidate",
  "prompt_optimization_candidate",
  "checklist_update_candidate",
  "skill_update_candidate",
];
type KnowledgeWritebackFormState = Omit<
  ApplyKnowledgeWritebackInput,
  "actorRole" | "writebackId"
>;

export function LearningReviewWorkbenchPage({
  actorRole = "knowledge_reviewer",
  prefilledManuscriptId,
}: LearningReviewWorkbenchPageProps) {
  const normalizedPrefilledManuscriptId = prefilledManuscriptId?.trim() ?? "";
  const [snapshotForm, setSnapshotForm] = useState<CreateReviewedCaseSnapshotInput>({
    manuscriptId: "manuscript-demo-1",
    module: "editing",
    manuscriptType: "clinical_study",
    humanFinalAssetId: "human-final-demo-1",
    deidentificationPassed: true,
    requestedBy: actorRole === "admin" ? "admin-1" : "reviewer-1",
    storageKey: "learning/manuscript-demo-1/snapshot.bin",
  });
  const [candidateForm, setCandidateForm] =
    useState<CreateGovernedLearningCandidateInput>({
      snapshotId: "",
      type: "rule_candidate",
      title: "Terminology normalization candidate",
      proposalText: "Normalize endpoint terminology and statistics wording.",
      requestedBy: actorRole === "admin" ? "admin-1" : "reviewer-1",
      deidentificationPassed: true,
      governedSource: {
        sourceKind: "evaluation_experiment",
        reviewedCaseSnapshotId: "",
        evaluationRunId: "eval-demo-1",
        evidencePackId: "evidence-demo-1",
        sourceAssetId: "human-final-demo-1",
      },
    });
  const [createdWritebackId, setCreatedWritebackId] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [prefillState, setPrefillState] = useState<"idle" | "loading" | "ready" | "error">(
    normalizedPrefilledManuscriptId.length > 0 ? "loading" : "idle",
  );
  const [isUtilityPanelOpen, setIsUtilityPanelOpen] = useState(
    normalizedPrefilledManuscriptId.length > 0,
  );
  const [workbenchState, setWorkbenchState] = useState(() =>
    createLearningReviewWorkbenchState(),
  );
  const [queueStatus, setQueueStatus] =
    useState<"idle" | "loading" | "ready" | "error">("idle");
  const [snapshotResult, setSnapshotResult] =
    useState<ReviewedCaseSnapshotViewModel | null>(null);
  const [candidateResult, setCandidateResult] =
    useState<LearningCandidateViewModel | null>(null);
  const [approvedCandidate, setApprovedCandidate] =
    useState<LearningCandidateViewModel | null>(null);
  const [writebacks, setWritebacks] = useState<LearningWritebackViewModel[]>([]);
  const [submittedKnowledgeItemId, setSubmittedKnowledgeItemId] = useState("");
  const [submittedKnowledgeAssetId, setSubmittedKnowledgeAssetId] = useState("");
  const [submittedKnowledgeRevisionId, setSubmittedKnowledgeRevisionId] = useState("");
  const [knowledgeWritebackForm, setKnowledgeWritebackForm] =
    useState<KnowledgeWritebackFormState>({
      targetType: "knowledge_item",
      appliedBy: actorRole === "admin" ? "admin-1" : "reviewer-1",
      title: "Screening endpoint governance rule",
      canonicalText:
        "Clinical study submissions must disclose the primary endpoint and analysis method.",
      knowledgeKind: "rule",
      moduleScope: "screening",
      manuscriptTypes: ["clinical_study"],
      summary: "Promote reviewed endpoint governance from learning into knowledge review.",
      sections: ["methods"],
      riskTags: ["statistics"],
      disciplineTags: ["general"],
    });

  const candidateQueue = workbenchState.queue;
  const selectedCandidate = workbenchState.selectedCandidate;
  const actionTargets = resolveLearningReviewActionTargets({
    selectedCandidate,
    approvedCandidate,
  });
  const approvalCandidate = actionTargets.approvalCandidate;
  const writebackCandidate = actionTargets.writebackCandidate;
  const activeDraftWritebackId = resolveLearningReviewActiveDraftWritebackId(
    writebacks,
    createdWritebackId,
  );
  const latestKnowledgeDraftId = resolveLatestKnowledgeDraftId(writebacks);
  const knowledgeReviewHandoffHash =
    submittedKnowledgeRevisionId.length > 0
      ? formatWorkbenchHash("knowledge-review", {
          revisionId: submittedKnowledgeRevisionId,
        })
      : submittedKnowledgeAssetId.length > 0
        ? formatWorkbenchHash("knowledge-library", {
            assetId: submittedKnowledgeAssetId,
          })
        : submittedKnowledgeItemId.length > 0
          ? formatWorkbenchHash("knowledge-library")
          : null;
  const ruleCenterHandoffHash = formatWorkbenchHash("template-governance", {
    manuscriptId:
      normalizedPrefilledManuscriptId.length > 0
        ? normalizedPrefilledManuscriptId
        : undefined,
    ruleCenterMode: approvalCandidate ? "authoring" : "learning",
  });

  useEffect(() => {
    void loadCandidateQueue();
  }, []);

  useEffect(() => {
    setPrefillState(
      normalizedPrefilledManuscriptId.length > 0 ? "loading" : "idle",
    );
    if (normalizedPrefilledManuscriptId.length > 0) {
      setIsUtilityPanelOpen(true);
    }
  }, [normalizedPrefilledManuscriptId]);

  useEffect(() => {
    if (normalizedPrefilledManuscriptId.length === 0) {
      return;
    }

    let cancelled = false;
    void loadLearningReviewPrefill(defaultClient, {
      manuscriptId: normalizedPrefilledManuscriptId,
      actorRole,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSnapshotForm(result.snapshotForm);
          setCandidateForm(result.candidateForm);
          setPrefillState("ready");
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setPrefillState("error");
          setErrorMessage(toErrorMessage(error));
        });
      });

    return () => {
      cancelled = true;
    };
  }, [actorRole, normalizedPrefilledManuscriptId]);

  useEffect(() => {
    const candidateId = writebackCandidate?.id ?? "";
    startTransition(() => {
      setCreatedWritebackId("");
      setSubmittedKnowledgeItemId("");
      setSubmittedKnowledgeAssetId("");
      setSubmittedKnowledgeRevisionId("");
      setWritebacks([]);
    });
    if (candidateId.length === 0) {
      return;
    }

    let cancelled = false;
    void listLearningWritebacksByCandidate(defaultClient, candidateId)
      .then((response) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          syncWritebackSummaries(candidateId, response.body);
          setCreatedWritebackId(
            resolveLearningReviewActiveDraftWritebackId(response.body, "") ?? "",
          );
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setWritebacks([]);
          setCreatedWritebackId("");
        });
      });

    return () => {
      cancelled = true;
    };
  }, [writebackCandidate?.id]);

  async function loadCandidateQueue(input?: { selectedCandidateId?: string }) {
    setQueueStatus("loading");

    try {
      const response = await listPendingLearningReviewCandidates(defaultClient);
      const nextWorkbenchState = input?.selectedCandidateId
        ? createLearningReviewWorkbenchState({
            queue: response.body,
            activeCandidateId: input.selectedCandidateId,
          })
        : reconcileLearningReviewQueue(workbenchState, response.body);

      startTransition(() => {
        setWorkbenchState(nextWorkbenchState);
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
    const nextWorkbenchState = selectLearningReviewCandidate(
      workbenchState,
      candidateId,
    );

    setWorkbenchState(nextWorkbenchState);
    setStatusMessage(`Loaded candidate detail: ${candidateId}`);
  }

  async function handleCreateSnapshot() {
    await runBusyTask(async () => {
      const response = await createReviewedCaseSnapshot(defaultClient, snapshotForm);

      startTransition(() => {
        setSnapshotResult(response.body);
        setCandidateForm((current) => ({
          ...current,
          snapshotId: response.body.id,
          governedSource: {
            ...current.governedSource,
            reviewedCaseSnapshotId: response.body.id,
          },
        }));
        setStatusMessage(`Reviewed case snapshot created: ${response.body.id}`);
      });
    });
  }

  async function handleCreateGovernedCandidate() {
    await runBusyTask(async () => {
      const response = await createGovernedLearningCandidate(defaultClient, candidateForm);

      startTransition(() => {
        setCandidateResult(response.body);
        setApprovedCandidate(null);
        setCreatedWritebackId("");
        setSubmittedKnowledgeItemId("");
        setSubmittedKnowledgeAssetId("");
        setSubmittedKnowledgeRevisionId("");
        setWritebacks([]);
        setStatusMessage(`Governed learning candidate created: ${response.body.id}`);
      });
      await loadCandidateQueue({ selectedCandidateId: response.body.id });
    });
  }

  async function handleApproveCandidate() {
    if (!approvalCandidate) {
      setErrorMessage("Select a pending candidate before approval.");
      return;
    }

    await runBusyTask(async () => {
      const response = await approveLearningCandidate(defaultClient, {
        candidateId: approvalCandidate.id,
        actorRole,
      });

      startTransition(() => {
        setApprovedCandidate(response.body);
        setCreatedWritebackId("");
        setSubmittedKnowledgeItemId("");
        setSubmittedKnowledgeAssetId("");
        setSubmittedKnowledgeRevisionId("");
        setStatusMessage(`Learning candidate approved: ${response.body.id}`);
      });
      const nextWorkbenchState = applyLearningReviewApprovalSuccess(
        workbenchState,
        response.body.id,
      );

      startTransition(() => {
        setWorkbenchState(nextWorkbenchState);
      });
      await loadCandidateQueue({
        selectedCandidateId: nextWorkbenchState.activeCandidateId ?? undefined,
      });
    });
  }

  async function handleListWritebacks() {
    if (!writebackCandidate) {
      setErrorMessage("Approve a candidate before loading writebacks.");
      return;
    }

    await runBusyTask(async () => {
      const response = await listLearningWritebacksByCandidate(
        defaultClient,
        writebackCandidate.id,
      );

      startTransition(() => {
        syncWritebackSummaries(writebackCandidate.id, response.body);
        setCreatedWritebackId(
          resolveLearningReviewActiveDraftWritebackId(response.body, createdWritebackId) ?? "",
        );
        setStatusMessage(
          response.body.length > 0
            ? `Loaded ${response.body.length} writeback record(s).`
            : "No writeback records found for this candidate.",
        );
      });
    });
  }

  async function handleCreateWriteback() {
    if (actorRole !== "admin") {
      setErrorMessage("Only admin can create governed writebacks.");
      return;
    }

    if (!writebackCandidate) {
      setErrorMessage("Approve a candidate before creating a writeback.");
      return;
    }

    await runBusyTask(async () => {
      const response = await createLearningWriteback(defaultClient, {
        actorRole,
        learningCandidateId: writebackCandidate.id,
        targetType: "knowledge_item",
        createdBy: "admin-1",
      });

      startTransition(() => {
        setCreatedWritebackId(response.body.id);
        setSubmittedKnowledgeItemId("");
        setSubmittedKnowledgeAssetId("");
        setSubmittedKnowledgeRevisionId("");
        syncWritebackSummaries(writebackCandidate.id, [...writebacks, response.body]);
        setStatusMessage(`Draft writeback created: ${response.body.id}`);
      });
    });
  }

  async function handleApplyWriteback() {
    if (actorRole !== "admin") {
      setErrorMessage("Only admin can apply governed writebacks.");
      return;
    }

    if (!writebackCandidate) {
      setErrorMessage("Approve a candidate before applying a writeback.");
      return;
    }

    if (!activeDraftWritebackId) {
      setErrorMessage("Create or load a draft writeback before apply.");
      return;
    }

    await runBusyTask(async () => {
      const response = await applyLearningWriteback(defaultClient, {
        actorRole,
        writebackId: activeDraftWritebackId,
        ...knowledgeWritebackForm,
      } satisfies ApplyLearningWritebackInput);

      startTransition(() => {
        syncWritebackSummaries(
          writebackCandidate.id,
          writebacks.map((record) =>
            record.id === response.body.id ? response.body : record,
          ),
        );
        setCreatedWritebackId("");
        setSubmittedKnowledgeItemId("");
        setSubmittedKnowledgeAssetId("");
        setSubmittedKnowledgeRevisionId("");
        setStatusMessage(`Writeback applied into governed draft: ${response.body.id}`);
      });
    });
  }

  async function handleSubmitKnowledgeDraftForReview() {
    if (actorRole !== "admin") {
      setErrorMessage("Only admin can submit governed knowledge drafts for review.");
      return;
    }

    if (!latestKnowledgeDraftId) {
      setErrorMessage("Apply a governed knowledge writeback before submitting it for review.");
      return;
    }

    await runBusyTask(async () => {
      const response = await submitKnowledgeForReview(defaultClient, latestKnowledgeDraftId);

      startTransition(() => {
        setSubmittedKnowledgeItemId(response.body.id);
        setSubmittedKnowledgeAssetId(response.body.asset_id ?? "");
        setSubmittedKnowledgeRevisionId(response.body.revision_id ?? "");
        setStatusMessage(`Knowledge draft submitted for review: ${response.body.id}`);
      });
    });
  }

  async function runBusyTask(
    task: () => Promise<void>,
    options: { resetMessages?: boolean } = {},
  ) {
    setIsBusy(true);
    if (options.resetMessages ?? true) {
      setErrorMessage(null);
      setStatusMessage(null);
    }

    try {
      await task();
    } catch (error) {
      startTransition(() => {
        setErrorMessage(toErrorMessage(error));
      });
    } finally {
      setIsBusy(false);
    }
  }

  function syncWritebackSummaries(
    candidateId: string,
    nextWritebacks: LearningWritebackViewModel[],
  ) {
    setWritebacks(nextWritebacks);
    setApprovedCandidate((current) =>
      current?.id === candidateId
        ? mergeLearningCandidateWritebackSummaries(current, nextWritebacks)
        : current,
    );
    setCandidateResult((current) =>
      current?.id === candidateId
        ? mergeLearningCandidateWritebackSummaries(current, nextWritebacks)
        : current,
    );
    setWorkbenchState((current) => {
      if (current.selectedCandidate?.id !== candidateId) {
        return current;
      }

      const mergedCandidate = mergeLearningCandidateWritebackSummaries(
        current.selectedCandidate,
        nextWritebacks,
      );

      return {
        ...current,
        selectedCandidate: mergedCandidate,
        queue: current.queue.map((candidate) =>
          candidate.id === candidateId ? mergedCandidate : candidate,
        ),
      };
    });
  }

  return (
    <section className="learning-review-workbench">
      <header className="learning-review-hero">
        <div className="learning-review-hero-copy">
          <p className="learning-review-eyebrow">质量优化</p>
          <h2>质量优化</h2>
          <p>
            把 AI 不确定点、人工修正与回流动作集中到同一张工作台里，常用去向是送入知识库或送入规则中心。
          </p>
          <WorkbenchCoreStrip
            variant="supporting"
            activePillarId="knowledge"
            heading="协同与回写"
            description="让复核、批准与知识回写保持在同一条辅助链路中，但不遮住四个核心工作台。"
          />
          {prefillState === "loading" ? (
            <p>正在加载稿件回流上下文。</p>
          ) : null}
          {prefillState === "ready" ? (
            <p>已根据稿件链路自动带入本次质量优化的预填信息。</p>
          ) : null}
          {prefillState === "error" ? (
            <p>稿件回流预填失败，请在下方辅助工具中手动补齐。</p>
          ) : null}
        </div>
        <dl className="learning-review-meta">
          <div>
            <dt>当前角色</dt>
            <dd>{formatActorRoleLabel(actorRole)}</dd>
          </div>
          <div>
            <dt>待批案例</dt>
            <dd>{approvalCandidate?.id ?? "从队列选择"}</dd>
          </div>
          <div>
            <dt>当前回流</dt>
            <dd>{writebackCandidate?.id ?? "先批准案例"}</dd>
          </div>
        </dl>
      </header>

      {(statusMessage || errorMessage) && (
        <section
          className={`learning-review-banner${errorMessage ? " is-error" : " is-success"}`}
          role="status"
        >
          {errorMessage ?? statusMessage}
        </section>
      )}

      <div className="learning-review-grid learning-review-grid--main">
        <article className="learning-review-card learning-review-card--queue">
          <div className="learning-review-section-heading">
            <div>
              <h3>待处理队列</h3>
              <p>优先处理 AI 不确定点和高价值回流，保持复核动作短路径完成。</p>
            </div>
            <button type="button" onClick={() => void loadCandidateQueue()} disabled={isBusy}>
              刷新队列
            </button>
          </div>
          {queueStatus === "loading" && candidateQueue.length === 0 ? (
            <p className="learning-review-empty">正在加载待处理案例。</p>
          ) : queueStatus === "error" ? (
            <p className="learning-review-empty">待处理队列加载失败。</p>
          ) : candidateQueue.length === 0 ? (
            <p className="learning-review-empty">当前没有待处理案例。</p>
          ) : (
            <ul className="learning-review-candidate-list">
              {candidateQueue.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    className={`learning-review-candidate-button${
                      selectedCandidate?.id === candidate.id ? " is-active" : ""
                    }`}
                    onClick={() => void handleSelectCandidate(candidate.id)}
                    disabled={isBusy}
                  >
                    <strong>{candidate.title ?? candidate.id}</strong>
                    <span>{formatLearningCandidateTypeLabel(candidate.type)}</span>
                    <span>{formatModuleLabel(candidate.module)}</span>
                    <span>{formatLearningCandidateStatusLabel(candidate.status)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="learning-review-card">
          <h3>案例详情</h3>
          {selectedCandidate ? (
            <>
              <div className="learning-review-inline-list">
                <div className="learning-review-result">
                  <strong>AI 不确定点</strong>
                  <p>{selectedCandidate.proposal_text ?? "等待从案例中补充 AI 不确定点。"}</p>
                </div>
                <div className="learning-review-result">
                  <strong>人工修正</strong>
                  <p>
                    {approvedCandidate?.id === selectedCandidate.id
                      ? "该案例已完成人工确认，可继续沉淀为知识或规则。"
                      : "先完成人工确认，再决定是否沉淀到知识库或规则中心。"}
                  </p>
                </div>
              </div>
              <div className="learning-review-detail-grid">
                <div>
                  <span className="learning-review-detail-label">案例编号</span>
                  <code>{selectedCandidate.id}</code>
                </div>
                <div>
                  <span className="learning-review-detail-label">当前状态</span>
                  <span>{formatLearningCandidateStatusLabel(selectedCandidate.status)}</span>
                </div>
                <div>
                  <span className="learning-review-detail-label">候选类型</span>
                  <span>{formatLearningCandidateTypeLabel(selectedCandidate.type)}</span>
                </div>
                <div>
                  <span className="learning-review-detail-label">来源模块</span>
                  <span>{formatModuleLabel(selectedCandidate.module)}</span>
                </div>
                <div>
                  <span className="learning-review-detail-label">稿件类型</span>
                  <span>{formatManuscriptTypeLabel(selectedCandidate.manuscript_type)}</span>
                </div>
                <div>
                  <span className="learning-review-detail-label">来源链路</span>
                  <span>{selectedCandidate.governed_provenance_kind ?? "未关联"}</span>
                </div>
                <div className="learning-review-detail-block">
                  <span className="learning-review-detail-label">案例标题</span>
                  <strong>{selectedCandidate.title ?? "未命名案例"}</strong>
                </div>
                <div className="learning-review-detail-block">
                  <span className="learning-review-detail-label">问题描述</span>
                  <p>{selectedCandidate.proposal_text ?? "当前案例没有补充说明。"}</p>
                </div>
                {selectedCandidate.writeback_summaries?.length ? (
                  <div className="learning-review-detail-block">
                    <span className="learning-review-detail-label">已生成回流记录</span>
                    <ul className="learning-review-inline-list">
                      {selectedCandidate.writeback_summaries.map((record) => (
                        <li key={record.id}>
                          <strong>{record.id}</strong>
                          <span>{formatLearningCandidateStatusLabel(record.status)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <p className="learning-review-empty">先从左侧队列选择一个案例，再查看详情。</p>
          )}
        </article>

        <article className="learning-review-card">
          <h3>优化动作</h3>
          <p>审批、回流和跳转都收敛在这里，首屏只保留最常用的操作。</p>
          {approvalCandidate ? (
            <ResultBlock title="当前待批案例">
              <code>{approvalCandidate.id}</code>
              <span>{formatLearningCandidateTypeLabel(approvalCandidate.type)}</span>
              <span>{formatModuleLabel(approvalCandidate.module)}</span>
            </ResultBlock>
          ) : (
            <p className="learning-review-empty">先在待处理队列中选择案例后再执行优化动作。</p>
          )}
          <button type="button" onClick={handleApproveCandidate} disabled={isBusy || !approvalCandidate}>
            批准当前案例
          </button>
          {approvedCandidate && (
            <ResultBlock title="最新人工确认">
              <code>{approvedCandidate.id}</code>
              <span>{formatLearningCandidateStatusLabel(approvedCandidate.status)}</span>
            </ResultBlock>
          )}
        </article>

        <article className="learning-review-card">
          <h3>回流交接</h3>
          <p>
            知识回流动作会挂在当前已批准案例之下，方便继续送入知识库或送审。
          </p>
          {writebackCandidate ? (
            <ResultBlock title="当前回流案例">
              <code>{writebackCandidate.id}</code>
              <span>knowledge_item</span>
              <span>{formatLearningCandidateStatusLabel(writebackCandidate.status)}</span>
            </ResultBlock>
          ) : (
            <p className="learning-review-empty">先批准一个案例，再加载或新建回流草稿。</p>
          )}
          <div className="learning-review-button-row">
            <button type="button" onClick={handleListWritebacks} disabled={isBusy || !writebackCandidate}>
              加载回流草稿
            </button>
            <button
              type="button"
              onClick={handleCreateWriteback}
              disabled={isBusy || actorRole !== "admin" || !writebackCandidate}
            >
              新建回流草稿
            </button>
          </div>
          {activeDraftWritebackId ? (
            <ResultBlock title="当前回流草稿">
              <code>{activeDraftWritebackId}</code>
              <span>可继续送入知识库</span>
            </ResultBlock>
          ) : null}
          {latestKnowledgeDraftId ? (
            <ResultBlock title="知识稿状态">
              <code>{latestKnowledgeDraftId}</code>
              <span>
                {submittedKnowledgeRevisionId.length > 0
                  ? "已进入知识审核"
                  : submittedKnowledgeItemId.length > 0
                    ? "已提交，可继续在知识库跟进"
                    : "草稿已生成，待送审"}
              </span>
            </ResultBlock>
          ) : null}
          <label>
            知识标题
            <input
              value={knowledgeWritebackForm.title}
              onChange={(event) =>
                setKnowledgeWritebackForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </label>
          <label>
            规范文本
            <textarea
              value={knowledgeWritebackForm.canonicalText}
              onChange={(event) =>
                setKnowledgeWritebackForm((current) => ({
                  ...current,
                  canonicalText: event.target.value,
                }))
              }
            />
          </label>
          <button
            type="button"
            onClick={handleApplyWriteback}
            disabled={isBusy || actorRole !== "admin" || !activeDraftWritebackId}
          >
            送入知识库
          </button>
          <div className="learning-review-button-row">
            <button
              type="button"
              onClick={handleSubmitKnowledgeDraftForReview}
              disabled={
                isBusy ||
                actorRole !== "admin" ||
                !latestKnowledgeDraftId ||
                submittedKnowledgeItemId.length > 0
              }
            >
              提交知识稿送审
            </button>
            {knowledgeReviewHandoffHash ? (
              <a className="learning-review-link-button" href={knowledgeReviewHandoffHash}>
                {submittedKnowledgeRevisionId.length > 0
                  ? "打开知识审核"
                  : "打开知识库"}
              </a>
            ) : null}
            <a className="learning-review-link-button" href={ruleCenterHandoffHash}>
              送入规则中心
            </a>
          </div>
        </article>
      </div>

      <details
        className="learning-review-utility-panel"
        open={isUtilityPanelOpen}
        onToggle={(event) =>
          setIsUtilityPanelOpen((event.currentTarget as HTMLDetailsElement).open)
        }
      >
        <summary>
          <span className="learning-review-utility-eyebrow">高级入口</span>
          <strong>辅助工具与候选生成</strong>
        </summary>
        <div className="learning-review-grid learning-review-grid--utilities">
          <article className="learning-review-card">
            <h3>1. 复核案例快照</h3>
            <p>从已复核的人工作品中抽取案例快照，为后续质量优化保留证据链。</p>
            <label>
              稿件 ID
              <input
                value={snapshotForm.manuscriptId}
                onChange={(event) =>
                  setSnapshotForm((current) => ({
                    ...current,
                    manuscriptId: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              所属模块
              <select
                value={snapshotForm.module}
                onChange={(event) =>
                  setSnapshotForm((current) => ({
                    ...current,
                    module: event.target.value,
                  }))
                }
              >
                {manuscriptModules.map((module) => (
                  <option key={module} value={module}>
                    {formatModuleLabel(module)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              稿件类型
              <select
                value={snapshotForm.manuscriptType}
                onChange={(event) =>
                  setSnapshotForm((current) => ({
                    ...current,
                    manuscriptType: event.target.value,
                  }))
                }
              >
                {manuscriptTypes.map((type) => (
                  <option key={type} value={type}>
                    {formatManuscriptTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              人工终稿资产 ID
              <input
                value={snapshotForm.humanFinalAssetId}
                onChange={(event) =>
                  setSnapshotForm((current) => ({
                    ...current,
                    humanFinalAssetId: event.target.value,
                  }))
                }
              />
            </label>
            <button type="button" onClick={handleCreateSnapshot} disabled={isBusy}>
              创建快照
            </button>
            {snapshotResult && (
              <ResultBlock title="最新快照">
                <code>{snapshotResult.id}</code>
                <span>{snapshotResult.snapshot_asset_id}</span>
              </ResultBlock>
            )}
          </article>

          <article className="learning-review-card">
            <h3>2. 生成质量候选</h3>
            <p>生成可回流的规则候选或案例候选，供质量优化页面持续复用。</p>
            <label>
              快照 ID
              <input
                value={candidateForm.snapshotId}
                onChange={(event) =>
                  setCandidateForm((current) => ({
                    ...current,
                    snapshotId: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              候选类型
              <select
                value={candidateForm.type}
                onChange={(event) =>
                  setCandidateForm((current) => ({
                    ...current,
                    type: event.target.value as LearningCandidateType,
                  }))
                }
              >
                {candidateTypes.map((type) => (
                  <option key={type} value={type}>
                    {formatLearningCandidateTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              候选标题
              <input
                value={candidateForm.title ?? ""}
                onChange={(event) =>
                  setCandidateForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              问题描述
              <textarea
                value={candidateForm.proposalText ?? ""}
                onChange={(event) =>
                  setCandidateForm((current) => ({
                    ...current,
                    proposalText: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              评测运行 ID
              <input
                value={candidateForm.governedSource.evaluationRunId}
                onChange={(event) =>
                  setCandidateForm((current) => ({
                    ...current,
                    governedSource: {
                      ...current.governedSource,
                      evaluationRunId: event.target.value,
                    },
                  }))
                }
              />
            </label>
            <button type="button" onClick={handleCreateGovernedCandidate} disabled={isBusy}>
              生成候选
            </button>
            {candidateResult && (
              <ResultBlock title="最新候选">
                <code>{candidateResult.id}</code>
                <span>{formatLearningCandidateStatusLabel(candidateResult.status)}</span>
              </ResultBlock>
            )}
          </article>
        </div>
      </details>

      <article className="learning-review-card">
        <h3>回流时间线</h3>
        {writebacks.length === 0 ? (
          <p className="learning-review-empty">
            {writebackCandidate
              ? "当前还没有加载回流记录，可先新建或读取一份回流草稿。"
              : "先批准一个案例，回流时间线才会开始记录。"}
          </p>
        ) : (
          <ul className="learning-review-writeback-list">
            {writebacks.map((record) => (
              <li key={record.id}>
                <strong>{record.id}</strong>
                <span>{record.target_type}</span>
                <span>{formatLearningCandidateStatusLabel(record.status)}</span>
                <span>{record.created_draft_asset_id ?? "草稿待生成"}</span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}

interface ResultBlockProps {
  title: string;
  children: ReactNode;
}

function ResultBlock({ title, children }: ResultBlockProps) {
  return (
    <div className="learning-review-result">
      <strong>{title}</strong>
      <div>{children}</div>
    </div>
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown workbench error.";
}

function resolveLatestKnowledgeDraftId(
  writebacks: readonly LearningWritebackViewModel[],
): string | null {
  for (let index = writebacks.length - 1; index >= 0; index -= 1) {
    const record = writebacks[index];
    if (record?.target_type === "knowledge_item" && record.created_draft_asset_id) {
      return record.created_draft_asset_id;
    }
  }

  return null;
}

function formatActorRoleLabel(role: AuthRole): string {
  switch (role) {
    case "admin":
      return "管理员";
    case "screener":
      return "初筛员";
    case "editor":
      return "编辑";
    case "proofreader":
      return "校对员";
    case "knowledge_reviewer":
      return "知识审核员";
    case "user":
    default:
      return "普通用户";
  }
}

function formatModuleLabel(module: ManuscriptModule | string): string {
  switch (module) {
    case "screening":
      return "初筛";
    case "editing":
      return "编辑";
    case "proofreading":
      return "校对";
    default:
      return module;
  }
}

function formatLearningCandidateTypeLabel(type: LearningCandidateType | string): string {
  switch (type) {
    case "rule_candidate":
      return "规则候选";
    case "case_pattern_candidate":
      return "案例模式候选";
    case "template_update_candidate":
      return "模板更新候选";
    case "prompt_optimization_candidate":
      return "提示词优化候选";
    case "checklist_update_candidate":
      return "检查清单候选";
    case "skill_update_candidate":
      return "技能更新候选";
    default:
      return type;
  }
}

function formatLearningCandidateStatusLabel(status: string): string {
  switch (status) {
    case "pending_review":
      return "待复核";
    case "approved":
      return "已批准";
    case "rejected":
      return "已驳回";
    case "draft":
      return "草稿";
    case "submitted":
      return "已提交";
    case "active":
      return "生效中";
    default:
      return status;
  }
}

function formatManuscriptTypeLabel(type: ManuscriptType | string): string {
  switch (type) {
    case "clinical_study":
      return "临床研究";
    case "review":
      return "综述";
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
    default:
      return type;
  }
}
