import type { ExtractionTaskCandidateViewModel } from "../editorial-rules/index.ts";
import {
  formatRulePackageKindLabel,
  formatTemplateGovernanceExtractionCandidateStatusLabel,
  formatTemplateGovernanceExtractionDestinationLabel,
} from "./template-governance-display.ts";

export interface TemplateGovernanceCandidateConfirmationFormValues {
  semanticSummary: string;
  applicability: string;
  suggestedDestination: ExtractionTaskCandidateViewModel["suggested_destination"];
  confirmationStatus: ExtractionTaskCandidateViewModel["confirmation_status"];
}

export interface TemplateGovernanceCandidateConfirmationFormProps {
  candidate: ExtractionTaskCandidateViewModel;
  values?: Partial<TemplateGovernanceCandidateConfirmationFormValues>;
  isBusy?: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  onChange?: (
    recipe: (
      current: TemplateGovernanceCandidateConfirmationFormValues,
    ) => TemplateGovernanceCandidateConfirmationFormValues,
  ) => void;
  onCancel?: () => void;
  onHold?: () => void;
  onReject?: () => void;
  onConfirm?: () => void;
}

export function TemplateGovernanceCandidateConfirmationForm({
  candidate,
  values,
  isBusy = false,
  statusMessage = null,
  errorMessage = null,
  onChange,
  onCancel,
  onHold,
  onReject,
  onConfirm,
}: TemplateGovernanceCandidateConfirmationFormProps) {
  const resolvedValues: TemplateGovernanceCandidateConfirmationFormValues = {
    semanticSummary:
      values?.semanticSummary ?? candidate.semantic_draft_payload.semantic_summary,
    applicability:
      values?.applicability ??
      candidate.semantic_draft_payload.applicability.join(" / "),
    suggestedDestination:
      values?.suggestedDestination ?? candidate.suggested_destination,
    confirmationStatus:
      values?.confirmationStatus ?? candidate.confirmation_status,
  };

  return (
    <section className="template-governance-form-layer">
      <article className="template-governance-card template-governance-candidate-confirmation-form">
        <header className="template-governance-form-header">
          <h2>AI 语义确认</h2>
          <p>
            当前候选：{candidate.title} / {formatRulePackageKindLabel(candidate.package_kind)}
          </p>
        </header>
        {statusMessage ? <p className="template-governance-status">{statusMessage}</p> : null}
        {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}
        <div className="template-governance-form-grid">
          <label className="template-governance-field template-governance-field-full">
            <span>AI 一句话理解</span>
            <textarea
              rows={3}
              value={resolvedValues.semanticSummary}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  semanticSummary: event.target.value,
                }))
              }
            />
          </label>
          <label className="template-governance-field template-governance-field-full">
            <span>适用范围</span>
            <textarea
              rows={3}
              value={resolvedValues.applicability}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  applicability: event.target.value,
                }))
              }
            />
          </label>
          <label className="template-governance-field">
            <span>建议去向</span>
            <select
              value={resolvedValues.suggestedDestination}
              disabled={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  suggestedDestination: event.target.value as ExtractionTaskCandidateViewModel["suggested_destination"],
                }))
              }
            >
              <option value="general_module">
                {formatTemplateGovernanceExtractionDestinationLabel("general_module")}
              </option>
              <option value="medical_module">
                {formatTemplateGovernanceExtractionDestinationLabel("medical_module")}
              </option>
              <option value="template">
                {formatTemplateGovernanceExtractionDestinationLabel("template")}
              </option>
            </select>
          </label>
          <label className="template-governance-field">
            <span>确认状态</span>
            <select
              value={resolvedValues.confirmationStatus}
              disabled={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  confirmationStatus: event.target.value as ExtractionTaskCandidateViewModel["confirmation_status"],
                }))
              }
            >
              <option value="ai_semantic_ready">
                {formatTemplateGovernanceExtractionCandidateStatusLabel("ai_semantic_ready")}
              </option>
              <option value="held">
                {formatTemplateGovernanceExtractionCandidateStatusLabel("held")}
              </option>
              <option value="confirmed">
                {formatTemplateGovernanceExtractionCandidateStatusLabel("confirmed")}
              </option>
              <option value="rejected">
                {formatTemplateGovernanceExtractionCandidateStatusLabel("rejected")}
              </option>
            </select>
          </label>
        </div>
        <div className="template-governance-actions">
          <button type="button" onClick={onCancel}>
            取消
          </button>
          <button type="button" onClick={onHold} disabled={isBusy}>
            暂存
          </button>
          <button type="button" onClick={onReject} disabled={isBusy}>
            驳回
          </button>
          <button type="button" onClick={onConfirm} disabled={isBusy}>
            {isBusy ? "提交中..." : "确认入库"}
          </button>
        </div>
      </article>
    </section>
  );
}
