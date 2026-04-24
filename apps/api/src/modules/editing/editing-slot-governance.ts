import type {
  EditingMetadataCandidate,
  EditingMetadataSourceZone,
  EditingSlotGovernanceSummary,
  EditingSlotManualResolution,
  EditingSlotResolutionSummary,
} from "@medical/contracts";
import type { DocumentStructureSnapshot } from "../document-pipeline/document-structure-service.ts";
import { buildMetadataCandidatesFromBlocks } from "../document-pipeline/docx-metadata-hunter.ts";
import type { EditorialTextBlock } from "../editorial-execution/types.ts";
import type {
  JournalFormatTargetBlock,
  JournalFormatTargetModel,
} from "../templates/template-record.ts";

const RESOLVED_STATES = new Set(["resolved_auto", "resolved_manual"]);

export function buildEditingSlotGovernanceSummary(input: {
  journalTemplateId?: string;
  targetModelVersionId?: string;
  targetModelVersionNo?: number;
  targetModel?: JournalFormatTargetModel;
  sourceBlocks: EditorialTextBlock[];
  documentStructureSnapshot?: DocumentStructureSnapshot;
  previousSummary?: EditingSlotGovernanceSummary;
  generatedAt: string;
}): EditingSlotGovernanceSummary {
  const manualResolutions = filterRelevantManualResolutions(
    input.previousSummary?.manual_resolutions,
  );
  if (!input.targetModel) {
    return {
      observation_status: "failed_open",
      journal_template_id: input.journalTemplateId,
      target_model_version_id: input.targetModelVersionId,
      target_model_version_no: input.targetModelVersionNo,
      generated_at: input.generatedAt,
      unresolved_required_count: 0,
      blocking_slot_keys: [],
      slots: [],
      ...(manualResolutions.length > 0 ? { manual_resolutions: manualResolutions } : {}),
      error: "Current manuscript does not have a published journal target model for slot governance.",
    };
  }

  const metadataBlocks = input.targetModel.target_blocks
    .filter((block) => block.enabled)
    .filter(isMetadataGovernedBlock)
    .sort((left, right) => left.order - right.order);
  const candidateSource =
    input.documentStructureSnapshot?.metadata_candidates?.length
      ? input.documentStructureSnapshot.metadata_candidates
      : buildMetadataCandidatesFromBlocks(input.sourceBlocks);
  const slots = metadataBlocks.map((block) =>
    resolveSlotSummary({
      block,
      candidates: candidateSource.filter((candidate) => candidate.slot_key === block.block_key),
      manualResolution: manualResolutions.find(
        (resolution) => resolution.slot_key === block.block_key,
      ),
    }),
  );
  const blockingSlots = slots.filter((slot) => isBlockingSlot(slot));

  return {
    observation_status: "reported",
    journal_template_id: input.journalTemplateId,
    target_model_version_id: input.targetModelVersionId,
    target_model_version_no: input.targetModelVersionNo,
    generated_at: input.generatedAt,
    unresolved_required_count: slots.filter(
      (slot) => slot.required && !RESOLVED_STATES.has(slot.state),
    ).length,
    blocking_slot_keys: blockingSlots.map((slot) => slot.slot_key),
    slots,
    ...(manualResolutions.length > 0 ? { manual_resolutions: manualResolutions } : {}),
  };
}

