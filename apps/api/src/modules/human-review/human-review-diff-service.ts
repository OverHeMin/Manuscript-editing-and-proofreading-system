import { randomUUID } from "node:crypto";
import type {
  HumanReviewComplexityFlag,
  HumanReviewDiffLocation,
  HumanReviewDiffSource,
} from "@medical/contracts";
import type { HumanReviewDiffRecord } from "./human-review-record.ts";

export type HumanReviewComparableBlockKind =
  | "paragraph"
  | "heading"
  | "table_cell"
  | "table"
  | "image"
  | "caption"
  | "reference_entry";

export interface HumanReviewComparableBlock {
  key?: string;
  kind: HumanReviewComparableBlockKind;
  text: string;
  block_index?: number;
  section_label?: string;
  table_id?: string;
  row_key?: string;
  column_key?: string;
}

export interface ExtractHumanReviewDiffInput {
  manuscriptId: string;
  module: "proofreading" | "editing";
  baselineAssetId: string;
  workingAssetId: string;
  baselineBlocks: readonly HumanReviewComparableBlock[];
  workingBlocks: readonly HumanReviewComparableBlock[];
  extractionRevision?: number;
}

export interface ExtractHumanReviewDiffResult {
  items: HumanReviewDiffRecord[];
}

export interface HumanReviewDiffServiceOptions {
  createId?: () => string;
  now?: () => Date;
}

interface PairedDiff {
  source: HumanReviewDiffSource;
  baseline?: HumanReviewComparableBlock;
  working?: HumanReviewComparableBlock;
}

export class HumanReviewDiffService {
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: HumanReviewDiffServiceOptions = {}) {
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  extractDiffItems(
    input: ExtractHumanReviewDiffInput,
  ): ExtractHumanReviewDiffResult {
    const timestamp = this.now().toISOString();
    const diffs = pairComparableBlocks(input);

    return {
      items: diffs.map((diff) =>
        this.createDiffItem({
          input,
          diff,
          timestamp,
        }),
      ),
    };
  }

  private createDiffItem(options: {
    input: ExtractHumanReviewDiffInput;
    diff: PairedDiff;
    timestamp: string;
  }): HumanReviewDiffRecord {
    const { input, diff, timestamp } = options;
    const beforeText = diff.baseline?.text ?? "";
    const afterText = diff.working?.text ?? "";
    const anchorBlock = diff.working ?? diff.baseline;
    const complexityFlags = resolveComplexityFlags(diff);
    const safe = complexityFlags.length === 0;

    return {
      id: this.createId(),
      module: input.module,
      manuscript_id: input.manuscriptId,
      baseline_asset_id: input.baselineAssetId,
      working_asset_id: input.workingAssetId,
      source: diff.source,
      content_decision: "unconfirmed",
      governance_intents: {
        rule_candidate: false,
        knowledge_candidate: false,
      },
      apply_capability: safe ? "auto_apply_revert" : "unsafe_needs_manual_review",
      status: safe ? "pending" : "blocks_publish",
      before_text: beforeText,
      after_text: afterText,
      ...(safe ? {} : { complexity_flags: complexityFlags }),
      ...(safe
        ? {}
        : {
            summary: createUnsafeSummary(complexityFlags),
          }),
      ...(anchorBlock
        ? {
            location: createDiffLocation(anchorBlock, beforeText, afterText),
          }
        : {}),
      ...(input.extractionRevision !== undefined
        ? { extraction_revision: input.extractionRevision }
        : {}),
      created_at: timestamp,
      updated_at: timestamp,
    };
  }
}

function pairComparableBlocks(input: ExtractHumanReviewDiffInput): PairedDiff[] {
  const baselineByKey = new Map<string, HumanReviewComparableBlock>();
  const workingByKey = new Map<string, HumanReviewComparableBlock>();

  input.baselineBlocks.forEach((block, index) => {
    baselineByKey.set(resolveBlockKey(block, index), block);
  });
  input.workingBlocks.forEach((block, index) => {
    workingByKey.set(resolveBlockKey(block, index), block);
  });

  const result: PairedDiff[] = [];
  for (const [key, baseline] of baselineByKey.entries()) {
    const working = workingByKey.get(key);
    if (!working) {
      result.push({ source: "human_reverted_ai", baseline });
      continue;
    }

    if (baseline.kind !== working.kind || baseline.text !== working.text) {
      result.push({ source: "human_overrode_ai", baseline, working });
    }
  }

  for (const [key, working] of workingByKey.entries()) {
    if (!baselineByKey.has(key)) {
      result.push({ source: "human_added", working });
    }
  }

  return result;
}

function resolveBlockKey(
  block: HumanReviewComparableBlock,
  index: number,
): string {
  if (block.key?.trim()) {
    return block.key.trim();
  }

  if (block.kind === "table_cell") {
    return [
      block.kind,
      block.table_id ?? "table",
      block.row_key ?? "row",
      block.column_key ?? "column",
    ].join(":");
  }

  return `${block.kind}:${block.block_index ?? index}`;
}

function resolveComplexityFlags(
  diff: PairedDiff,
): HumanReviewComplexityFlag[] {
  const kinds = [diff.baseline?.kind, diff.working?.kind].filter(
    (kind): kind is HumanReviewComparableBlockKind => kind !== undefined,
  );
  const flags = new Set<HumanReviewComplexityFlag>();

  for (const kind of kinds) {
    switch (kind) {
      case "paragraph":
      case "heading":
      case "table_cell":
        break;
      case "table":
        flags.add("table_structure");
        break;
      case "image":
      case "caption":
        flags.add("image_caption");
        break;
      case "reference_entry":
        flags.add("reference");
        break;
    }
  }

  return [...flags];
}

function createDiffLocation(
  block: HumanReviewComparableBlock,
  beforeText: string,
  afterText: string,
): HumanReviewDiffLocation {
  return {
    anchor_kind: block.kind,
    ...(block.block_index !== undefined ? { block_index: block.block_index } : {}),
    ...(block.section_label ? { section_label: block.section_label } : {}),
    ...(block.table_id ? { table_id: block.table_id } : {}),
    ...(block.row_key ? { row_key: block.row_key } : {}),
    ...(block.column_key ? { column_key: block.column_key } : {}),
    quote: afterText || beforeText,
  };
}

function createUnsafeSummary(flags: readonly HumanReviewComplexityFlag[]): string {
  return `Unsupported document structure change requires manual review: ${flags.join(
    ", ",
  )}.`;
}
