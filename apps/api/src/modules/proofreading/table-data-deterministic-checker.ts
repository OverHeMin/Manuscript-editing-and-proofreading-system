import type {
  DocumentStructureTableGridCell,
  DocumentStructureTableSnapshot,
} from "../document-pipeline/document-structure-service.ts";
import type {
  DeepProofreadingFact,
  DeepProofreadingFactLedger,
  DeepProofreadingIssueCard,
  DeepProofreadingSliceEvidence,
} from "./deep-proofreading-contracts.ts";

export function runTableDataDeterministicChecks(input: {
  factLedger: DeepProofreadingFactLedger;
  tables?: readonly DocumentStructureTableSnapshot[];
}): DeepProofreadingIssueCard[] {
  return input.factLedger.conflicts
    .filter((conflict) => conflict.confidence !== "low")
    .map((conflict, index) => {
      const relatedFacts = conflict.factIds
        .map((factId) => input.factLedger.facts.find((fact) => fact.id === factId))
        .filter((fact): fact is DeepProofreadingFact => Boolean(fact));
      const tableFact =
        relatedFacts.find((fact) => fact.source.sourceKind === "table_cell") ??
        relatedFacts[0];
      const table = input.tables?.find(
        (entry) => entry.table_id === tableFact?.source.tableId,
      );
      const cell = table?.grid_cells?.find((entry) =>
        tableFact?.source.anchorKey?.endsWith(entry.id),
      );
      const quote =
        cell?.display_text ??
        tableFact?.source.quote ??
        relatedFacts.map((fact) => fact.value).join(" / ");

      return {
        itemId: `deterministic-table-data-${index + 1}`,
        title: "表格与正文数值可能不一致",
        description: conflict.description,
        severity: "high",
        source: "deterministic_check",
        issueType: `medical_data_consistency.${conflict.kind}`,
        blocksFinal: false,
        anchor: {
          blockIndex:
            relatedFacts.find((fact) => fact.source.blockIndex !== undefined)?.source
              .blockIndex ?? 0,
          quote,
          documentLocator: {
            anchorKind: tableFact?.source.sourceKind === "table_cell" ? "table_cell" : "block",
            anchorKey: tableFact?.source.anchorKey ?? tableFact?.id ?? conflict.id,
            confidence: "derived",
            ...(tableFact?.source.tableId ? { tableId: tableFact.source.tableId } : {}),
          },
        },
        suggestion: {
          action: "verify_fact",
          note: "请人工核对正文、表格、单位与统计表达后定稿；系统不自动替换医学统计事实。",
        },
        passKind: "data_statistics_units_and_tables",
        sliceId: tableFact?.source.tableId
          ? `slice-${tableFact.source.tableId}`
          : undefined,
        relatedFactIds: conflict.factIds,
        confidence: conflict.confidence,
        supportingEvidence: [
          ...relatedFacts.map((fact) => ({
            kind: "fact" as const,
            id: fact.id,
            label: `${fact.label}:${fact.value}`,
          })),
          ...collectStyleEvidence(cell),
        ],
        conflictFlags: [conflict.kind],
      };
    });
}

function collectStyleEvidence(
  cell: DocumentStructureTableGridCell | undefined,
): DeepProofreadingSliceEvidence[] {
  if (!cell || !Array.isArray(cell.style_runs)) {
    return [];
  }
  return cell.style_runs
    .filter((run) => run.italic === true || run.script_position)
    .map((run, index) => ({
      kind: "table_cell",
      id: `${cell.id}-style-${index}`,
      label:
        run.italic === true
          ? `italic:${run.text}`
          : `${run.script_position ?? "style"}:${run.text}`,
    }));
}
