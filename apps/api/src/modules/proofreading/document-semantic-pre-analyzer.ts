import type { EditorialTextBlock } from "../editorial-execution/types.ts";
import type { DocumentStructureTableSnapshot } from "../document-pipeline/document-structure-service.ts";
import type { DeepProofreadingConfidence } from "./deep-proofreading-contracts.ts";

export type ProofreadingSemanticEntityKind =
  | "number"
  | "percentage"
  | "p_value"
  | "confidence_interval"
  | "unit"
  | "sample_size"
  | "mean_sd"
  | "effect_size"
  | "table_reference"
  | "medical_term";

export interface ProofreadingSemanticEntity {
  id: string;
  kind: ProofreadingSemanticEntityKind;
  text: string;
  normalizedText: string;
  confidence: DeepProofreadingConfidence;
  blockIndex?: number;
  startOffset?: number;
  endOffset?: number;
  tableId?: string;
}

export interface ProofreadingBlockSemanticAnalysis {
  blockIndex: number;
  section?: string;
  semanticRoles: string[];
  entityIds: string[];
}

export interface ProofreadingSemanticAnalysisResult {
  blockAnalyses: ProofreadingBlockSemanticAnalysis[];
  entities: ProofreadingSemanticEntity[];
  diagnostics: {
    blockCount: number;
    entityCount: number;
  };
}

export function analyzeProofreadingDocumentSemantics(input: {
  blocks: readonly EditorialTextBlock[];
  tables?: readonly DocumentStructureTableSnapshot[];
}): ProofreadingSemanticAnalysisResult {
  const entities: ProofreadingSemanticEntity[] = [];
  const blockAnalyses = input.blocks.map((block, blockIndex) => {
    const blockEntities = extractEntitiesFromText(block.text, blockIndex);
    entities.push(...blockEntities);
    return {
      blockIndex,
      ...(block.section ? { section: block.section } : {}),
      semanticRoles: inferSemanticRoles(block, blockEntities),
      entityIds: blockEntities.map((entity) => entity.id),
    };
  });

  for (const table of input.tables ?? []) {
    for (const cell of table.grid_cells ?? []) {
      const text = cell.normalized_text ?? cell.text;
      if (!text) {
        continue;
      }
      entities.push(
        ...extractEntitiesFromText(text, undefined, {
          idPrefix: `${table.table_id}-${cell.id}`,
          tableId: table.table_id,
        }),
      );
    }
  }

  return {
    blockAnalyses,
    entities,
    diagnostics: {
      blockCount: input.blocks.length,
      entityCount: entities.length,
    },
  };
}

function inferSemanticRoles(
  block: EditorialTextBlock,
  entities: readonly ProofreadingSemanticEntity[],
): string[] {
  const roles = new Set<string>();
  const section = (block.section ?? "").toLowerCase();
  const text = block.text;

  if (section.includes("abstract") || text.includes("摘要")) {
    roles.add("abstract");
  }
  if (section.includes("method") || text.includes("方法") || text.includes("资料")) {
    roles.add("methods");
  }
  if (section.includes("result") || text.includes("结果")) {
    roles.add("results");
  }
  if (section.includes("conclusion") || text.includes("结论")) {
    roles.add("conclusion");
  }
  if (
    entities.some((entity) =>
      [
        "p_value",
        "confidence_interval",
        "unit",
        "percentage",
        "mean_sd",
        "effect_size",
      ].includes(entity.kind),
    )
  ) {
    roles.add("statistical_expression");
  }
  if (entities.some((entity) => entity.kind === "table_reference")) {
    roles.add("table_reference");
  }
  if (entities.some((entity) => entity.kind === "sample_size")) {
    roles.add("sample_size");
  }

  return [...roles];
}

function extractEntitiesFromText(
  text: string,
  blockIndex?: number,
  options?: {
    idPrefix?: string;
    tableId?: string;
  },
): ProofreadingSemanticEntity[] {
  const entities: ProofreadingSemanticEntity[] = [];
  const patterns: Array<{
    kind: ProofreadingSemanticEntityKind;
    pattern: RegExp;
    confidence: DeepProofreadingConfidence;
  }> = [
    { kind: "table_reference", pattern: /(?:见|如)?表\s*\d+[A-Za-z0-9-]*/gu, confidence: "high" },
    { kind: "p_value", pattern: /\b[Pp]\s*[<=>≤≥]\s*0?\.\d+\b/gu, confidence: "high" },
    { kind: "unit", pattern: /\b\d+(?:\.\d+)?\s*(?:mg|g|kg|mL|L|U\/L|mmHg|cm|mm)\b/giu, confidence: "high" },
    { kind: "confidence_interval", pattern: /(?:95%\s*)?CI\s*[\(（]?\s*\d+(?:\.\d+)?\s*[～~-]\s*\d+(?:\.\d+)?/giu, confidence: "high" },
    { kind: "sample_size", pattern: /\bn\s*=\s*\d+\b/giu, confidence: "high" },
    { kind: "mean_sd", pattern: /\d+(?:\.\d+)?\s*±\s*\d+(?:\.\d+)?/gu, confidence: "high" },
    { kind: "percentage", pattern: /\d+(?:\.\d+)?%(?!\s*CI)/giu, confidence: "high" },
    { kind: "effect_size", pattern: /\b(?:OR|HR|RR)\s*=?\s*\d+(?:\.\d+)?\b/gu, confidence: "medium" },
  ];

  for (const { kind, pattern, confidence } of patterns) {
    for (const match of text.matchAll(pattern)) {
      const matchedText = match[0];
      const startOffset = match.index ?? 0;
      entities.push({
        id: `${options?.idPrefix ?? `block-${blockIndex ?? "unknown"}`}-${kind}-${startOffset}`,
        kind,
        text: matchedText,
        normalizedText: normalizeEntityText(matchedText),
        confidence,
        ...(blockIndex !== undefined ? { blockIndex } : {}),
        startOffset,
        endOffset: startOffset + matchedText.length,
        ...(options?.tableId ? { tableId: options.tableId } : {}),
      });
    }
  }

  return entities.sort(
    (left, right) =>
      (left.blockIndex ?? -1) - (right.blockIndex ?? -1) ||
      (left.startOffset ?? 0) - (right.startOffset ?? 0) ||
      left.kind.localeCompare(right.kind),
  );
}

function normalizeEntityText(text: string): string {
  return text.replace(/\s+/gu, "").replace(/[（]/gu, "(").replace(/[）]/gu, ")");
}
