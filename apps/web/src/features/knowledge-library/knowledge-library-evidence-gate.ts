import type { KnowledgeContentBlockViewModel } from "./types.ts";

export type KnowledgeLibraryEvidenceGateAction =
  | "save_draft"
  | "confirm_entry"
  | "submit_review";

export interface KnowledgeLibraryEvidenceGateItem {
  blockId: string;
  blockType: KnowledgeContentBlockViewModel["block_type"];
  orderNo: number;
  title: string;
  statusLabel: string;
  detail: string;
  blocking: boolean;
}

export interface KnowledgeLibraryEvidenceGateSummary {
  itemCount: number;
  readyItemCount: number;
  blockingItemCount: number;
  items: KnowledgeLibraryEvidenceGateItem[];
  hasBlockingIssues: boolean;
  blockingMessage: string | null;
}

export function createKnowledgeLibraryEvidenceGateSummary(input: {
  blocks?: readonly KnowledgeContentBlockViewModel[];
  releaseAction: KnowledgeLibraryEvidenceGateAction;
}): KnowledgeLibraryEvidenceGateSummary {
  const items = (input.blocks ?? []).flatMap((block) =>
    createKnowledgeLibraryEvidenceGateItems(block, input.releaseAction),
  );
  const blockingItems = items.filter((item) => item.blocking);
  const actionLabel = formatKnowledgeLibraryEvidenceGateActionLabel(input.releaseAction);

  return {
    itemCount: items.length,
    readyItemCount: items.length - blockingItems.length,
    blockingItemCount: blockingItems.length,
    items,
    hasBlockingIssues: blockingItems.length > 0,
    blockingMessage:
      input.releaseAction !== "submit_review" || blockingItems.length === 0
        ? null
        : blockingItems.length === 1
          ? `${blockingItems[0]?.title}未满足${actionLabel}条件：${blockingItems[0]?.detail}`
          : `当前有 ${blockingItems.length} 条高精度证据未满足${actionLabel}条件：${blockingItems
              .map((item) => item.title)
              .join("、")}`,
  };
}

function createKnowledgeLibraryEvidenceGateItems(
  block: KnowledgeContentBlockViewModel,
  releaseAction: KnowledgeLibraryEvidenceGateAction,
): KnowledgeLibraryEvidenceGateItem[] {
  if (block.block_type === "table_block") {
    const item = createKnowledgeLibraryTableEvidenceGateItem(block, releaseAction);
    return item ? [item] : [];
  }

  if (block.block_type === "table_evidence_block") {
    return [createKnowledgeLibraryTableEvidenceRevisionGateItem(block, releaseAction)];
  }

  if (block.block_type === "image_block") {
    const item = createKnowledgeLibraryImageEvidenceGateItem(block, releaseAction);
    return item ? [item] : [];
  }

  return [];
}

function createKnowledgeLibraryTableEvidenceGateItem(
  block: KnowledgeContentBlockViewModel,
  releaseAction: KnowledgeLibraryEvidenceGateAction,
): KnowledgeLibraryEvidenceGateItem | null {
  if (!requiresKnowledgeLibraryTableEvidenceGate(block)) {
    return null;
  }

  const tableSemantics = asKnowledgeLibraryOptionalRecord(block.table_semantics);
  const payload = asKnowledgeLibraryOptionalRecord(block.content_payload) ?? {};
  const failureCodes = uniqueKnowledgeLibraryStrings([
    ...readKnowledgeLibraryRecordStringArray(tableSemantics, "exact_capture_failure_codes"),
    ...readKnowledgeLibraryRecordStringArray(payload, "exact_capture_failure_codes"),
  ]);
  const isReady = false;
  const blocking = releaseAction === "submit_review" && !isReady;
  const detail =
    failureCodes.length > 0
      ? failureCodes.map(formatKnowledgeLibraryTableFailureCodeLabel).join(" / ")
      : "请改用已确认的 Word 表格证据。";

  return {
    blockId: block.id,
    blockType: block.block_type,
    orderNo: block.order_no,
    title: `表格块 #${block.order_no + 1}`,
    statusLabel: formatKnowledgeLibraryEvidenceStatusLabel({
      releaseAction,
      blocking,
      isReady,
    }),
    detail: formatKnowledgeLibraryNonBlockingDetail({
      releaseAction,
      isReady,
      detail,
    }),
    blocking,
  };
}