function resolveSlotSummary(input: {
  block: JournalFormatTargetBlock;
  candidates: EditingMetadataCandidate[];
  manualResolution?: EditingSlotManualResolution;
}): EditingSlotResolutionSummary {
  const dedupedCandidates = dedupeCandidates(input.candidates);
  if (input.manualResolution) {
    return {
      slot_key: input.block.block_key,
      label: input.block.label,
      required: input.block.required,
      enabled: input.block.enabled,
      zone: input.block.zone,
      anchor: input.block.anchor,
      completion_gate: input.block.completion_gate,
      state: "resolved_manual",
      resolution_reason: "已回放人工槽位裁决。",
      ...(resolveManualResolutionText(input.manualResolution, dedupedCandidates)
        ? {
            resolved_text: resolveManualResolutionText(
              input.manualResolution,
              dedupedCandidates,
            ),
          }
        : {}),
      candidate_count: dedupedCandidates.length,
      candidates: dedupedCandidates,
      manual_resolution: structuredClone(input.manualResolution),
    };
  }

  if (dedupedCandidates.length === 0) {
    return {
      slot_key: input.block.block_key,
      label: input.block.label,
      required: input.block.required,
      enabled: input.block.enabled,
      zone: input.block.zone,
      anchor: input.block.anchor,
      completion_gate: input.block.completion_gate,
      state: "missing",
      resolution_reason: "未在正文前置区、页眉页脚或声明区找到可用候选。",
      candidate_count: 0,
      candidates: [],
    };
  }

  if (dedupedCandidates.length > 1) {
    return {
      slot_key: input.block.block_key,
      label: input.block.label,
      required: input.block.required,
      enabled: input.block.enabled,
      zone: input.block.zone,
      anchor: input.block.anchor,
      completion_gate: input.block.completion_gate,
      state: "conflicted_candidates",
      resolution_reason: `识别到 ${dedupedCandidates.length} 个冲突候选，需人工裁决。`,
      candidate_count: dedupedCandidates.length,
      candidates: dedupedCandidates,
    };
  }

  const [candidate] = dedupedCandidates;
  if (candidate.confidence < 0.85) {
    return {
      slot_key: input.block.block_key,
      label: input.block.label,
      required: input.block.required,
      enabled: input.block.enabled,
      zone: input.block.zone,
      anchor: input.block.anchor,
      completion_gate: input.block.completion_gate,
      state: "low_confidence_pending_review",
      resolution_reason: "候选存在但置信度不足，不能直接自动落位。",
      candidate_count: 1,
      candidates: dedupedCandidates,
    };
  }

  if (!isCandidateAlignedToAnchor(candidate, input.block)) {
    if (
      input.block.format_policy.allow_auto_reorder &&
      candidate.recommended_action === "auto_place_candidate" &&
      candidate.source_zone !== "header" &&
      candidate.source_zone !== "footer"
    ) {
      return {
        slot_key: input.block.block_key,
        label: input.block.label,
        required: input.block.required,
        enabled: input.block.enabled,
        zone: input.block.zone,
        anchor: input.block.anchor,
        completion_gate: input.block.completion_gate,
        state: "resolved_auto",
        resolution_reason: "识别到错位候选，并按目标锚点自动归位。",
        resolved_text: candidate.raw_text,
        candidate_count: 1,
        candidates: dedupedCandidates,
      };
    }

    return {
      slot_key: input.block.block_key,
      label: input.block.label,
      required: input.block.required,
      enabled: input.block.enabled,
      zone: input.block.zone,
      anchor: input.block.anchor,
      completion_gate: input.block.completion_gate,
      state: "recognized_misplaced",
      resolution_reason: "已识别候选，但当前位于非目标锚点区域。",
      resolved_text: candidate.raw_text,
      candidate_count: 1,
      candidates: dedupedCandidates,
    };
  }

  return {
    slot_key: input.block.block_key,
    label: input.block.label,
    required: input.block.required,
    enabled: input.block.enabled,
    zone: input.block.zone,
    anchor: input.block.anchor,
    completion_gate: input.block.completion_gate,
    state: "resolved_auto",
    resolution_reason: "候选唯一且与目标锚点一致，已自动确认。",
    resolved_text: candidate.raw_text,
    candidate_count: 1,
    candidates: dedupedCandidates,
  };
}

function isMetadataGovernedBlock(block: JournalFormatTargetBlock): boolean {
  return (
    block.zone === "front_matter" ||
    block.block_key === "classification_code" ||
    block.block_key === "document_code"
  );
}

function dedupeCandidates(
  candidates: EditingMetadataCandidate[],
): EditingMetadataCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.slot_key}:${candidate.normalized_text}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isCandidateAlignedToAnchor(
  candidate: EditingMetadataCandidate,
  block: JournalFormatTargetBlock,
): boolean {
  const preferredZones = resolvePreferredSourceZones(block.anchor);
  return preferredZones.includes(candidate.source_zone);
}

