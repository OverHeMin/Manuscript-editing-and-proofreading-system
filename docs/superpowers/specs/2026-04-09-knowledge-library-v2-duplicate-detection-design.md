# Knowledge Library V2 Duplicate Detection Design

**Date**

2026-04-09

**Goal**

Add V2 duplicate detection to the knowledge authoring flow so authors see likely duplicate knowledge assets while drafting and before review submission, without blocking submission by default.

## Final Design Decisions

- V2 focuses on `duplicate detection during authoring`, not a full merge console.
- Duplicate warnings appear inside `knowledge-library`, not in a separate governance workbench.
- Submission remains allowed after warning acknowledgement.
- Detection is server-side, using explainable rules rather than embeddings.
- Matching is grouped by `knowledge_asset`, not by individual revisions in the UI.
- The system records duplicate-warning acknowledgement for auditability.
- Real merge operations, bulk duplicate queues, and clustering stay out of V2.1.

## Product Shape

V2 extends the existing standalone knowledge authoring workbench:

- Authors see duplicate signals while editing a draft.
- Authors see an updated duplicate summary after save.
- Authors see a final duplicate warning before `Submit To Review`.
- If strong matches exist, authors can:
  - open the existing asset
  - continue anyway

The system should help authors avoid accidental duplicate creation, but it should not freeze progress when the author intentionally needs a separate asset.

## Scope

### In Scope

- Server-side duplicate-check API for knowledge draft content
- Authoring-side duplicate panel in `knowledge-library`
- Pre-submit warning confirmation
- Audit trail for warning acknowledgement
- Explainable duplicate reasons
- Rule-based similarity tiers: `exact`, `high`, `possible`

### Out Of Scope

- Automatic merge
- Bulk merge
- Standalone duplicate review queue
- Full historical clustering job
- Embedding-based retrieval or vector search
- Runtime retrieval changes

## UX Design

Duplicate detection lives in the authoring workbench, near the draft editor:

1. A lightweight inline status row shows:
   - `Not checked`
   - `Checking duplicates...`
   - `No strong duplicate signals`
   - `N strong duplicate matches found`

2. A `Duplicate Signals` panel appears in the authoring column and groups results into:
   - `Exact Matches`
   - `High Similarity`
   - `Possible Overlap`

3. Each candidate card shows:
   - asset title
   - asset id
   - representative revision id
   - status
   - short summary
   - reason list
   - link to open the existing asset

4. On `Submit To Review`, if any `exact` or `high` matches exist, a confirmation layer appears with:
   - `Open Existing Asset`
   - `Continue Anyway`

`possible` matches do not block or trigger confirmation. They remain informational only.

## Detection Unit

The UI should not show multiple revisions from the same asset as separate duplicate results.

Detection is done per `knowledge_asset`:

- If the asset has an approved revision, compare against the current approved revision.
- Otherwise compare against the current working revision.

This keeps the result list stable and easier for authors to reason about.

## Detection Inputs

The duplicate-check request should use the current draft form data, not only library-summary data.

Recommended request fields:

- `currentAssetId?`
- `currentRevisionId?`
- `title`
- `canonicalText`
- `summary?`
- `knowledgeKind`
- `moduleScope`
- `manuscriptTypes`
- `sections?`
- `riskTags?`
- `disciplineTags?`
- `aliases?`
- `bindings?`

`currentAssetId` and `currentRevisionId` are used to exclude self-matches while editing an existing asset.

## API Design

### Duplicate Check

Add a new endpoint:

- `POST /api/v1/knowledge/duplicate-check`

Request:

- current draft content
- optional current asset/revision identifiers

Response:

- `matches: DuplicateKnowledgeMatch[]`

Suggested response shape:

```ts
interface DuplicateKnowledgeMatch {
  severity: "exact" | "high" | "possible";
  score: number;
  matched_asset_id: string;
  matched_revision_id: string;
  matched_title: string;
  matched_status: "draft" | "pending_review" | "approved" | "superseded" | "archived";
  matched_summary?: string;
  reasons: DuplicateKnowledgeReason[];
}

type DuplicateKnowledgeReason =
  | "canonical_text_exact_match"
  | "canonical_text_high_overlap"
  | "title_exact_match"
  | "title_high_similarity"
  | "alias_overlap"
  | "same_knowledge_kind"
  | "same_module_scope"
  | "manuscript_type_overlap"
  | "binding_overlap";
```

