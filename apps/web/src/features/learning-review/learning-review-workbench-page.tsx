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
          <p className="learning-review-eyebrow">Learning Review</p>
          <h2>Knowledge Handoff Bridge</h2>
          <p>
            The primary path stays review-first: select a pending governed candidate,
            approve it, and then bridge the approved result into a governed knowledge
            writeback draft.
          </p>
          <WorkbenchCoreStrip
            variant="supporting"
            activePillarId="knowledge"
            heading="协同与回写"
            description="让复核、批准与知识回写保持在同一条辅助链路中，但不遮住四个核心工作台。"
          />
          {prefillState === "loading" ? (
            <p>This review desk is loading manuscript handoff context.</p>
          ) : null}
          {prefillState === "ready" ? (
            <p>This review desk was prefilled from the manuscript workbench handoff.</p>
          ) : null}
          {prefillState === "error" ? (
            <p>Manuscript handoff prefill could not be loaded automatically.</p>
          ) : null}
        </div>
        <dl className="learning-review-meta">
          <div>
            <dt>Role</dt>
            <dd>{actorRole}</dd>
          </div>
          <div>
            <dt>Approval target</dt>
            <dd>{approvalCandidate?.id ?? "Select from queue"}</dd>
          </div>
          <div>
            <dt>Writeback handoff</dt>
            <dd>{writebackCandidate?.id ?? "Approve a candidate first"}</dd>
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

      <div className="learning-review-grid">
        <article className="learning-review-card learning-review-card--queue">
          <div className="learning-review-section-heading">
            <div>
              <h3>Pending Review Queue</h3>
              <p>Current governed candidates waiting for reviewer approval.</p>
            </div>
            <button type="button" onClick={() => void loadCandidateQueue()} disabled={isBusy}>
              Refresh queue
            </button>
          </div>
          {queueStatus === "loading" && candidateQueue.length === 0 ? (
            <p className="learning-review-empty">Loading learning candidates...</p>
          ) : queueStatus === "error" ? (
            <p className="learning-review-empty">Candidate queue failed to load.</p>
          ) : candidateQueue.length === 0 ? (
            <p className="learning-review-empty">No pending learning candidates right now.</p>
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
                    <span>{candidate.type}</span>
                    <span>{candidate.module}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="learning-review-card">
          <h3>Selected Candidate</h3>
          {selectedCandidate ? (
            <div className="learning-review-detail-grid">
              <div>
                <span className="learning-review-detail-label">ID</span>
                <code>{selectedCandidate.id}</code>
              </div>
              <div>
                <span className="learning-review-detail-label">Status</span>
                <span>{selectedCandidate.status}</span>
              </div>
              <div>
                <span className="learning-review-detail-label">Type</span>
                <span>{selectedCandidate.type}</span>
              </div>
              <div>
                <span className="learning-review-detail-label">Module</span>
                <span>{selectedCandidate.module}</span>
              </div>
              <div>
                <span className="learning-review-detail-label">Manuscript Type</span>
                <span>{selectedCandidate.manuscript_type}</span>
              </div>
              <div>
                <span className="learning-review-detail-label">Provenance</span>
                <span>{selectedCandidate.governed_provenance_kind ?? "not linked"}</span>
              </div>
              <div className="learning-review-detail-block">
                <span className="learning-review-detail-label">Title</span>
                <strong>{selectedCandidate.title ?? "Untitled candidate"}</strong>
              </div>
              <div className="learning-review-detail-block">
                <span className="learning-review-detail-label">Proposal</span>
                <p>{selectedCandidate.proposal_text ?? "No proposal text provided."}</p>
              </div>
              {selectedCandidate.writeback_summaries?.length ? (
                <div className="learning-review-detail-block">
                  <span className="learning-review-detail-label">Writeback summaries</span>
                  <ul className="learning-review-inline-list">
                    {selectedCandidate.writeback_summaries.map((record) => (
                      <li key={record.id}>
                        <strong>{record.id}</strong>
                        <span>{record.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="learning-review-empty">
              Select a pending candidate to inspect the governed review context.
            </p>
          )}
        </article>

        <article className="learning-review-card">
          <h3>Review Decision</h3>
          <p>The approval action always uses the candidate currently selected in the queue.</p>
          {approvalCandidate ? (
            <ResultBlock title="Approval target">
              <code>{approvalCandidate.id}</code>
              <span>{approvalCandidate.type}</span>
              <span>{approvalCandidate.module}</span>
            </ResultBlock>
          ) : (
            <p className="learning-review-empty">
              Select a pending candidate from the queue before approval.
            </p>
          )}
          <button type="button" onClick={handleApproveCandidate} disabled={isBusy || !approvalCandidate}>
            Approve selected candidate
          </button>
          {approvedCandidate && (
            <ResultBlock title="Latest approved handoff">
              <code>{approvedCandidate.id}</code>
              <span>{approvedCandidate.status}</span>
            </ResultBlock>
          )}
        </article>

        <article className="learning-review-card">
          <h3>Writeback Handoff</h3>
          <p>
            Knowledge writeback actions attach to the approved handoff candidate from this review
            session.
          </p>
          {writebackCandidate ? (
            <ResultBlock title="Active handoff candidate">
              <code>{writebackCandidate.id}</code>
              <span>knowledge_item</span>
              <span>{writebackCandidate.status}</span>
            </ResultBlock>
          ) : (
            <p className="learning-review-empty">
              Approve a candidate first, then load or create a writeback draft.
            </p>
          )}
          <div className="learning-review-button-row">
            <button type="button" onClick={handleListWritebacks} disabled={isBusy || !writebackCandidate}>
              Load writebacks
            </button>
            <button
              type="button"
              onClick={handleCreateWriteback}
              disabled={isBusy || actorRole !== "admin" || !writebackCandidate}
            >
              Create writeback
            </button>
          </div>
          {activeDraftWritebackId ? (
            <ResultBlock title="Active draft writeback">
              <code>{activeDraftWritebackId}</code>
              <span>Ready for apply</span>
            </ResultBlock>
          ) : null}
          {latestKnowledgeDraftId ? (
            <ResultBlock title="Knowledge draft handoff">
              <code>{latestKnowledgeDraftId}</code>
              <span>
                {submittedKnowledgeRevisionId.length > 0
                  ? "Pending review in governed queue"
                  : submittedKnowledgeItemId.length > 0
                    ? "Submitted; continue in Knowledge Library"
                    : "Draft ready for review submission"}
              </span>
            </ResultBlock>
          ) : null}
          <label>
            Knowledge Title
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
            Canonical Text
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
            Apply writeback
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
              Submit Knowledge Draft For Review
            </button>
            {knowledgeReviewHandoffHash ? (
              <a href={knowledgeReviewHandoffHash}>
                {submittedKnowledgeRevisionId.length > 0
                  ? "Open Knowledge Review"
                  : "Open Knowledge Library"}
              </a>
            ) : null}
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
          <span className="learning-review-utility-eyebrow">Secondary Admin Zone</span>
          <strong>Admin utilities and candidate generation</strong>
        </summary>
        <div className="learning-review-grid learning-review-grid--utilities">
          <article className="learning-review-card">
            <h3>1. Reviewed Case Snapshot</h3>
            <p>Start from the reviewed human-final manuscript asset.</p>
            <label>
              Manuscript ID
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
              Module
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
                    {module}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Manuscript Type
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
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Human Final Asset ID
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
              Create snapshot
            </button>
            {snapshotResult && (
              <ResultBlock title="Latest snapshot">
                <code>{snapshotResult.id}</code>
                <span>{snapshotResult.snapshot_asset_id}</span>
              </ResultBlock>
            )}
          </article>

          <article className="learning-review-card">
            <h3>2. Governed Learning Candidate</h3>
            <p>Create a candidate that already carries governed provenance.</p>
            <label>
              Snapshot ID
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
              Candidate Type
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
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
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
              Proposal
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
              Evaluation Run ID
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
              Create governed candidate
            </button>
            {candidateResult && (
              <ResultBlock title="Latest candidate">
                <code>{candidateResult.id}</code>
                <span>{candidateResult.status}</span>
              </ResultBlock>
            )}
          </article>
        </div>
      </details>

      <article className="learning-review-card">
        <h3>Writeback Timeline</h3>
        {writebacks.length === 0 ? (
          <p className="learning-review-empty">
            {writebackCandidate
              ? "No writeback records loaded yet. Create or load one for the approved handoff."
              : "Approve a candidate to start the writeback timeline."}
          </p>
        ) : (
          <ul className="learning-review-writeback-list">
            {writebacks.map((record) => (
              <li key={record.id}>
                <strong>{record.id}</strong>
                <span>{record.target_type}</span>
                <span>{record.status}</span>
                <span>{record.created_draft_asset_id ?? "draft pending"}</span>
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
