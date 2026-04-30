import type { ProofreadingIssue } from "./proofreading-issue-contract.ts";
import type { ProofreadingDeepPassKind } from "./proofreading-pass-run-record.ts";
import type {
  AiReadableTablePayload,
  TableEvidenceFidelityReport,
} from "../document-pipeline/table-evidence-record.ts";

export type DeepProofreadingStageKind =
  | "document_structure_extraction"
  | "semantic_pre_analysis"
  | "global_fact_ledger_generation"
  | "final_regression_preparation";

export type DeepProofreadingPassKind =
  | ProofreadingDeepPassKind
  | DeepProofreadingStageKind;

export type DeepProofreadingSliceKind =
  | "table"
  | "data"
  | "consistency"
  | "language_format"
  | "medical_fact"
  | "residual";

export type DeepProofreadingConfidence = "high" | "medium" | "low";

export interface DeepProofreadingSliceEvidence {
  kind:
    | "block"
    | "section"
    | "table"
    | "table_cell"
    | "fact"
    | "knowledge"
    | "rule";
  id: string;
  label?: string;
}

export interface DeepProofreadingSlice {
  id: string;
  sliceKind: DeepProofreadingSliceKind;
  passKinds: ProofreadingDeepPassKind[];
  sourceBlockIndexes: number[];
  tableIds?: string[];
  tableEvidence?: {
    snapshotId: string;
    tableId: string;
    aiReadableTablePayload: AiReadableTablePayload;
    fidelityReport: TableEvidenceFidelityReport;
  };
  text: string;
  evidence: DeepProofreadingSliceEvidence[];
}

export interface DeepProofreadingFactSource {
  sourceKind:
    | "block"
    | "table"
    | "table_cell"
    | "object"
    | "semantic_entity"
    | "manual_review";
  blockIndex?: number;
  tableId?: string;
  anchorKey?: string;
  quote?: string;
}

export interface DeepProofreadingFact {
  id: string;
  kind: string;
  label: string;
  value: string;
  normalizedValue?: string;
  unit?: string;
  confidence: DeepProofreadingConfidence;
  source: DeepProofreadingFactSource;
}

export interface DeepProofreadingFactConflict {
  id: string;
  factIds: string[];
  kind: string;
  description: string;
  confidence: DeepProofreadingConfidence;
}

export interface DeepProofreadingFactLedger {
  schema: "deep_proofreading_fact_ledger.v1";
  facts: DeepProofreadingFact[];
  conflicts: DeepProofreadingFactConflict[];
  diagnostics: {
    factCount: number;
    conflictCount: number;
  };
}

export interface DeepProofreadingRuleSelection {
  ruleId: string;
  passKind: ProofreadingDeepPassKind;
  sliceId?: string;
  score: number;
  reasons: string[];
}

export interface DeepProofreadingKnowledgeSelection {
  knowledgeItemId: string;
  passKind: ProofreadingDeepPassKind;
  sliceId?: string;
  title?: string;
  summary?: string;
  promptSnippet?: string;
  score: number;
  reasons: string[];
  estimatedTokens?: number;
}

export interface DeepProofreadingBudgetDecision {
  itemId: string;
  itemKind: "rule" | "knowledge";
  decision: "selected" | "excluded";
  reasons: string[];
  estimatedTokens?: number;
}

export interface DeepProofreadingIssueCard extends ProofreadingIssue {
  passKind: DeepProofreadingPassKind;
  sliceId?: string;
  relatedFactIds: string[];
  relatedRuleIds?: string[];
  relatedKnowledgeItemIds?: string[];
  confidence?: DeepProofreadingConfidence;
  supportingEvidence: DeepProofreadingSliceEvidence[];
  conflictFlags: string[];
}

export interface DeepProofreadingPassDiagnostic {
  passKind: DeepProofreadingPassKind;
  status: "completed" | "failed" | "skipped";
  sliceId?: string;
  durationMs?: number;
  issueCount?: number;
  fallbackReason?: string;
}

export interface DeepProofreadingDiagnostics {
  passCounts: {
    completed: number;
    failed: number;
    skipped: number;
  };
  sliceCounts: Partial<Record<DeepProofreadingSliceKind, number>>;
  selectedRuleCounts: {
    total: number;
    byPassKind?: Partial<Record<ProofreadingDeepPassKind, number>>;
  };
  selectedKnowledgeCounts: {
    total: number;
    byPassKind?: Partial<Record<ProofreadingDeepPassKind, number>>;
  };
  tableConfidenceCounts: Record<DeepProofreadingConfidence, number>;
  tokenEstimates: {
    prompt: number;
    completion: number;
  };
  modelCallEstimates: {
    total: number;
  };
  fallbackReasons: string[];
}
