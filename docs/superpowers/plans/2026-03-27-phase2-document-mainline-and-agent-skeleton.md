# Phase 2 Document Mainline and Agent Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 2 document mainline for upload, normalization, structure parsing, preview, comment viewing, and export, while reserving admin-only `Agent Runtime Registry`, `Tool / MCP Gateway`, and `Prompt / Skill Registry` skeletons.

**Architecture:** Extend the existing monorepo slices instead of introducing a second architecture. Keep `DocumentAsset` as the single source of truth, make ONLYOFFICE a preview and comment-evaluation layer only, and add thin admin-only registry modules that follow the same in-memory repository + service + API pattern already used by `model-registry`.

**Tech Stack:** pnpm monorepo, TypeScript, node:test via `tsx`, Python worker utilities, LibreOffice, ONLYOFFICE evaluation profile, PostgreSQL + in-memory repository pattern, existing smoke scripts.

---

## Scope Notes

- This plan intentionally keeps Phase 2 cohesive instead of splitting it into separate plans because the document mainline and the three admin-only registry skeletons are coupled by the same API, workbench, asset, and deployment boundaries.
- ONLYOFFICE remains a preview and comment-read layer in Phase 2. Save-back into authoritative `DocumentAsset` records stays explicit and append-only.
- The web app currently exposes feature clients and typed view models, not full rendered pages. Phase 2 should continue that pattern unless a real application shell is introduced first.

## Planned File Structure

- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/document-pipeline.ts`
- Create: `packages/contracts/src/agent-tooling.ts`
- Create: `packages/contracts/type-tests/document-pipeline-and-agent-tooling.test.ts`
- Modify: `apps/api/src/modules/document-pipeline/document-normalization-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/document-pipeline-api.ts`
- Modify: `apps/api/src/modules/document-pipeline/index.ts`
- Create: `apps/api/src/modules/document-pipeline/document-intake-service.ts`
- Create: `apps/api/src/modules/document-pipeline/document-structure-service.ts`
- Create: `apps/api/src/modules/document-pipeline/document-preview-service.ts`
- Create: `apps/api/src/modules/document-pipeline/document-export-service.ts`
- Create: `apps/api/src/modules/document-pipeline/onlyoffice-session-service.ts`
- Create: `apps/api/test/document-pipeline/document-intake.spec.ts`
- Create: `apps/api/test/document-pipeline/document-structure.spec.ts`
- Create: `apps/api/test/document-pipeline/document-preview.spec.ts`
- Create: `apps/api/test/document-pipeline/document-export.spec.ts`
- Modify: `apps/worker-py/src/document_pipeline/normalize.py`
- Create: `apps/worker-py/src/document_pipeline/parse_docx.py`
- Create: `apps/worker-py/tests/document_pipeline/test_parse_docx.py`
- Modify: `apps/web/src/features/manuscripts/manuscript-api.ts`
- Modify: `apps/web/src/features/manuscripts/types.ts`
- Modify: `apps/web/src/features/document-preview/preview-api.ts`
- Modify: `apps/web/src/features/document-preview/types.ts`
- Create: `apps/web/src/features/agent-runtime/index.ts`
- Create: `apps/web/src/features/agent-runtime/agent-runtime-api.ts`
- Create: `apps/web/src/features/agent-runtime/types.ts`
- Create: `apps/web/src/features/tool-gateway/index.ts`
- Create: `apps/web/src/features/tool-gateway/tool-gateway-api.ts`
- Create: `apps/web/src/features/tool-gateway/types.ts`
- Create: `apps/web/src/features/prompt-skill-registry/index.ts`
- Create: `apps/web/src/features/prompt-skill-registry/prompt-skill-api.ts`
- Create: `apps/web/src/features/prompt-skill-registry/types.ts`
- Create: `apps/api/src/modules/agent-runtime/agent-runtime-record.ts`
- Create: `apps/api/src/modules/agent-runtime/agent-runtime-repository.ts`
- Create: `apps/api/src/modules/agent-runtime/in-memory-agent-runtime-repository.ts`
- Create: `apps/api/src/modules/agent-runtime/agent-runtime-service.ts`
- Create: `apps/api/src/modules/agent-runtime/agent-runtime-api.ts`
- Create: `apps/api/src/modules/agent-runtime/index.ts`
- Create: `apps/api/test/agent-runtime/agent-runtime-registry.spec.ts`
- Create: `apps/api/src/modules/tool-gateway/tool-gateway-record.ts`
- Create: `apps/api/src/modules/tool-gateway/tool-gateway-repository.ts`
- Create: `apps/api/src/modules/tool-gateway/in-memory-tool-gateway-repository.ts`
- Create: `apps/api/src/modules/tool-gateway/tool-gateway-service.ts`
- Create: `apps/api/src/modules/tool-gateway/tool-gateway-api.ts`
- Create: `apps/api/src/modules/tool-gateway/index.ts`
- Create: `apps/api/test/tool-gateway/tool-gateway.spec.ts`
- Create: `apps/api/src/modules/prompt-skill-registry/prompt-skill-record.ts`
- Create: `apps/api/src/modules/prompt-skill-registry/prompt-skill-repository.ts`
- Create: `apps/api/src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts`
- Create: `apps/api/src/modules/prompt-skill-registry/prompt-skill-service.ts`
- Create: `apps/api/src/modules/prompt-skill-registry/prompt-skill-api.ts`
- Create: `apps/api/src/modules/prompt-skill-registry/index.ts`
- Create: `apps/api/test/prompt-skill-registry/prompt-skill-registry.spec.ts`
- Modify: `apps/api/.env.example`
- Modify: `apps/web/.env.example`
- Modify: `apps/worker-py/.env.example`
- Modify: `infra/docker-compose.yml`
- Modify: `docs/OPERATIONS.md`

### Task 1: Add Shared Phase 2 Contracts

**Files:**
- Create: `packages/contracts/src/document-pipeline.ts`
- Create: `packages/contracts/src/agent-tooling.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/type-tests/document-pipeline-and-agent-tooling.test.ts`

- [ ] **Step 1: Write the failing type test**

```ts
import type {
  DocumentPreviewSession,
  DocumentStructureSnapshot,
  AgentRuntime,
  ToolGatewayTool,
  SkillPackage,
} from "../src";

