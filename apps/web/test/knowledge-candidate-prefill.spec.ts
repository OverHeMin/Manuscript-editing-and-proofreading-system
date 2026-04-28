import assert from "node:assert/strict";
import test from "node:test";
import {
  buildKnowledgeLibraryPrefillFromLearningCandidate,
} from "../src/features/knowledge-library/knowledge-candidate-prefill.ts";
import {
  createLedgerComposerFromKnowledgeCandidatePrefill,
  createLedgerComposerFromKnowledgeRevision,
} from "../src/features/knowledge-library/knowledge-library-ledger-composer.ts";
import type { LearningCandidateViewModel } from "../src/features/learning-review/types.ts";
import type { KnowledgeRevisionViewModel } from "../src/features/knowledge-library/types.ts";

test("knowledge candidate prefill preserves full draft fields, semantic layer, and source evidence", () => {
  const candidate: LearningCandidateViewModel = {
    id: "candidate-knowledge-1",
    type: "knowledge_candidate",
    status: "pending_review",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    manuscript_type: "clinical_study",
    governed_provenance_kind: "human_feedback",
    snapshot_asset_id: "snapshot-1",
    human_final_asset_id: "human-final-1",
    title: "表注处理经验",
    proposal_text: "表注应置于表下并保留统计缩写解释。",
    candidate_payload: {
      before_fragment: "表注散落在正文中。",
      after_fragment: "表注统一置于表下，解释 SD、CI 等缩写。",
      evidence_summary: "人工校对确认该处理方式可复用于同类临床研究表格。",
      knowledge_prefill: {
        title: "临床研究表注处理",
        canonical_text: "临床研究表格的表注应置于表下，并解释统计缩写。",
        summary: "用于校对阶段的表注规范。",
        knowledge_kind: "reference",
        sections: ["tables"],
        risk_tags: ["table_quality"],
        discipline_tags: ["clinical_study"],
        aliases: ["表注规范", "table footnote"],
        evidence_level: "expert_opinion",
        source_type: "internal_case",
      },
      ai_semantic_suggestion: {
        page_summary: "表注规范和统计缩写解释。",
        retrieval_terms: ["表注", "统计缩写", "三线表"],
        retrieval_snippets: ["表注置于表下", "解释 SD 和 CI"],
      },
    },
    created_by: "proofreader-1",
    created_at: "2026-04-28T08:00:00.000Z",
    updated_at: "2026-04-28T08:00:00.000Z",
  };

  const prefill = buildKnowledgeLibraryPrefillFromLearningCandidate(candidate);
  const composer = createLedgerComposerFromKnowledgeCandidatePrefill(prefill);

  assert.equal(prefill.sourceLearningCandidateId, "candidate-knowledge-1");
  assert.equal(composer.sourceLearningCandidateId, "candidate-knowledge-1");
  assert.equal(composer.draft.sourceLearningCandidateId, "candidate-knowledge-1");
  assert.equal(composer.draft.title, "临床研究表注处理");
  assert.equal(
    composer.draft.canonicalText,
    "临床研究表格的表注应置于表下，并解释统计缩写。",
  );
  assert.equal(composer.draft.summary, "用于校对阶段的表注规范。");
  assert.equal(composer.draft.knowledgeKind, "reference");
  assert.equal(composer.draft.moduleScope, "proofreading");
  assert.deepEqual(composer.draft.manuscriptTypes, ["clinical_study"]);
  assert.deepEqual(composer.draft.sections, ["tables"]);
  assert.deepEqual(composer.draft.riskTags, ["table_quality"]);
  assert.deepEqual(composer.draft.disciplineTags, ["clinical_study"]);
  assert.deepEqual(composer.draft.aliases, ["表注规范", "table footnote"]);
  assert.equal(composer.draft.evidenceLevel, "expert_opinion");
  assert.equal(composer.draft.sourceType, "internal_case");
  assert.equal(composer.contentBlocksDraft[0]?.block_type, "text_block");
  assert.match(
    String(composer.contentBlocksDraft[0]?.content_payload.text),
    /人工校对确认该处理方式/u,
  );
  assert.equal(composer.semanticLayerDraft?.status, "pending_confirmation");
  assert.deepEqual(composer.semanticLayerDraft?.retrieval_terms, [
    "表注",
    "统计缩写",
    "三线表",
  ]);
  assert.equal(composer.sourceSummary?.manuscriptId, "manuscript-1");
  assert.equal(composer.sourceSummary?.sourceAssetId, "snapshot-1");
});

test("knowledge revisions rehydrate source learning candidate ids into the composer", () => {
  const revision: KnowledgeRevisionViewModel = {
    id: "knowledge-1-revision-1",
    asset_id: "knowledge-1",
    revision_no: 1,
    status: "draft",
    title: "Knowledge from candidate",
    canonical_text: "Confirmed reusable handling.",
    knowledge_kind: "reference",
    routing: {
      module_scope: "proofreading",
      manuscript_types: ["clinical_study"],
    },
    source_learning_candidate_id: "candidate-knowledge-1",
    content_blocks: [],
    semantic_layer: {
      revision_id: "knowledge-1-revision-1",
      status: "not_generated",
    },
    bindings: [],
    created_at: "2026-04-28T08:00:00.000Z",
    updated_at: "2026-04-28T08:00:00.000Z",
  };

  const composer = createLedgerComposerFromKnowledgeRevision(
    revision,
    "knowledge-1",
  );

  assert.equal(composer.persistedAssetId, "knowledge-1");
  assert.equal(composer.persistedRevisionId, "knowledge-1-revision-1");
  assert.equal(composer.sourceLearningCandidateId, "candidate-knowledge-1");
  assert.equal(composer.draft.sourceLearningCandidateId, "candidate-knowledge-1");
});
