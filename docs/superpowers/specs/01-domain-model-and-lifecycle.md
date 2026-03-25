# 领域模型与生命周期

## 核心实体

- `Manuscript`
- `DocumentAsset`
- `Job`
- `KnowledgeItem`
- `TemplateFamily`
- `ModuleTemplate`
- `TemplateKnowledgeBinding`
- `ReviewedCaseSnapshot`
- `LearningRun`
- `LearningCandidate`
- `PdfConsistencyJob`
- `PdfConsistencyIssue`
- `ModelRegistry`
- `AuditLog`
- `Notification`

## Manuscript

用于承载稿件业务主线，核心字段建议包括：

- `id`
- `title`
- `manuscript_type`
- `status`
- `created_by`
- `current_screening_asset_id`
- `current_editing_asset_id`
- `current_proofreading_asset_id`
- `current_template_family_id`

## DocumentAsset

用于承载文件版本与证据链，核心字段建议包括：

- `id`
- `manuscript_id`
- `asset_type`
- `storage_key`
- `mime_type`
- `parent_asset_id`
- `source_module`
- `source_job_id`
- `created_by`
- `version_no`
- `is_current`

## 生命周期摘要

`Manuscript`：

- `draft`
- `uploaded`
- `processing`
- `awaiting_review`
- `completed`
- `archived`

`DocumentAsset`：

- `created`
- `active`
- `superseded`
- `archived`

`KnowledgeItem`：

- `draft`
- `pending_review`
- `approved`
- `deprecated`
- `superseded`
- `archived`

`ModuleTemplate`：

- `draft`
- `published`
- `archived`

`LearningCandidate`：

- `draft`
- `pending_review`
- `approved`
- `rejected`
- `archived`
