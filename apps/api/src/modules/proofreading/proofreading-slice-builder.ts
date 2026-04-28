import type { EditorialTextBlock } from "../editorial-execution/types.ts";
import type { DocumentStructureTableSnapshot } from "../document-pipeline/document-structure-service.ts";
import type {
  DeepProofreadingFactLedger,
  DeepProofreadingSlice,
  DeepProofreadingSliceKind,
} from "./deep-proofreading-contracts.ts";
import type { ProofreadingSemanticAnalysisResult } from "./document-semantic-pre-analyzer.ts";
import type { ProofreadingDeepPassKind } from "./proofreading-pass-run-record.ts";

const REQUIRED_PASS_KINDS: ProofreadingDeepPassKind[] = [
  "medical_facts_and_terminology",
  "structure_logic_and_consistency",
  "data_statistics_units_and_tables",
  "language_style_punctuation_and_format",
  "residual_synthesis",
];

export function buildProofreadingSlices(input: {
  blocks: readonly EditorialTextBlock[];
  tables?: readonly DocumentStructureTableSnapshot[];
  semanticAnalysis: ProofreadingSemanticAnalysisResult;
  factLedger: DeepProofreadingFactLedger;
}): DeepProofreadingSlice[] {
  const slices = [
    ...buildTableSlices(input),
    ...buildDataSlices(input),
    ...buildConsistencySlices(input),
    ...buildLanguageFormatSlices(input),
    ...buildMedicalFactSlices(input),
  ];
  slices.push(...buildResidualSlices(input, slices));
  return sortSlicesByPassOrder(addMissingPassFallbackSlices(input, slices));
}

function buildTableSlices(input: {
  blocks: readonly EditorialTextBlock[];
  tables?: readonly DocumentStructureTableSnapshot[];
  semanticAnalysis: ProofreadingSemanticAnalysisResult;
}): DeepProofreadingSlice[] {
  return (input.tables ?? []).map((table) => {
    const referencedBlocks = input.semanticAnalysis.entities
      .filter(
        (entity) =>
          entity.kind === "table_reference" &&
          entity.blockIndex !== undefined &&
          entity.normalizedText.includes(table.table_id.replace("table-", "")),
      )
      .map((entity) => entity.blockIndex as number);
    return {
      id: `slice-${table.table_id}`,
      sliceKind: "table",
      passKinds: ["data_statistics_units_and_tables"],
      sourceBlockIndexes: uniqueNumbers(referencedBlocks),
      tableIds: [table.table_id],
      text: [
        table.caption_fields?.text,
        table.note_zone?.text,
        ...(table.grid_cells ?? []).map((cell) => cell.display_text ?? cell.text),
      ]
        .filter(Boolean)
        .join("\n"),
      evidence: [{ kind: "table", id: table.table_id }],
    };
  });
}

function buildDataSlices(input: {
  blocks: readonly EditorialTextBlock[];
  semanticAnalysis: ProofreadingSemanticAnalysisResult;
}): DeepProofreadingSlice[] {
  const blockIndexes = input.semanticAnalysis.blockAnalyses
    .filter((analysis) => analysis.semanticRoles.includes("statistical_expression"))
    .map((analysis) => analysis.blockIndex);
  if (blockIndexes.length === 0) {
    return [];
  }
  return [
    {
      id: "slice-data-statistics",
      sliceKind: "data",
      passKinds: ["data_statistics_units_and_tables"],
      sourceBlockIndexes: blockIndexes,
      text: blockIndexes.map((index) => input.blocks[index]?.text ?? "").join("\n"),
      evidence: blockIndexes.map((index) => ({ kind: "block", id: `block-${index}` })),
    },
  ];
}

function buildConsistencySlices(input: {
  blocks: readonly EditorialTextBlock[];
  semanticAnalysis: ProofreadingSemanticAnalysisResult;
  factLedger: DeepProofreadingFactLedger;
}): DeepProofreadingSlice[] {
  const blockIndexes = uniqueNumbers(
    input.factLedger.facts
      .filter((fact) => fact.source.sourceKind === "block")
      .map((fact) => fact.source.blockIndex)
      .filter((index): index is number => typeof index === "number"),
  );
  if (blockIndexes.length < 2) {
    return [];
  }
  return [
    {
      id: "slice-consistency-global",
      sliceKind: "consistency",
      passKinds: ["structure_logic_and_consistency"],
      sourceBlockIndexes: blockIndexes,
      text: blockIndexes.map((index) => input.blocks[index]?.text ?? "").join("\n"),
      evidence: input.factLedger.facts.map((fact) => ({ kind: "fact", id: fact.id })),
    },
  ];
}

function buildLanguageFormatSlices(input: {
  blocks: readonly EditorialTextBlock[];
}): DeepProofreadingSlice[] {
  const blockIndexes = input.blocks
    .map((block, index) =>
      ["title", "abstract", "references"].some((section) =>
        (block.section ?? "").toLowerCase().includes(section),
      )
        ? index
        : undefined,
    )
    .filter((index): index is number => typeof index === "number");
  if (blockIndexes.length === 0) {
    return [];
  }
  return [
    {
      id: "slice-language-format",
      sliceKind: "language_format",
      passKinds: ["language_style_punctuation_and_format"],
      sourceBlockIndexes: blockIndexes,
      text: blockIndexes.map((index) => input.blocks[index]?.text ?? "").join("\n"),
      evidence: blockIndexes.map((index) => ({ kind: "block", id: `block-${index}` })),
    },
  ];
}

