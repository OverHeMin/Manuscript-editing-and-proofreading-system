import type { FormEvent } from "react";
import type { ExtractionTaskCandidateViewModel } from "../editorial-rules/index.ts";
import type { TemplateGovernanceExtractionLedgerViewModel } from "./template-governance-controller.ts";
import {
  TemplateGovernanceCandidateConfirmationForm,
  type TemplateGovernanceCandidateConfirmationFormValues,
} from "./template-governance-candidate-confirmation-form.tsx";
import {
  createTemplateGovernanceNavigationItems,
  type TemplateGovernanceNavigationItem,
} from "./template-governance-navigation.ts";
import { TemplateGovernanceLedgerSearchPage } from "./template-governance-ledger-search-page.tsx";
import type { TemplateGovernanceLedgerSearchState } from "./template-governance-ledger-types.ts";
import {
  formatRulePackageKindLabel,
  formatTemplateGovernanceExtractionCandidateStatusLabel,
  formatTemplateGovernanceExtractionDestinationLabel,
  formatTemplateGovernanceExtractionTaskStatusLabel,
  formatTemplateGovernanceManuscriptTypeLabel,
} from "./template-governance-display.ts";
import {
  TemplateGovernanceExtractionTaskForm,
  type TemplateGovernanceExtractionTaskFormDraft,
} from "./template-governance-extraction-task-form.tsx";
import { TemplateGovernanceLedgerToolbar } from "./template-governance-ledger-toolbar.tsx";

export interface TemplateGovernanceExtractionLedgerPageProps {
  viewModel: TemplateGovernanceExtractionLedgerViewModel;
  selectedCandidateId?: string | null;
  searchState?: TemplateGovernanceLedgerSearchState;
  searchValue?: string;
  taskFormOpen?: boolean;
  taskDraft?: TemplateGovernanceExtractionTaskFormDraft;
  candidateFormOpen?: boolean;
  initialCandidateFormOpen?: boolean;
  candidateFormValues?: Partial<TemplateGovernanceCandidateConfirmationFormValues>;
  isBusy?: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  navigationItems?: readonly TemplateGovernanceNavigationItem[];
  onSearchValueChange?: (value: string) => void;
  onSearchSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  onSearchAction?: () => void;
  onOpenTaskForm?: () => void;
  onOpenCandidateForm?: () => void;
  onSelectTask?: (taskId: string) => void;
  onSelectCandidate?: (candidateId: string) => void;
  onTaskDraftChange?: (
    recipe: (
      current: TemplateGovernanceExtractionTaskFormDraft,
    ) => TemplateGovernanceExtractionTaskFormDraft,
  ) => void;
  onOriginalFileSelect?: (
    file: import("../manuscript-workbench/manuscript-upload-file.ts").BrowserUploadFile | null,
  ) => void;
  onEditedFileSelect?: (
    file: import("../manuscript-workbench/manuscript-upload-file.ts").BrowserUploadFile | null,
  ) => void;
  onTaskFormCancel?: () => void;
  onTaskFormSubmit?: () => void;
  onCandidateFormChange?: (
    recipe: (
      current: TemplateGovernanceCandidateConfirmationFormValues,
    ) => TemplateGovernanceCandidateConfirmationFormValues,
  ) => void;
  onCandidateFormCancel?: () => void;
  onCandidateHold?: () => void;
  onCandidateReject?: () => void;
  onCandidateConfirm?: () => void;
}

