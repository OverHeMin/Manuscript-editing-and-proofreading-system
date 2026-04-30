import type {
  DocumentStructureTableGridCell,
  DocumentStructureTableSnapshot,
} from "../document-pipeline/document-structure-service.ts";
import type {
  TableEvidenceCell,
  TableEvidenceSnapshot,
} from "../document-pipeline/table-evidence-record.ts";
import type {
  DeepProofreadingFact,
  DeepProofreadingFactLedger,
  DeepProofreadingIssueCard,
  DeepProofreadingSliceEvidence,
} from "./deep-proofreading-contracts.ts";

export function runTableDataDeterministicChecks(input: {
  factLedger: DeepProofreadingFactLedger;
  tables?: readonly DocumentStructureTableSnapshot[];
  tableEvidenceSnapshot?: TableEvidenceSnapshot;
}): DeepProofreadingIssueCard[] {
  const conflictIssues: DeepProofreadingIssueCard[] = input.factLedger.conflicts
    .filter((conflict) => conflict.confidence !== "low")
    .map<DeepProofreadingIssueCard>((conflict, index) => {
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
  return [
    ...conflictIssues,
    ...buildLosslessCharacterReviewIssues(
      input.tableEvidenceSnapshot,
      conflictIssues.length,
    ),
  ];
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

function buildLosslessCharacterReviewIssues(
  snapshot: TableEvidenceSnapshot | undefined,
  offset: number,
): DeepProofreadingIssueCard[] {
  if (!snapshot || snapshot.status === "failed" || snapshot.status === "unsupported") {
    return [];
  }

  const issues: DeepProofreadingIssueCard[] = [];
  for (const table of snapshot.tables) {
    for (const cell of table.cells) {
      const highRiskCharacters = cell.characters.filter((character) =>
        ["nbsp", "full_space", "tab", "minus", "en_dash", "em_dash"].includes(
          character.charClass,
        ),
      );
      const highRiskStyleEvidence = collectLosslessStyleEvidence(cell);
      if (highRiskCharacters.length === 0 && highRiskStyleEvidence.length === 0) {
        continue;
      }

      issues.push({
        itemId: `deterministic-table-lossless-${offset + issues.length + 1}`,
        title: "表格存在需人工确认的特殊字符或样式证据",
        description: [
          `单元格 ${cell.cellId} 包含保真抽取证据。`,
          ...highRiskCharacters.map(
            (character) =>
              `${character.codePoint}:${character.charClass}:${character.char}`,
          ),
        ].join(" "),
        severity: "medium",
        source: "deterministic_check",
        issueType: "medical_data_consistency.lossless_character_review",
        blocksFinal: false,
        anchor: {
          blockIndex: 0,
          quote: cell.text,
          documentLocator: {
            anchorKind: "table_cell",
            anchorKey: cell.cellId,
            confidence: "provided",
            tableId: table.tableId,
          },
        },
        suggestion: {
          action: "verify_fact",
          note: "请结合原 DOCX 表格确认特殊字符、空格类型、统计符号与样式是否符合期刊要求；系统不自动改表格。",
        },
        passKind: "data_statistics_units_and_tables",
        sliceId: `slice-${table.tableId}`,
        relatedFactIds: [],
        confidence: "high",
        supportingEvidence: [
          ...highRiskCharacters.map((character) => ({
            kind: "table_cell" as const,
            id: `${cell.cellId}-char-${character.index}`,
            label: `${character.codePoint}:${character.charClass}`,
          })),
          ...highRiskStyleEvidence,
        ],
        conflictFlags: ["lossless_character_review"],
      });
    }
  }
  return issues;
}

function collectLosslessStyleEvidence(
  cell: TableEvidenceCell,
): DeepProofreadingSliceEvidence[] {
  return cell.styleSpans
    .filter((span) => span.italic === true || Boolean(span.scriptPosition))
    .map((span, index) => ({
      kind: "table_cell",
      id: `${cell.cellId}-lossless-style-${index}`,
      label:
        span.italic === true
          ? `italic:${span.runId}:${span.startIndex}-${span.endIndex}`
          : `${span.scriptPosition ?? "style"}:${span.runId}:${span.startIndex}-${span.endIndex}`,
    }));
}