function buildMedicalFactSlices(input: {
  blocks: readonly EditorialTextBlock[];
}): DeepProofreadingSlice[] {
  const blockIndexes = input.blocks
    .map((block, index) => (/(术|病|治疗|诊断|ALT|VTE|血栓)/iu.test(block.text) ? index : undefined))
    .filter((index): index is number => typeof index === "number");
  if (blockIndexes.length === 0) {
    return [];
  }
  return [
    {
      id: "slice-medical-facts",
      sliceKind: "medical_fact",
      passKinds: ["medical_facts_and_terminology"],
      sourceBlockIndexes: uniqueNumbers(blockIndexes),
      text: uniqueNumbers(blockIndexes).map((index) => input.blocks[index]?.text ?? "").join("\n"),
      evidence: uniqueNumbers(blockIndexes).map((index) => ({
        kind: "block",
        id: `block-${index}`,
      })),
    },
  ];
}

function buildResidualSlices(
  input: { blocks: readonly EditorialTextBlock[] },
  priorSlices: readonly DeepProofreadingSlice[],
): DeepProofreadingSlice[] {
  const covered = new Set(priorSlices.flatMap((slice) => slice.sourceBlockIndexes));
  const residualIndexes = input.blocks
    .map((_, index) => index)
    .filter((index) => !covered.has(index));
  if (residualIndexes.length === 0) {
    return [];
  }
  return [
    {
      id: "slice-residual",
      sliceKind: "residual",
      passKinds: ["residual_synthesis"],
      sourceBlockIndexes: residualIndexes,
      text: residualIndexes.map((index) => input.blocks[index]?.text ?? "").join("\n"),
      evidence: residualIndexes.map((index) => ({ kind: "block", id: `block-${index}` })),
    },
  ];
}

function uniqueNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function addMissingPassFallbackSlices(
  input: {
    blocks: readonly EditorialTextBlock[];
    tables?: readonly DocumentStructureTableSnapshot[];
  },
  slices: readonly DeepProofreadingSlice[],
): DeepProofreadingSlice[] {
  const presentPassKinds = new Set(
    slices.flatMap((slice) => slice.passKinds),
  );
  const missingPassKinds = REQUIRED_PASS_KINDS.filter(
    (passKind) => !presentPassKinds.has(passKind),
  );
  if (missingPassKinds.length === 0) {
    return [...slices];
  }

  const sourceBlockIndexes = input.blocks.map((_, index) => index);
  const tableIds = (input.tables ?? []).map((table) => table.table_id);
  const text = buildWholeDocumentSliceText(input);
  const evidence = [
    ...sourceBlockIndexes.map((index) => ({
      kind: "block" as const,
      id: `block-${index}`,
    })),
    ...tableIds.map((tableId) => ({
      kind: "table" as const,
      id: tableId,
    })),
  ];

  return [
    ...slices,
    ...missingPassKinds.map((passKind) => ({
      id: `slice-fallback-${passKind}`,
      sliceKind: mapPassKindToSliceKind(passKind),
      passKinds: [passKind],
      sourceBlockIndexes,
      ...(tableIds.length > 0 ? { tableIds } : {}),
      text,
      evidence,
    })),
  ];
}

function sortSlicesByPassOrder(
  slices: readonly DeepProofreadingSlice[],
): DeepProofreadingSlice[] {
  return slices
    .map((slice, index) => ({ slice, index }))
    .sort((left, right) => {
      const leftOrder = getSlicePassOrder(left.slice);
      const rightOrder = getSlicePassOrder(right.slice);
      return leftOrder === rightOrder
        ? left.index - right.index
        : leftOrder - rightOrder;
    })
    .map((entry) => entry.slice);
}

function getSlicePassOrder(slice: DeepProofreadingSlice): number {
  return Math.min(
    ...slice.passKinds.map((passKind) => REQUIRED_PASS_KINDS.indexOf(passKind)),
  );
}

function mapPassKindToSliceKind(
  passKind: ProofreadingDeepPassKind,
): DeepProofreadingSliceKind {
  switch (passKind) {
    case "medical_facts_and_terminology":
      return "medical_fact";
    case "structure_logic_and_consistency":
      return "consistency";
    case "data_statistics_units_and_tables":
      return "data";
    case "language_style_punctuation_and_format":
      return "language_format";
    case "residual_synthesis":
      return "residual";
  }
}

function buildWholeDocumentSliceText(input: {
  blocks: readonly EditorialTextBlock[];
  tables?: readonly DocumentStructureTableSnapshot[];
}): string {
  return [
    ...input.blocks.map((block) => block.text),
    ...(input.tables ?? []).flatMap((table) => [
      table.caption_fields?.text,
      table.note_zone?.text,
      ...(table.grid_cells ?? []).map((cell) => cell.display_text ?? cell.text),
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}