function createKnowledgeLibraryTableEvidenceRevisionGateItem(
  block: KnowledgeContentBlockViewModel,
  releaseAction: KnowledgeLibraryEvidenceGateAction,
): KnowledgeLibraryEvidenceGateItem {
  const payload = asKnowledgeLibraryOptionalRecord(block.content_payload) ?? {};
  const revisionStatus = readKnowledgeLibraryRecordString(payload, "revision_status");
  const isReady = revisionStatus === "confirmed";
  const blocking = releaseAction === "submit_review" && !isReady;
  const detail = isReady
    ? "表格证据状态已确认。"
    : `表格证据状态未确认${revisionStatus ? `：${revisionStatus}` : "：未加载"}`;

  return {
    blockId: block.id,
    blockType: block.block_type,
    orderNo: block.order_no,
    title: `Word 表格证据 #${block.order_no + 1}`,
    statusLabel: formatKnowledgeLibraryEvidenceStatusLabel({
      releaseAction,
      blocking,
      isReady,
    }),
    detail: formatKnowledgeLibraryNonBlockingDetail({
      releaseAction,
      isReady,
      detail,
    }),
    blocking,
  };
}

function createKnowledgeLibraryImageEvidenceGateItem(
  block: KnowledgeContentBlockViewModel,
  releaseAction: KnowledgeLibraryEvidenceGateAction,
): KnowledgeLibraryEvidenceGateItem | null {
  if (!requiresKnowledgeLibraryVisualSymbolEvidenceGate(block)) {
    return null;
  }

  const payload = asKnowledgeLibraryOptionalRecord(block.content_payload) ?? {};
  const understanding = asKnowledgeLibraryOptionalRecord(block.image_understanding);
  const failures = collectKnowledgeLibraryImageEvidenceFailures(
    payload,
    understanding,
    releaseAction,
  );
  const blocking = releaseAction === "submit_review" && failures.length > 0;
  const detail =
    failures.length > 0
      ? failures.join(" / ")
      : "视觉符号证据已结构化，可提交审核。";

  return {
    blockId: block.id,
    blockType: block.block_type,
    orderNo: block.order_no,
    title: `图片块 #${block.order_no + 1}`,
    statusLabel: formatKnowledgeLibraryEvidenceStatusLabel({
      releaseAction,
      blocking,
      isReady: failures.length === 0,
    }),
    detail: formatKnowledgeLibraryNonBlockingDetail({
      releaseAction,
      isReady: failures.length === 0,
      detail,
    }),
    blocking,
  };
}

function formatKnowledgeLibraryEvidenceStatusLabel(input: {
  releaseAction: KnowledgeLibraryEvidenceGateAction;
  blocking: boolean;
  isReady: boolean;
}): string {
  if (input.blocking) {
    return "阻断提交审核";
  }

  if (input.releaseAction === "submit_review") {
    return "可提交审核";
  }

  if (!input.isReady) {
    return input.releaseAction === "confirm_entry" ? "可先录入台账" : "草稿可保存";
  }

  return input.releaseAction === "confirm_entry" ? "可录入台账" : "草稿可保存";
}

function formatKnowledgeLibraryNonBlockingDetail(input: {
  releaseAction: KnowledgeLibraryEvidenceGateAction;
  isReady: boolean;
  detail: string;
}): string {
  if (input.isReady || input.releaseAction === "submit_review") {
    return input.detail;
  }

  const prefix =
    input.releaseAction === "confirm_entry"
      ? "当前可先录入台账，提交审核前仍需补齐："
      : "当前可先存草稿，提交审核前仍需补齐：";
  return `${prefix}${input.detail}`;
}

function requiresKnowledgeLibraryTableEvidenceGate(
  block: KnowledgeContentBlockViewModel,
): boolean {
  return block.block_type === "table_block";
}