export function TemplateGovernanceExtractionLedgerPage({
  viewModel,
  selectedCandidateId = null,
  searchState = {
    mode: "idle",
    query: "",
    title: "",
    rows: [],
  },
  searchValue = "",
  taskFormOpen = false,
  taskDraft,
  candidateFormOpen = false,
  initialCandidateFormOpen = false,
  candidateFormValues,
  isBusy = false,
  statusMessage = null,
  errorMessage = null,
  navigationItems,
  onSearchValueChange,
  onSearchSubmit,
  onSearchAction,
  onOpenTaskForm,
  onOpenCandidateForm,
  onSelectTask,
  onSelectCandidate,
  onTaskDraftChange,
  onOriginalFileSelect,
  onEditedFileSelect,
  onTaskFormCancel,
  onTaskFormSubmit,
  onCandidateFormChange,
  onCandidateFormCancel,
  onCandidateHold,
  onCandidateReject,
  onCandidateConfirm,
}: TemplateGovernanceExtractionLedgerPageProps) {
  const selectedCandidate =
    resolveSelectedCandidate(viewModel.selectedTask?.candidates ?? [], selectedCandidateId) ??
    null;
  const isCandidateFormVisible = candidateFormOpen || initialCandidateFormOpen;

  return (
    <section className="template-governance-extraction-ledger-page">
      <TemplateGovernanceLedgerToolbar
        title="原稿/编辑稿提取台账"
        subtitle="通过任务表查看原稿与编辑稿提取结果，再在候选表里确认 AI 语义和最终去向。"
        navigationItems={
          navigationItems ??
          createTemplateGovernanceNavigationItems("extraction-ledger")
        }
        searchValue={searchValue}
        searchPlaceholder="搜索任务或候选"
        onSearchValueChange={onSearchValueChange}
        onSearchSubmit={onSearchSubmit}
        actions={
          <>
            <button type="button" onClick={onOpenTaskForm}>
              新建提取任务
            </button>
            <button type="button" onClick={onSearchAction}>
              搜索任务
            </button>
            <button type="button" onClick={onOpenCandidateForm}>
              批量处理
            </button>
          </>
        }
      />
      {statusMessage ? <p className="template-governance-status">{statusMessage}</p> : null}
      {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}

      <div className="template-governance-ledger-kpi-strip">
        <article className="template-governance-ledger-kpi">
          <span>任务数</span>
          <strong>{viewModel.summary.totalTaskCount}</strong>
        </article>
        <article className="template-governance-ledger-kpi">
          <span>候选总数</span>
          <strong>{viewModel.summary.candidateCount}</strong>
        </article>
        <article className="template-governance-ledger-kpi">
          <span>待确认数</span>
          <strong>{viewModel.summary.awaitingConfirmationCount}</strong>
        </article>
      </div>

      <div className="template-governance-ledger-grid">
        <article className="template-governance-card template-governance-ledger-section">
          <header className="template-governance-ledger-section-header">
            <h2>提取任务</h2>
            <p>按任务追踪每次原稿/编辑稿对比提取。</p>
          </header>
          <div className="template-governance-ledger-table-shell">
            <table className="template-governance-ledger-table">
              <thead>
                <tr>
                  <th>任务名称</th>
                  <th>稿件类型</th>
                  <th>候选数</th>
                  <th>待确认数</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {viewModel.tasks.length ? (
                  viewModel.tasks.map((task) => (
                    <tr
                      key={task.id}
                      className={
                        task.id === viewModel.selectedTaskId
                          ? "template-governance-ledger-row is-selected"
                          : "template-governance-ledger-row"
                      }
                    >
                      <td>
                        <button
                          type="button"
                          className="template-governance-ledger-row-button"
                          onClick={() => onSelectTask?.(task.id)}
                        >
                          {task.task_name}
                        </button>
                      </td>
                      <td>
                        {formatTemplateGovernanceManuscriptTypeLabel(
                          task.manuscript_type,
                        )}
                      </td>
                      <td>{task.candidate_count}</td>
                      <td>{task.pending_confirmation_count}</td>
                      <td>
                        {formatTemplateGovernanceExtractionTaskStatusLabel(task.status)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>还没有提取任务，请先新建一条任务。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="template-governance-card template-governance-ledger-section">
          <header className="template-governance-ledger-section-header">
            <h2>候选台账</h2>
            <p>每个候选都要先过 AI 语义确认，再决定是否入库。</p>
          </header>
          <div className="template-governance-ledger-table-shell">
            <table className="template-governance-ledger-table">
              <thead>
                <tr>
                  <th>候选名称</th>
                  <th>包类型</th>
                  <th>AI 语义</th>
                  <th>建议去向</th>
                  <th>确认状态</th>
                </tr>
              </thead>
              <tbody>
                {viewModel.selectedTask?.candidates.length ? (
                  viewModel.selectedTask.candidates.map((candidate) => (
                    <tr
                      key={candidate.id}
                      className={
                        candidate.id === selectedCandidate?.id
                          ? "template-governance-ledger-row is-selected"
                          : "template-governance-ledger-row"
                      }
                    >
                      <td>
                        <button
                          type="button"
                          className="template-governance-ledger-row-button"
                          onClick={() => onSelectCandidate?.(candidate.id)}
                        >
                          {candidate.title}
                        </button>
                      </td>
                      <td>{formatRulePackageKindLabel(candidate.package_kind)}</td>
                      <td>{candidate.semantic_draft_payload.semantic_summary}</td>
                      <td>
                        {formatTemplateGovernanceExtractionDestinationLabel(
                          candidate.suggested_destination,
                        )}
                      </td>
                      <td>
                        {formatTemplateGovernanceExtractionCandidateStatusLabel(
                          candidate.confirmation_status,
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>先选择一个任务，再查看对应候选。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
      <TemplateGovernanceLedgerSearchPage searchState={searchState} />

      {taskFormOpen ? (
        <TemplateGovernanceExtractionTaskForm
          draft={taskDraft}
          isBusy={isBusy}
          onDraftChange={onTaskDraftChange}
          onOriginalFileSelect={onOriginalFileSelect}
          onEditedFileSelect={onEditedFileSelect}
          onCancel={onTaskFormCancel}
          onSubmit={onTaskFormSubmit}
        />
      ) : null}
      {isCandidateFormVisible && selectedCandidate ? (
        <TemplateGovernanceCandidateConfirmationForm
          candidate={selectedCandidate}
          values={candidateFormValues}
          isBusy={isBusy}
          onChange={onCandidateFormChange}
          onCancel={onCandidateFormCancel}
          onHold={onCandidateHold}
          onReject={onCandidateReject}
          onConfirm={onCandidateConfirm}
        />
      ) : null}
    </section>
  );
}

function resolveSelectedCandidate(
  candidates: readonly ExtractionTaskCandidateViewModel[],
  selectedCandidateId: string | null,
): ExtractionTaskCandidateViewModel | undefined {
  if (selectedCandidateId) {
    const selectedCandidate = candidates.find(
      (candidate) => candidate.id === selectedCandidateId,
    );
    if (selectedCandidate) {
      return selectedCandidate;
    }
  }

  return candidates[0];
}