### Submission Acknowledgement

Keep the current submit route, but extend submission input with an optional acknowledgement payload, for example:

```ts
interface DuplicateWarningAcknowledgementInput {
  acknowledged: boolean;
  matched_asset_ids: string[];
}
```

This is not a hard gate. It exists so the system can record that the author saw strong duplicate warnings and chose to continue anyway.

## Matching Rules

V2.1 should use explainable rules only.

### Normalization

Normalize before comparison:

- trim leading and trailing whitespace
- collapse repeated whitespace
- lowercase Latin characters
- normalize punctuation
- normalize full-width and half-width characters where practical

### Severity Rules

#### Exact

Mark as `exact` when:

- normalized `canonical_text` is identical

or

- normalized `title` is identical
- `knowledge_kind` matches
- `module_scope` matches
- `manuscript_types` overlap strongly or are identical

#### High

Mark as `high` when a strong content match is combined with contextual overlap, such as:

- high canonical text overlap
- or high title or alias similarity plus scope overlap
- or binding overlap plus strong text similarity

#### Possible

Mark as `possible` when some context overlaps but evidence is not strong enough for a blocking warning, such as:

- title appears similar
- same module scope
- overlapping manuscript types
- partial alias or binding overlap

## Auditability

V2.1 should store acknowledgement records when strong duplicate signals were shown and the author still submitted.

Recommended minimum fields:

- `id`
- `revision_id`
- `matched_asset_ids`
- `highest_severity`
- `acknowledged_by_role`
- `created_at`

This can be implemented as a lightweight audit record. It does not need to be a full duplicate-merge domain model yet.

## Suggested Code Placement

### API

- `apps/api/src/modules/knowledge/knowledge-service.ts`
- `apps/api/src/modules/knowledge/knowledge-api.ts`
- `apps/api/src/modules/knowledge/knowledge-record.ts`
- `apps/api/src/modules/knowledge/knowledge-repository.ts`
- `apps/api/src/modules/knowledge/in-memory-knowledge-repository.ts`
- `apps/api/src/http/api-http-server.ts`

### Web

- `apps/web/src/features/knowledge-library/types.ts`
- `apps/web/src/features/knowledge-library/knowledge-library-api.ts`
- `apps/web/src/features/knowledge-library/knowledge-library-controller.ts`
- `apps/web/src/features/knowledge-library/knowledge-library-workbench-page.tsx`

### Tests

- `apps/api/test/knowledge/knowledge-governance.spec.ts`
- `apps/api/test/http/http-server.spec.ts`
- `apps/web/test/knowledge-library-controller.spec.ts`
- `apps/web/test/knowledge-library-workbench-page.spec.tsx`

## V2.1 / V2.2 Boundary

### V2.1 Must Deliver

- explainable duplicate-check API
- authoring-time duplicate signals
- pre-submit duplicate warning
- continue-anyway flow
- acknowledgement audit trail

### V2.2 Can Add Later

- dedicated duplicate-review queue
- operator merge decisions
- duplicate candidate history views
- bulk duplicate cleanup tools
- embedding-assisted similarity
- merge mutation with canonical survivor selection

## Acceptance Criteria

V2.1 is complete when:

- a new or edited draft can request duplicate candidates from the server
- duplicate results are grouped by asset
- duplicate cards explain why a candidate matched
- authors see strong warnings before review submission
- authors can still continue submission after acknowledgement
- acknowledgement is recorded for strong warnings
- current knowledge-library and knowledge-review flows continue to work without regression

## Risks And Guardrails

- Do not block submission by default in V2.1.
- Do not introduce opaque similarity scores without reasons.
- Do not surface every revision as a separate duplicate candidate.
- Do not expand into full merge workflows yet.
- Do not let duplicate detection change runtime retrieval behavior.