export const previewStatusCheck: DocumentPreviewSession["status"] = "ready";
export const structureSectionCheck: DocumentStructureSnapshot["sections"][number]["heading"] =
  "Methods";
export const runtimeStatusCheck: AgentRuntime["status"] = "active";
export const gatewayToolKindCheck: ToolGatewayTool["access_mode"] = "read";
export const skillScopeCheck: SkillPackage["scope"] = "admin_only";
```

- [ ] **Step 2: Run typecheck to verify missing exports fail**

Run: `pnpm --filter @medical/contracts typecheck`
Expected: FAIL because the Phase 2 contract modules do not exist yet

- [ ] **Step 3: Implement the minimal shared contracts**

```ts
export interface AgentRuntime {
  id: string;
  name: string;
  adapter: "internal_prompt" | "deepagents";
  status: "draft" | "active" | "archived";
  sandbox_profile_id?: string;
  allowed_modules: string[];
  admin_only: true;
}
```

Also add:

- document structure snapshot contracts
- preview session and comment view contracts
- export request/result contracts
- tool gateway contracts
- prompt template and skill package contracts

- [ ] **Step 4: Run typecheck again**

Run: `pnpm --filter @medical/contracts typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat: add phase 2 document and agent tooling contracts"
```

### Task 2: Promote Upload Into an Explicit Document Intake Workflow

**Files:**
- Create: `apps/api/src/modules/document-pipeline/document-intake-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/document-normalization-service.ts`
- Modify: `apps/api/src/modules/document-pipeline/document-pipeline-api.ts`
- Modify: `apps/api/src/modules/manuscripts/manuscript-api.ts`
- Modify: `apps/api/src/modules/document-pipeline/index.ts`
- Test: `apps/api/test/document-pipeline/document-intake.spec.ts`
- Test: `apps/api/test/document-pipeline/document-normalization.spec.ts`

- [ ] **Step 1: Write the failing intake workflow tests**

```ts
test("upload returns a follow-up intake result with normalization and preview plan", async () => {
  const response = await documentPipelineApi.intakeUploadedManuscript({
    manuscriptId: "manuscript-1",
    sourceAssetId: "asset-original-1",
    fileName: "submission.doc",
    mimeType: "application/msword",
    createdBy: "user-1",
  });

  assert.equal(response.status, 202);
  assert.equal(response.body.normalization.plan.target_type, "docx");
  assert.equal(response.body.preview.viewer, "onlyoffice");
});
```

- [ ] **Step 2: Run the document pipeline tests to verify failure**

Run: `pnpm --filter @medical/api test -- document-pipeline`
Expected: FAIL because intake orchestration and its API entry do not exist

- [ ] **Step 3: Implement the minimal intake orchestration**

```ts
export class DocumentIntakeService {
  async intakeUploadedManuscript(input: DocumentNormalizationWorkflowInput) {
    const normalization = await this.workflowService.normalize(input);
    return {
      normalization,
      preview: this.previewService.buildFromNormalization(normalization),
    };
  }
}
```

Implementation rules:

- keep `DocumentAsset` as the truth source
- do not overwrite original assets
- return `202` when `.doc` needs deferred conversion
- return `201` only when the normalized preview source is immediately ready

- [ ] **Step 4: Run tests again**

Run: `pnpm --filter @medical/api test -- document-pipeline`
Expected: PASS for intake and normalization cases

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/document-pipeline apps/api/src/modules/manuscripts apps/api/test/document-pipeline
git commit -m "feat: add explicit document intake workflow"
```

