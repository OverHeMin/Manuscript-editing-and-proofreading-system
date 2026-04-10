import type {
  EditIntentSignal,
  ExampleDocumentBlockSnapshot,
  ExampleDocumentSnapshot,
} from "@medical/contracts";

export class ExamplePairDiffService {
  extractSignals(input: {
    original: ExampleDocumentSnapshot;
    edited: ExampleDocumentSnapshot;
  }): EditIntentSignal[] {
    return [
      ...extractFrontMatterSignals(input),
      ...extractAbstractKeywordSignals(input),
      ...extractHeadingSignals(input),
      ...extractNumericSignals(input),
      ...extractTableSignals(input),
      ...extractReferenceSignals(input),
    ];
  }
}

function extractFrontMatterSignals(input: {
  original: ExampleDocumentSnapshot;
  edited: ExampleDocumentSnapshot;
}): EditIntentSignal[] {
  return extractBlockChangeSignals({
    ...input,
    package_hint: "front_matter",
    include: (block) => block.section_key === "front_matter",
    classifySignalType: (change) =>
      change.kind === "inserted" ? "inserted_block" : "text_style_normalization",
    rationale: "前置信息块在编后稿中被补齐或规范化。",
  });
}

function extractAbstractKeywordSignals(input: {
  original: ExampleDocumentSnapshot;
  edited: ExampleDocumentSnapshot;
}): EditIntentSignal[] {
  return extractBlockChangeSignals({
    ...input,
    package_hint: "abstract_keywords",
    include: (block) => block.section_key === "abstract",
    classifySignalType: () => "label_normalization",
    rationale: "摘要与关键词标签的标点或分隔样式发生了统一。",
  });
}

function extractHeadingSignals(input: {
  original: ExampleDocumentSnapshot;
  edited: ExampleDocumentSnapshot;
}): EditIntentSignal[] {
  return extractBlockChangeSignals({
    ...input,
    package_hint: "heading_hierarchy",
    include: (block) =>
      block.kind === "heading" ||
      (block.section_key === "body" && matchesHeadingPattern(block.text)),
    classifySignalType: () => "text_style_normalization",
    rationale: "标题层级的编号与空格格式被统一。",
  });
}

function extractNumericSignals(input: {
  original: ExampleDocumentSnapshot;
  edited: ExampleDocumentSnapshot;
}): EditIntentSignal[] {
  return extractBlockChangeSignals({
    ...input,
    package_hint: "numeric_statistics",
    include: (block) =>
      block.semantic_role === "statistical_expression" ||
      hasNumericStatisticPattern(block.text),
    classifySignalType: () => "text_style_normalization",
    rationale: "数值、单位或统计符号的写法在编后稿中被规范化。",
  });
}

function extractTableSignals(input: {
  original: ExampleDocumentSnapshot;
  edited: ExampleDocumentSnapshot;
}): EditIntentSignal[] {
  const originalTables = new Map(
    input.original.tables.map((table) => [table.table_id, table]),
  );
  const editedTables = new Map(input.edited.tables.map((table) => [table.table_id, table]));
  const tableIds = new Set([...originalTables.keys(), ...editedTables.keys()]);
  const signals: EditIntentSignal[] = [];

  for (const tableId of tableIds) {
    const originalTable = originalTables.get(tableId);
    const editedTable = editedTables.get(tableId);
    if (!originalTable || !editedTable) {
      continue;
    }

    const originalHeaderText = originalTable.header_cells.map((cell) => cell.text).join(" | ");
    const editedHeaderText = editedTable.header_cells.map((cell) => cell.text).join(" | ");
    if (originalHeaderText !== editedHeaderText) {
      signals.push({
        id: `three_line_table:${tableId}:header`,
        package_hint: "three_line_table",
        signal_type: "table_semantic_change",
        object_hint: "header_cell",
        before: originalHeaderText,
        after: editedHeaderText,
        rationale: "三线表列头语义被规范化。",
        confidence: 0.93,
        risk_flags: ["table_review"],
      });
    }

    const originalFootnotes = originalTable.footnote_items
      .map((item) => item.text)
      .join(" | ");
    const editedFootnotes = editedTable.footnote_items
      .map((item) => item.text)
      .join(" | ");
    if (originalFootnotes !== editedFootnotes) {
      signals.push({
        id: `three_line_table:${tableId}:footnote`,
        package_hint: "three_line_table",
        signal_type: "table_semantic_change",
        object_hint: "footnote_item",
        before: originalFootnotes,
        after: editedFootnotes,
        rationale: "统计脚注的锚点或表注表达被规范化。",
        confidence: 0.91,
        risk_flags: ["table_review", "manual_confirmation"],
      });
    }
  }

  return signals;
}

function extractReferenceSignals(input: {
  original: ExampleDocumentSnapshot;
  edited: ExampleDocumentSnapshot;
}): EditIntentSignal[] {
  return extractBlockChangeSignals({
    ...input,
    package_hint: "reference",
    include: (block) => block.section_key === "reference",
    classifySignalType: () => "reference_style_change",
    rationale: "参考文献条目的标点、空格或期卷页样式被统一。",
  });
}

function extractBlockChangeSignals(input: {
  original: ExampleDocumentSnapshot;
  edited: ExampleDocumentSnapshot;
  package_hint: EditIntentSignal["package_hint"];
  include: (block: ExampleDocumentBlockSnapshot) => boolean;
  classifySignalType: (change: { kind: "changed" | "inserted" }) => EditIntentSignal["signal_type"];
  rationale: string;
}): EditIntentSignal[] {
  const originalBlocks = new Map(
    input.original.blocks.filter(input.include).map((block) => [block.block_id, block]),
  );
  const editedBlocks = new Map(
    input.edited.blocks.filter(input.include).map((block) => [block.block_id, block]),
  );
  const blockIds = new Set([...originalBlocks.keys(), ...editedBlocks.keys()]);
  const signals: EditIntentSignal[] = [];

  for (const blockId of blockIds) {
    const originalBlock = originalBlocks.get(blockId);
    const editedBlock = editedBlocks.get(blockId);

    if (!originalBlock && editedBlock) {
      signals.push({
        id: `${input.package_hint}:${blockId}:inserted`,
        package_hint: input.package_hint,
        signal_type: input.classifySignalType({ kind: "inserted" }),
        object_hint: editedBlock.semantic_role,
        after: editedBlock.text,
        rationale: input.rationale,
        confidence: 0.88,
        risk_flags: [],
      });
      continue;
    }

    if (!originalBlock || !editedBlock || originalBlock.text === editedBlock.text) {
      continue;
    }

    signals.push({
      id: `${input.package_hint}:${blockId}:changed`,
      package_hint: input.package_hint,
      signal_type: input.classifySignalType({ kind: "changed" }),
      object_hint: editedBlock.semantic_role,
      before: originalBlock.text,
      after: editedBlock.text,
      rationale: input.rationale,
      confidence: 0.9,
      risk_flags: [],
    });
  }

  return signals;
}

function matchesHeadingPattern(text: string): boolean {
  return /^\d+(\.\d+)*\s*/u.test(text.trim());
}

function hasNumericStatisticPattern(text: string): boolean {
  const normalized = text.trim();
  return /\d/u.test(normalized) && /(%|P<|P>|mg|cm|mm|~|d\b)/iu.test(normalized);
}
