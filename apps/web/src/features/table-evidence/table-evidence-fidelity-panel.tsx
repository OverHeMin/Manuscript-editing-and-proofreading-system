import type {
  TableEvidenceConfirmationStatus,
  TableFidelityReport,
} from "./table-evidence-types.ts";

export interface TableEvidenceFidelityPanelProps {
  report: TableFidelityReport;
  confirmationStatus: TableEvidenceConfirmationStatus;
  invisibleCharsConfirmed: boolean;
  specialSymbolsConfirmed: boolean;
  onInvisibleCharsConfirmedChange: (confirmed: boolean) => void;
  onSpecialSymbolsConfirmedChange: (confirmed: boolean) => void;
}

export function TableEvidenceFidelityPanel({
  report,
  confirmationStatus,
  invisibleCharsConfirmed,
  specialSymbolsConfirmed,
  onInvisibleCharsConfirmedChange,
  onSpecialSymbolsConfirmedChange,
}: TableEvidenceFidelityPanelProps) {
  const statusLabel = resolveFidelityStateLabel(report.status, confirmationStatus);
  const requiresInvisibleChars = report.required_confirmations.includes("invisible_chars");
  const requiresSpecialSymbols = report.required_confirmations.includes("special_symbols");

  return (
    <section
      className="table-evidence-panel table-evidence-fidelity-panel"
      data-fidelity-status={report.status}
      data-confirmation-status={confirmationStatus}
    >
      <h3>保真与确认</h3>
      <p data-fidelity-state={statusLabel}>{statusLabel}</p>
      <label>
        <input
          checked={invisibleCharsConfirmed}
          data-confirmation-kind="invisible_chars"
          disabled={!requiresInvisibleChars}
          onChange={(event) => onInvisibleCharsConfirmedChange(event.currentTarget.checked)}
          type="checkbox"
        />
        不可见字符
      </label>
      <label>
        <input
          checked={specialSymbolsConfirmed}
          data-confirmation-kind="special_symbols"
          disabled={!requiresSpecialSymbols}
          onChange={(event) => onSpecialSymbolsConfirmedChange(event.currentTarget.checked)}
          type="checkbox"
        />
        特殊符号
      </label>
      {report.failure_codes.length > 0 || report.unsupported_fact_groups.length > 0 ? (
        <dl className="table-evidence-fidelity-details">
          <div>
            <dt>失败代码</dt>
            <dd>{report.failure_codes.join(", ") || "无"}</dd>
          </div>
          <div>
            <dt>不支持事实组</dt>
            <dd>{report.unsupported_fact_groups.join(", ") || "无"}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}

export function resolveFidelityStateLabel(
  fidelityStatus: TableFidelityReport["status"],
  confirmationStatus: TableEvidenceConfirmationStatus,
): "待确认" | "已确认" | "需复核" {
  if (fidelityStatus === "needs_review" || confirmationStatus === "needs_review") {
    return "需复核";
  }

  if (fidelityStatus === "confirmed" && confirmationStatus === "confirmed") {
    return "已确认";
  }

  return "待确认";
}