### Task 3: Add Worker-Backed DOCX Structure Parsing

**Files:**
- Create: `apps/api/src/modules/document-pipeline/document-structure-service.ts`
- Create: `apps/api/test/document-pipeline/document-structure.spec.ts`
- Create: `apps/worker-py/src/document_pipeline/parse_docx.py`
- Create: `apps/worker-py/tests/document_pipeline/test_parse_docx.py`
- Modify: `apps/worker-py/src/document_pipeline/__init__.py`

- [ ] **Step 1: Write the failing structure extraction tests**

```ts
test("docx structure extraction returns ordered headings and section spans", async () => {
  const structure = await structureService.extract({
    manuscriptId: "manuscript-1",
    assetId: "asset-normalized-1",
    fileName: "normalized.docx",
  });

  assert.deepEqual(
    structure.sections.map((section) => section.heading),
    ["Title", "Abstract", "Methods"],
  );
});
```

```python
def test_extract_headings_returns_ordered_sections():
    result = extract_structure_from_paragraphs(
        [
            {"text": "Title", "style": "Title"},
            {"text": "Abstract", "style": "Heading 1"},
            {"text": "Methods", "style": "Heading 1"},
        ]
    )
    assert [section["heading"] for section in result["sections"]] == [
        "Title",
        "Abstract",
        "Methods",
    ]
```

- [ ] **Step 2: Run the API and worker tests to verify failure**

Run: `pnpm --filter @medical/api test -- document-pipeline`
Expected: FAIL because structure extraction service is missing

Run: `pnpm --filter @medical/worker-py test -- tests/document_pipeline/test_parse_docx.py -v`
Expected: FAIL because parser module is missing

- [ ] **Step 3: Implement the minimal parser contract**

```python
def extract_structure_from_paragraphs(paragraphs: list[dict]) -> dict:
    sections = []
    for index, paragraph in enumerate(paragraphs):
        style = paragraph.get("style", "")
        if style in {"Title", "Heading 1", "Heading 2"}:
            sections.append(
                {
                    "order": len(sections) + 1,
                    "heading": paragraph["text"].strip(),
                    "style": style,
                    "paragraph_index": index,
                }
            )
    return {"sections": sections}
```

Also wire a TypeScript service that stores or returns:

- heading order
- section titles
- parser warnings
- fallback-to-manual flag on malformed files

- [ ] **Step 4: Run both test suites again**

Run: `pnpm --filter @medical/worker-py test -- tests/document_pipeline/test_parse_docx.py -v`
Expected: PASS

