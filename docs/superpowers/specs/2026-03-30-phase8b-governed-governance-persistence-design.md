# Phase 8B Governed Governance Persistence Design

## Goal

Build the first PostgreSQL-backed persistence layer for the governed review backbone so knowledge review, template governance, and learning writeback records stop depending on in-memory state.

## Scope

This phase covers the smallest durable governance slice that reduces later rework:

- knowledge items and knowledge review actions
- template families and module templates
- learning writeback records
- schema alignment for provenance fields required by governed draft creation
- targeted persistent runtime wiring for the review-oriented API surface

This phase does not cover:

- full manuscript, asset, and job persistence rework
- full learning candidate and reviewed snapshot runtime migration
- prompt template and skill package persistence
- final production release hardening for every API domain

## Confirmed Direction

Three implementation paths were considered:

1. Registry-first persistence for `knowledge + templates + writebacks`
2. Knowledge-only persistence first
3. Full multi-domain persistence across learning, assets, prompts, skills, and runtime registries

The recommended direction is `1`.

Reasoning:

- it closes the reviewer/admin governance chain that now powers the Web workbench and future mini-program review flow
- most of the base tables already exist in `0001_initial.sql`, so this path adds less schema churn than a broader migration
- it avoids mixing persistence work for reviewer registries with heavier manuscript/asset transaction concerns

## Current Gap

Phase 8A solved authentication, session durability, and the split between demo and persistent HTTP runtimes. The remaining mismatch is that the persistent runtime still serves governance data from in-memory repositories.

The code and schema are also not fully aligned:

- `knowledge_items` exists, but `knowledge_review_actions` does not
- `module_templates` exists, but `source_learning_candidate_id` is not stored
- `knowledge_items` also lacks `source_learning_candidate_id`
- `learning_writebacks` does not exist
- review history and writeback provenance are therefore not durable across restarts

## Product Shape

### Governance Storage Boundary

Phase 8B should make the following records durable:

1. `KnowledgeRecord`
2. `KnowledgeReviewActionRecord`
3. `TemplateFamilyRecord`
4. `ModuleTemplateRecord`
5. `LearningWritebackRecord`

These records form the core reviewer/admin governance path:

`approved learning candidate -> writeback draft -> knowledge/template draft -> review/publish path`

The durable storage goal is not to make every downstream registry production-ready in one pass. It is to make the governance history and draft registries stable first.

### Runtime Boundary

The persistent API runtime should start using PostgreSQL-backed repositories for the governance slice when running in non-demo mode.

The demo runtime remains unchanged:

- local-only
- in-memory
- seeded for browser QA

The persistent runtime should become mixed-mode temporarily:

- PostgreSQL-backed for auth/session/audit from Phase 8A
- PostgreSQL-backed for knowledge/template/writeback governance from Phase 8B
- existing in-memory implementations may remain for domains not yet migrated

This mixed-mode boundary is acceptable as long as it is explicit in code and docs.

## Data Model Changes

### Required Schema Additions

Additive schema changes should include:

- `knowledge_review_actions`
- `learning_writebacks`
- `source_learning_candidate_id` on `knowledge_items`
- `source_learning_candidate_id` on `module_templates`

Recommended indexes:

- `knowledge_review_actions_knowledge_item_id_created_at_idx`
- `learning_writebacks_candidate_target_status_idx`
- `module_templates_template_family_id_module_status_idx`

### Mapping Rules

Repository mapping should preserve the current service contracts exactly where possible:

- routing arrays remain arrays in code
- `manuscript_types = "any"` stays encoded explicitly instead of being silently collapsed
- optional review note, aliases, checklist, section requirements, and provenance fields stay additive
- repository reads must clone array fields so service callers cannot mutate cached state

## Implementation Shape

### Repository Adapters

Add PostgreSQL adapters instead of changing service-level APIs:

- `PostgresKnowledgeRepository`
- `PostgresKnowledgeReviewActionRepository`
- `PostgresTemplateFamilyRepository`
- `PostgresModuleTemplateRepository`
- `PostgresLearningGovernanceRepository`

The higher-level services should keep their current public methods so existing tests and clients stay stable.

### Transactions

The service layer already models write transaction boundaries. Phase 8B should preserve those boundaries and keep rollback-sensitive logic intact:

- knowledge status update + review action write
- template publish archive + publish write
- learning writeback apply + created draft asset id persistence

If PostgreSQL transaction orchestration is needed, it should be introduced as an additive transaction manager rather than buried inside repositories.

## Error Handling

Phase 8B should preserve current domain errors and HTTP semantics:

- missing governed records remain `404`
- invalid state transitions remain `409`
- permission violations remain `403`
- durable governance writes must not partially commit state when the companion audit/history record fails

## Testing Strategy

The phase should add database-backed tests in three layers:

1. schema coverage for new tables and columns
2. repository persistence tests for knowledge/template/writeback adapters
3. persistent HTTP tests for knowledge review routes that should now survive runtime restarts

The current in-memory tests should remain in place because they still protect service behavior independent of storage implementation.

## Acceptance Criteria

- governance schema fully matches the governed record types used by `knowledge`, `templates`, and `learning-governance`
- knowledge review history becomes durable in PostgreSQL
- template family and module template draft/publish state becomes durable in PostgreSQL
- learning writeback records become durable in PostgreSQL
- persistent HTTP runtime uses PostgreSQL-backed governance repositories for the review slice
- demo runtime remains local-only and unchanged
