import type { EditorialTextBlock } from "../editorial-execution/types.ts";
import type { DocumentStructureTableSnapshot } from "../document-pipeline/document-structure-service.ts";
import type {
  DeepProofreadingFact,
  DeepProofreadingFactConflict,
  DeepProofreadingFactLedger,
} from "./deep-proofreading-contracts.ts";
import type { ProofreadingSemanticAnalysisResult } from "./document-semantic-pre-analyzer.ts";

export function buildGlobalFactLedger(input: {
  blocks: readonly EditorialTextBlock[];
  tables?: readonly DocumentStructureTableSnapshot[];
  semanticAnalysis?: ProofreadingSemanticAnalysisResult;
}): DeepProofreadingFactLedger {
  const facts: DeepProofreadingFact[] = [
    ...extractBlockNumberFacts(input.blocks),
    ...extractTableCellFacts(input.tables ?? []),
  ];
  const conflicts = detectTableNumberConflicts(input.blocks, facts);

  return {
    schema: "deep_proofreading_fact_ledger.v1",
    facts,
    conflicts,
    diagnostics: {
      factCount: facts.length,
      conflictCount: conflicts.length,
    },
  };
}

function extractBlockNumberFacts(
  blocks: readonly EditorialTextBlock[],
): DeepProofreadingFact[] {
  const facts: DeepProofreadingFact[] = [];
  blocks.forEach((block, blockIndex) => {
    for (const match of block.text.matchAll(/([A-Za-z]{2,}|[\u4e00-\u9fff]{1,8})?为?(\d+(?:\.\d+)?)(?:\s*[A-Za-z/]+)?/gu)) {
      if ((match[0] ?? "").includes("表")) {
        continue;
      }
      const value = match[2];
      if (!value) {
        continue;
      }
      facts.push({
        id: `fact-block-${blockIndex}-number-${value}`,
        kind: "block_numeric_value",
        label: match[1] || "number",
        value,
        normalizedValue: normalizeNumberText(value),
        confidence: "high",
        source: {
          sourceKind: "block",
          blockIndex,
          quote: match[0],
        },
      });
    }
  });
  return facts;
}

function extractTableCellFacts(
  tables: readonly DocumentStructureTableSnapshot[],
): DeepProofreadingFact[] {
  return tables.flatMap((table) =>
    (table.grid_cells ?? [])
      .filter((cell) => cell.inferred_role === "data" || /\d/u.test(cell.text))
      .flatMap((cell) => {
        const text = cell.normalized_text ?? cell.text;
        const match = text.match(/\d+(?:\.\d+)?/u);
        if (!match) {
          return [];
        }
        const value = match[0];
        return [
          {
            id: `fact-${table.table_id}-${cell.id}`,
            kind: "table_cell_value",
            label: cell.id,
            value,
            normalizedValue: normalizeNumberText(value),
            confidence: hasLowConfidenceObject(cell.object_evidence) ? "low" : "high",
            source: {
              sourceKind: "table_cell",
              tableId: table.table_id,
              anchorKey: `${table.table_id}:${cell.id}`,
              quote: cell.display_text ?? cell.text,
            },
          } satisfies DeepProofreadingFact,
        ];
      }),
  );
}

function detectTableNumberConflicts(
  blocks: readonly EditorialTextBlock[],
  facts: readonly DeepProofreadingFact[],
): DeepProofreadingFactConflict[] {
  const conflicts: DeepProofreadingFactConflict[] = [];
  const blockFacts = facts.filter((fact) => fact.source.sourceKind === "block");
  const tableFacts = facts.filter(
    (fact) => fact.source.sourceKind === "table_cell" && fact.confidence !== "low",
  );

  for (const blockFact of blockFacts) {
    const blockIndex = blockFact.source.blockIndex;
    const blockText = blockIndex === undefined ? "" : blocks[blockIndex]?.text ?? "";
    const referencedTableIds = new Set(
      [...blockText.matchAll(/表\s*(\d+[A-Za-z0-9-]*)/gu)].map(
        (match) => `table-${match[1]}`,
      ),
    );
    for (const tableFact of tableFacts) {
      if (
        tableFact.source.tableId &&
        referencedTableIds.size > 0 &&
        !referencedTableIds.has(tableFact.source.tableId)
      ) {
        continue;
      }
      if (
        blockFact.normalizedValue &&
        tableFact.normalizedValue &&
        blockFact.normalizedValue !== tableFact.normalizedValue
      ) {
        conflicts.push({
          id: `conflict-${blockFact.id}-${tableFact.id}`,
          factIds: [blockFact.id, tableFact.id],
          kind: "numeric_value_mismatch",
          description: `文本数值 ${blockFact.value} 与表格数值 ${tableFact.value} 不一致。`,
          confidence: "high",
        });
      }
    }
  }

  return conflicts.slice(0, 20);
}

function normalizeNumberText(value: string): string {
  return String(Number(value));
}

function hasLowConfidenceObject(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.some(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "object_kind" in entry &&
        (entry as { object_kind?: unknown }).object_kind === "ocr_image_table",
    )
  );
}