Run: `pnpm --filter @medical/api test -- document-pipeline`
Expected: PASS with structure extraction coverage

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/document-pipeline apps/api/test/document-pipeline apps/worker-py/src/document_pipeline apps/worker-py/tests/document_pipeline
git commit -m "feat: add docx structure parsing contract"
```

### Task 4: Add Preview Session, ONLYOFFICE Evaluation, and Comment Read Model

**Files:**
- Create: `apps/api/src/modules/document-pipeline/document-preview-service.ts`
- Create: `apps/api/src/modules/document-pipeline/onlyoffice-session-service.ts`
- Create: `apps/api/test/document-pipeline/document-preview.spec.ts`
- Modify: `apps/api/src/modules/document-pipeline/document-pipeline-api.ts`
- Modify: `apps/web/src/features/document-preview/preview-api.ts`
- Modify: `apps/web/src/features/document-preview/types.ts`

- [ ] **Step 1: Write the failing preview tests**

```ts
test("preview session is built from the current normalized asset and stays read-only", async () => {
  const response = await documentPipelineApi.createPreviewSession({
    manuscriptId: "manuscript-1",
    assetId: "asset-normalized-1",
    actorRole: "editor",
  });

  assert.equal(response.body.viewer, "onlyoffice");
  assert.equal(response.body.mode, "view");
  assert.equal(response.body.comment_source, "onlyoffice");
});
```

- [ ] **Step 2: Run the scoped tests to verify failure**

Run: `pnpm --filter @medical/api test -- document-pipeline`
Expected: FAIL because preview session and comment models do not exist

- [ ] **Step 3: Implement the preview and comment services**

```ts
export class OnlyOfficeSessionService {
  createViewSession(input: { assetId: string; actorRole: string }) {
    return {
      viewer: "onlyoffice" as const,
      mode: "view" as const,
      save_back_enabled: false,
      comment_source: "onlyoffice" as const,
    };
  }
}
```

Implementation rules:

- preview uses current normalized asset when available
- `.doc` manuscripts still surface pending-normalization preview state
- comments are readable as session-linked metadata
- save-back must stay disabled in Phase 2

- [ ] **Step 4: Re-run tests and web typecheck**

Run: `pnpm --filter @medical/api test -- document-pipeline`
Expected: PASS

Run: `pnpm --filter @medsys/web typecheck`
Expected: PASS after preview types and client adapters are updated

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/document-pipeline apps/api/test/document-pipeline apps/web/src/features/document-preview
git commit -m "feat: add preview session and comment read model"
```

### Task 5: Add Export Flow for Authoritative Downloadable Assets

**Files:**
- Create: `apps/api/src/modules/document-pipeline/document-export-service.ts`
- Create: `apps/api/test/document-pipeline/document-export.spec.ts`
- Modify: `apps/api/src/modules/document-pipeline/document-pipeline-api.ts`
- Modify: `apps/web/src/features/manuscripts/manuscript-api.ts`
- Modify: `apps/web/src/features/manuscripts/types.ts`

- [ ] **Step 1: Write the failing export tests**

```ts
test("export returns the latest authoritative asset instead of the preview session", async () => {
  const response = await documentPipelineApi.exportCurrentAsset({
    manuscriptId: "manuscript-1",
    preferredAssetType: "normalized_docx",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.asset.asset_type, "normalized_docx");
  assert.ok(response.body.download.file_name?.endsWith(".docx"));
});
```

- [ ] **Step 2: Run document pipeline tests to verify failure**

Run: `pnpm --filter @medical/api test -- document-pipeline`
Expected: FAIL because export service and route are missing

- [ ] **Step 3: Implement the export service**

```ts
export class DocumentExportService {
  async exportCurrentAsset(manuscriptId: string, preferredAssetType?: string) {
    const asset = await this.assetResolver.resolveCurrent(manuscriptId, preferredAssetType);
    return {
      asset,
      download: {
        storage_key: asset.storage_key,
        file_name: asset.file_name,
        mime_type: asset.mime_type,
      },
    };
  }
}
```

Implementation rules:

- exports always resolve to authoritative `DocumentAsset` records
- do not export ONLYOFFICE session URLs as final truth
- keep parent asset lineage and audit context available

- [ ] **Step 4: Re-run API and web verification**

Run: `pnpm --filter @medical/api test -- document-pipeline`
Expected: PASS

Run: `pnpm --filter @medsys/web typecheck`
Expected: PASS with updated manuscript export view models

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/document-pipeline apps/api/test/document-pipeline apps/web/src/features/manuscripts
git commit -m "feat: add document export flow"
```

### Task 6: Add Admin-Only Agent Runtime Registry Skeleton

**Files:**
- Create: `apps/api/src/modules/agent-runtime/agent-runtime-record.ts`
- Create: `apps/api/src/modules/agent-runtime/agent-runtime-repository.ts`
- Create: `apps/api/src/modules/agent-runtime/in-memory-agent-runtime-repository.ts`
- Create: `apps/api/src/modules/agent-runtime/agent-runtime-service.ts`
- Create: `apps/api/src/modules/agent-runtime/agent-runtime-api.ts`
- Create: `apps/api/src/modules/agent-runtime/index.ts`
- Create: `apps/api/test/agent-runtime/agent-runtime-registry.spec.ts`
- Create: `apps/web/src/features/agent-runtime/types.ts`
- Create: `apps/web/src/features/agent-runtime/agent-runtime-api.ts`
- Create: `apps/web/src/features/agent-runtime/index.ts`

- [ ] **Step 1: Write the failing registry tests**

```ts
test("only admin can create or archive an agent runtime entry", async () => {
  await assert.rejects(
    () => agentRuntimeApi.createRuntime({ actorRole: "editor", input: runtimeInput }),
    AuthorizationError,
  );
});
```

- [ ] **Step 2: Run the new scope tests to verify failure**

Run: `pnpm --filter @medical/api test -- agent-runtime`
Expected: FAIL because the module does not exist

- [ ] **Step 3: Implement the minimal runtime registry**

```ts
export interface AgentRuntimeRecord {
  id: string;
  name: string;
  adapter: "internal_prompt" | "deepagents";
  status: "draft" | "active" | "archived";
  sandbox_profile_id?: string;
  admin_only: true;
}
```

Service rules:

- admin-only mutations
- list and detail routes for future admin console
- no execution engine yet
- no production write path from runtime entries yet

- [ ] **Step 4: Run API and web verification**

Run: `pnpm --filter @medical/api test -- agent-runtime`
Expected: PASS

Run: `pnpm --filter @medsys/web typecheck`
Expected: PASS with new admin feature client

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/agent-runtime apps/api/test/agent-runtime apps/web/src/features/agent-runtime
git commit -m "feat: add agent runtime registry skeleton"
```