function resolvePreferredSourceZones(
  anchor: JournalFormatTargetBlock["anchor"],
): EditingMetadataSourceZone[] {
  switch (anchor) {
    case "header_zone":
      return ["header"];
    case "footer_zone":
      return ["footer"];
    case "after_abstract":
    case "after_keywords":
      return ["abstract_neighborhood"];
    case "before_title":
      return ["front_matter", "title_area"];
    case "after_title":
    case "after_author_line":
    case "after_affiliation_line":
      return ["title_area", "front_matter"];
    case "before_body":
      return ["title_area", "front_matter", "abstract_neighborhood"];
    default:
      return [
        "front_matter",
        "title_area",
        "abstract_neighborhood",
        "document_tail",
        "suspicious_nearby_paragraph",
      ];
  }
}

function isBlockingSlot(slot: EditingSlotResolutionSummary): boolean {
  if (!slot.enabled) {
    return false;
  }

  if (slot.completion_gate === "warn_only") {
    return false;
  }

  if (slot.completion_gate === "block_on_missing") {
    return slot.state === "missing";
  }

  return !RESOLVED_STATES.has(slot.state);
}

function filterRelevantManualResolutions(
  value: EditingSlotGovernanceSummary["manual_resolutions"] | undefined,
): EditingSlotManualResolution[] {
  return (value ?? []).map((entry) => structuredClone(entry));
}

export function applyEditingSlotManualResolution(input: {
  summary: EditingSlotGovernanceSummary;
  resolution: EditingSlotManualResolution;
  generatedAt?: string;
}): EditingSlotGovernanceSummary {
  const resolution = structuredClone(input.resolution);
  const manualResolutions = [
    ...filterRelevantManualResolutions(input.summary.manual_resolutions).filter(
      (entry) => entry.slot_key !== resolution.slot_key,
    ),
    resolution,
  ];
  const slots = input.summary.slots.map((slot) => {
    if (slot.slot_key !== resolution.slot_key) {
      return structuredClone(slot);
    }

    const resolvedText = resolveManualResolutionText(resolution, slot.candidates);
    return {
      ...structuredClone(slot),
      state: "resolved_manual" as const,
      resolution_reason: buildManualResolutionReason(resolution.resolution_kind),
      ...(resolvedText ? { resolved_text: resolvedText } : {}),
      ...(!resolvedText && slot.resolved_text ? { resolved_text: undefined } : {}),
      manual_resolution: resolution,
    };
  });
  const blockingSlots = slots.filter((slot) => isBlockingSlot(slot));

  return {
    ...structuredClone(input.summary),
    ...(input.generatedAt ? { generated_at: input.generatedAt } : {}),
    unresolved_required_count: slots.filter(
      (slot) => slot.required && !RESOLVED_STATES.has(slot.state),
    ).length,
    blocking_slot_keys: blockingSlots.map((slot) => slot.slot_key),
    slots,
    manual_resolutions: manualResolutions,
  };
}

function resolveManualResolutionText(
  manualResolution: EditingSlotManualResolution,
  candidates: EditingMetadataCandidate[],
): string | undefined {
  if (manualResolution.resolved_text) {
    return manualResolution.resolved_text;
  }

  if (!manualResolution.selected_candidate_id) {
    return undefined;
  }

  return candidates.find(
    (candidate) => candidate.candidate_id === manualResolution.selected_candidate_id,
  )?.raw_text;
}

function buildManualResolutionReason(
  resolutionKind: EditingSlotManualResolution["resolution_kind"],
): string {
  switch (resolutionKind) {
    case "picked_candidate":
      return "已记录人工槽位裁决，并采用指定候选。";
    case "manual_entry":
      return "已记录人工槽位裁决，并采用人工录入内容。";
    case "waived":
      return "已记录人工槽位豁免，不再阻断后续流程。";
    default:
      return "已记录人工槽位裁决。";
  }
}