function requiresKnowledgeLibraryVisualSymbolEvidenceGate(
  block: KnowledgeContentBlockViewModel,
): boolean {
  if (block.block_type !== "image_block") {
    return false;
  }

  const payload = asKnowledgeLibraryOptionalRecord(block.content_payload);
  const understanding = asKnowledgeLibraryOptionalRecord(block.image_understanding);
  const sourceKind =
    readKnowledgeLibraryRecordString(understanding, "source_kind") ||
    readKnowledgeLibraryRecordString(payload, "source_kind");

  return (
    readKnowledgeLibraryRecordString(understanding, "snapshot_type") ===
      "visual_symbol_snapshot" || isKnowledgeLibraryStructuredVisualSymbolSourceKind(sourceKind)
  );
}

function collectKnowledgeLibraryImageEvidenceFailures(
  payload: Record<string, unknown>,
  understanding: Record<string, unknown> | undefined,
  releaseAction: KnowledgeLibraryEvidenceGateAction,
): string[] {
  if (!understanding) {
    return ["缺少结构化视觉符号证据"];
  }

  const failures: string[] = [];
  const snapshotType = readKnowledgeLibraryRecordString(understanding, "snapshot_type");
  const sourceKind =
    readKnowledgeLibraryRecordString(understanding, "source_kind") ||
    readKnowledgeLibraryRecordString(payload, "source_kind");
  const reviewState = readKnowledgeLibraryRecordString(understanding, "review_state");
  const localContext = readKnowledgeLibraryRecordString(understanding, "local_context");
  const nearbyText = readKnowledgeLibraryRecordString(understanding, "nearby_text");
  const imageId =
    readKnowledgeLibraryRecordString(understanding, "image_id") ||
    readKnowledgeLibraryRecordString(payload, "upload_id") ||
    readKnowledgeLibraryRecordString(payload, "storage_key") ||
    readKnowledgeLibraryRecordString(payload, "file_name");

  if (snapshotType !== "visual_symbol_snapshot") {
    failures.push("未标记为视觉符号快照");
  }
  if (!isKnowledgeLibraryStructuredVisualSymbolSourceKind(sourceKind)) {
    failures.push("证据类型未确认");
  }
  if (imageId.length === 0) {
    failures.push("缺少图片文件");
  }
  if (localContext.length === 0 && nearbyText.length === 0) {
    failures.push("缺少局部上下文或邻近文本");
  }
  if (
    releaseAction === "submit_review" &&
    reviewState !== "pending_review" &&
    reviewState !== "confirmed"
  ) {
    failures.push("审核状态无效");
  }

  return failures;
}

function isKnowledgeLibraryStructuredVisualSymbolSourceKind(value: string): boolean {
  return (
    value === "inline_symbol_image" ||
    value === "equation_fragment_image" ||
    value === "table_embedded_symbol"
  );
}

function formatKnowledgeLibraryEvidenceGateActionLabel(
  value: KnowledgeLibraryEvidenceGateAction,
): string {
  switch (value) {
    case "submit_review":
      return "提交审核";
    case "confirm_entry":
      return "录入台账";
    case "save_draft":
    default:
      return "保存草稿";
  }
}

function formatKnowledgeLibraryTableFailureCodeLabel(value: string): string {
  switch (value) {
    case "unsupported_capture_environment":
      return "不在受支持的 exact-capture 环境";
    case "missing_required_clipboard_flavor":
      return "缺少 HTML 剪贴板";
    case "table_structure_incomplete":
      return "表格结构不完整";
    case "merged_cell_map_incomplete":
      return "合并单元格信息不完整";
    case "caption_or_note_position_unknown":
      return "表题或表注位置不明确";
    case "border_profile_incomplete":
      return "边框轮廓不完整";
    case "alignment_profile_incomplete":
      return "对齐轮廓不完整";
    case "run_style_incomplete":
      return "字形强调信息不完整";
    case "exact_capture_not_authoritative":
      return "不是权威 exact-capture";
    default:
      return value;
  }
}

function asKnowledgeLibraryOptionalRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readKnowledgeLibraryRecordString(
  value: Record<string, unknown> | undefined,
  key: string,
): string {
  const candidate = value?.[key];
  return typeof candidate === "string" ? candidate : "";
}

function readKnowledgeLibraryRecordStringArray(
  value: Record<string, unknown> | undefined,
  key: string,
): string[] {
  const candidate = value?.[key];
  return Array.isArray(candidate)
    ? candidate
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0)
    : [];
}

function uniqueKnowledgeLibraryStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}