### Task 7: Add Tool / MCP Gateway Skeleton

**Files:**
- Create: `apps/api/src/modules/tool-gateway/tool-gateway-record.ts`
- Create: `apps/api/src/modules/tool-gateway/tool-gateway-repository.ts`
- Create: `apps/api/src/modules/tool-gateway/in-memory-tool-gateway-repository.ts`
- Create: `apps/api/src/modules/tool-gateway/tool-gateway-service.ts`
- Create: `apps/api/src/modules/tool-gateway/tool-gateway-api.ts`
- Create: `apps/api/src/modules/tool-gateway/index.ts`
- Create: `apps/api/test/tool-gateway/tool-gateway.spec.ts`
- Create: `apps/web/src/features/tool-gateway/types.ts`
- Create: `apps/web/src/features/tool-gateway/tool-gateway-api.ts`
- Create: `apps/web/src/features/tool-gateway/index.ts`

- [ ] **Step 1: Write the failing gateway tests**

```ts
test("tool gateway stores admin-approved read/write policies and defaults to read-only", async () => {
  const created = await toolGatewayApi.createTool({
    actorRole: "admin",
    input: { name: "knowledge.search", accessMode: "read" },
  });

  assert.equal(created.body.access_mode, "read");
});
```

- [ ] **Step 2: Run the scope tests to verify failure**

Run: `pnpm --filter @medical/api test -- tool-gateway`
Expected: FAIL because the module does not exist

- [ ] **Step 3: Implement the minimal gateway registry**

```ts
export interface ToolGatewayToolRecord {
  id: string;
  name: string;
  access_mode: "read" | "write";
  scope: "manuscripts" | "assets" | "knowledge" | "templates" | "audit";
  admin_only: true;
}
```

Service rules:

- registry only, no real remote MCP execution yet
- explicit read/write declaration
- admin-only creation and edits
- safe listing for future control panel use

- [ ] **Step 4: Run verification**

Run: `pnpm --filter @medical/api test -- tool-gateway`
Expected: PASS

Run: `pnpm --filter @medsys/web typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/tool-gateway apps/api/test/tool-gateway apps/web/src/features/tool-gateway
git commit -m "feat: add tool gateway registry skeleton"
```

### Task 8: Add Prompt / Skill Registry Skeleton

**Files:**
- Create: `apps/api/src/modules/prompt-skill-registry/prompt-skill-record.ts`
- Create: `apps/api/src/modules/prompt-skill-registry/prompt-skill-repository.ts`
- Create: `apps/api/src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts`
- Create: `apps/api/src/modules/prompt-skill-registry/prompt-skill-service.ts`
- Create: `apps/api/src/modules/prompt-skill-registry/prompt-skill-api.ts`
- Create: `apps/api/src/modules/prompt-skill-registry/index.ts`
- Create: `apps/api/test/prompt-skill-registry/prompt-skill-registry.spec.ts`
- Create: `apps/web/src/features/prompt-skill-registry/types.ts`
- Create: `apps/web/src/features/prompt-skill-registry/prompt-skill-api.ts`
- Create: `apps/web/src/features/prompt-skill-registry/index.ts`

- [ ] **Step 1: Write the failing registry tests**

```ts
test("prompt and skill packages are versioned and remain admin-only", async () => {
  const created = await promptSkillApi.createSkillPackage({
    actorRole: "admin",
    input: {
      name: "document_pipeline_skills",
      version: "0.1.0",
      scope: "admin_only",
    },
  });

  assert.equal(created.body.scope, "admin_only");
  assert.equal(created.body.status, "draft");
});
```

- [ ] **Step 2: Run the scope tests to verify failure**

Run: `pnpm --filter @medical/api test -- prompt-skill-registry`
Expected: FAIL because the registry does not exist

- [ ] **Step 3: Implement the minimal registry**

```ts
export interface SkillPackageRecord {
  id: string;
  name: string;
  version: string;
  scope: "admin_only";
  status: "draft" | "published" | "archived";
  applies_to_modules: string[];
}
```

Also add prompt template records with:

- version
- status
- target module
- target manuscript types
- rollback target version

- [ ] **Step 4: Re-run verification**

Run: `pnpm --filter @medical/api test -- prompt-skill-registry`
Expected: PASS

Run: `pnpm --filter @medsys/web typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/prompt-skill-registry apps/api/test/prompt-skill-registry apps/web/src/features/prompt-skill-registry
git commit -m "feat: add prompt and skill registry skeleton"
```

### Task 9: Extend Environment, Infra, and Operations for Phase 2

**Files:**
- Modify: `infra/docker-compose.yml`
- Modify: `apps/api/.env.example`
- Modify: `apps/web/.env.example`
- Modify: `apps/worker-py/.env.example`
- Modify: `docs/OPERATIONS.md`

- [ ] **Step 1: Write the failing smoke expectations**

Expected new configuration surface:

```text
ONLYOFFICE_URL
ONLYOFFICE_JWT_SECRET
LIBREOFFICE_BINARY
VITE_ONLYOFFICE_PUBLIC_URL
```

Expected docker profile:

```text
onlyoffice
```

- [ ] **Step 2: Run existing smoke commands to confirm the new configuration is not represented yet**

Run: `pnpm --filter @medical/api run smoke:boot`
Expected: PASS today, but without ONLYOFFICE or Phase 2 configuration checks

Run: `pnpm --filter @medsys/web run smoke:boot`
Expected: PASS today, but without preview integration env checks

- [ ] **Step 3: Add the minimal infra and ops surface**

Required changes:

- add optional ONLYOFFICE service or profile in `infra/docker-compose.yml`
- document that preview integration is evaluation-only in Phase 2
- add env placeholders without making local smoke boot require real production credentials
- describe export and preview operational checks in `docs/OPERATIONS.md`

- [ ] **Step 4: Run full verification**

Run: `pnpm lint`
Expected: PASS

Run: `pnpm typecheck`
Expected: PASS

Run: `pnpm test`
Expected: PASS

Run: `pnpm --filter @medical/api run smoke:boot`
Expected: PASS

Run: `pnpm --filter @medsys/web run smoke:boot`
Expected: PASS

Run: `pnpm --filter @medical/worker-py run smoke:boot`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add infra/docker-compose.yml apps/api/.env.example apps/web/.env.example apps/worker-py/.env.example docs/OPERATIONS.md
git commit -m "chore: prepare phase 2 ops and integration config"
```

## Final Verification Gate

- [ ] Run: `pnpm lint`
- [ ] Run: `pnpm typecheck`
- [ ] Run: `pnpm test`
- [ ] Run: `pnpm --filter @medical/api run smoke:boot`
- [ ] Run: `pnpm --filter @medsys/web run smoke:boot`
- [ ] Run: `pnpm --filter @medical/worker-py run smoke:boot`
- [ ] Run: `docker compose -f infra/docker-compose.yml ps`
- [ ] Confirm that document preview remains read-only and admin-only tooling remains hidden from business roles

## Acceptance Criteria

- Upload leads into a formal intake workflow with normalization and preview readiness output.
- `.docx` files can materialize normalized preview assets immediately, while `.doc` files expose a deferred conversion path.
- Document structure extraction returns a stable section snapshot and manual-review fallback when parsing fails.
- ONLYOFFICE is represented as a preview and comment-evaluation layer, not as a truth-overwriting save path.
- Export resolves authoritative `DocumentAsset` records, not temporary preview state.
- `Agent Runtime Registry`, `Tool / MCP Gateway`, and `Prompt / Skill Registry` exist as admin-only skeleton modules with tests and web feature clients.
- Infra and env documentation cover the Phase 2 preview and integration surface without breaking local smoke workflows.
