# Rule Center AI Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add true LLM-powered rule-center intake for manual rule descriptions and add LLM parsing validation to the existing five-step manual rule wizard, without changing existing manual rule entry semantics or allowing AI drafts into runtime before review.

**Architecture:** Use additive contracts and new rule-AI services under `editorial-rules`. AI produces candidates and parsing reports only; existing draft/review/publish paths remain the authority. MVP supports manual natural-language descriptions, deterministic template/similarity hints, and manual wizard AI parsing; journal document extraction, manuscript diff extraction, automatic priority changes, and automatic duplicate merging are explicitly deferred.

**Tech Stack:** TypeScript, Node HTTP API, OpenAI-compatible model runtime, existing AI gateway/model routing, existing template-governance React UI, existing rule package/extraction/wizard patterns, Node test runner, TypeScript type tests.

---

## Feasibility Review Corrections

Subagent reviews found the design is feasible only with these constraints:

- Keep the MVP to `manual_description -> AI draft -> human edit/review`. Do not implement journal document batch extraction or manuscript diff extraction in this pass.
- Add independent rule AI contracts and services. Do not overload `KnowledgeSemanticLayerInput` or knowledge AI response types.
- Use additive optional fields on existing rule package candidate shapes where possible; do not expand existing exhaustive enums such as `RulePackageSuggestedLayer` for MVP.
- Store AI source/understanding/review metadata in candidate payloads and rule `authoring_payload` first; avoid a migration unless the implementation needs persisted AI draft rows independent of existing extraction candidates.
- Similarity and conflicts are hints only in MVP. Do not automatically merge, replace, delete, reprioritize, or suppress existing rules.
- AI source rules must not use direct publish. They must be saved as drafts/candidates and go through existing review/publish gates.
- Table and image evidence authority remains owned by existing high-fidelity evidence gates. AI parsing may explain evidence but cannot prove lossless capture.
- Runtime remains safe because existing resolution only reads active/published rule sets; preserve that boundary.

## Files and Responsibilities

- `packages/contracts/src/rule-ai-intake.ts`
  - New shared contracts for AI rule draft requests, responses, parsing reports, template matches, similarity hints, confidence, and review status.
- `packages/contracts/src/editorial-rule-packages.ts`
  - Add optional AI metadata fields to `RulePackageCandidate` and allow manual description as an additive source input.
- `packages/contracts/src/index.ts`
  - Export the new rule AI intake contracts.
- `apps/api/src/modules/editorial-rules/rule-ai-intake-service.ts`
  - New backend service and OpenAI-compatible generator for manual description rule draft generation.
- `apps/api/src/modules/editorial-rules/rule-ai-parsing-service.ts`
  - New backend service for parsing an already-entered manual wizard rule and returning consistency findings.
- `apps/api/src/modules/editorial-rules/rule-template-matching-service.ts`
  - Deterministic MVP matcher that maps AI draft fields to known rule/package targets and emits new-template candidates as review-only records.
- `apps/api/src/modules/editorial-rules/rule-similarity-service.ts`
  - Deterministic MVP similarity hints against existing candidates/rules; no automatic merge or priority changes.
- `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
  - Add API methods for AI draft generation and manual-rule parsing.
- `apps/api/src/modules/editorial-rules/index.ts`
  - Export new services.
- `apps/api/src/http/api-http-server.ts`
  - Add route union entries, route parsing, request dispatch, and demo runtime wiring.
- `apps/api/src/http/persistent-governance-runtime.ts`
  - Wire new services with AI gateway/runtime dependencies in persistent runtime.
- `apps/api/test/editorial-rules/rule-ai-intake-service.spec.ts`
  - Service tests for normalized AI draft generation, template hints, similarity hints, and invalid JSON handling.
- `apps/api/test/http/rule-ai-intake-http.spec.ts`
  - HTTP tests for new endpoints and non-runtime isolation.
- `apps/web/src/features/editorial-rules/types.ts`
  - Add or re-export rule AI view models if this file remains the shared editorial-rules UI type surface.
- `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
  - Add web API client functions for AI draft and parsing endpoints.
- `apps/web/src/features/template-governance/template-governance-controller.ts`
  - Expose controller methods for AI draft generation and AI parsing.
- `apps/web/src/features/template-governance/template-governance-rule-wizard-api.ts`
  - Extend rule wizard view models and mapping helpers with AI parsing data; keep existing knowledge draft flow intact.
- `apps/web/src/features/template-governance/template-governance-rule-wizard-step-semantic.tsx`
  - Show AI parsing comparison inside the existing semantic step instead of adding a sixth step.
- `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
  - Add “AI 生成规则草稿” entry action.
- `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
  - Add AI intake panel state, invoke controller, apply generated draft into the existing wizard, and force review path.
- `apps/web/src/features/template-governance/template-governance-ledger-types.ts`
  - Add optional AI source/review metadata columns for total-ledger display.
- `apps/web/test/template-governance-rule-wizard.spec.tsx`
  - Add AI parsing panel, evidence gate, and publish guard tests.
- `apps/web/test/template-governance-workbench-page.spec.tsx`
  - Add AI intake entry/action tests.
- `apps/web/test/editorial-rules-api.spec.ts`
  - Add API client request-shape tests.

---

## Task 1: Add Rule AI Shared Contracts

**Files:**
- Create: `packages/contracts/src/rule-ai-intake.ts`
- Modify: `packages/contracts/src/editorial-rule-packages.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/type-tests/package-entry.test.ts`

- [ ] **Step 1: Write the failing contract type test**

Add imports in `packages/contracts/type-tests/package-entry.test.ts` proving the package exports the new contract names:

```ts
import type {
  RuleAiIntakeDraftRequest,
  RuleAiIntakeDraftResponse,
  RuleAiParsingRequest,
  RuleAiParsingResponse,
} from "../src/index.js";

const intakeRequestCheck: RuleAiIntakeDraftRequest = {
  source_kind: "manual_description",
  description: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
  context: {
    module_scope: "proofreading",
    manuscript_types: ["clinical_study"],
    sections: ["abstract"],
  },
};

const intakeResponseCheck: RuleAiIntakeDraftResponse = {
  draft: {
    source_kind: "manual_description",
    ai_understanding_summary: "摘要首次出现英文缩写需要补全中文全称。",
    recommended_governance_layer: "journal_template",
    target_object: "abstract_abbreviation",
    trigger: "first_abbreviation_occurrence",
    action: "manual_review_or_replace",
    scope: {
      module_scope: "proofreading",
      manuscript_types: ["clinical_study"],
      sections: ["abstract"],
    },
    evidence: [{ kind: "user_description", text: "摘要首次出现英文缩写时使用中文全称（英文缩写）。" }],
    confidence: { overall: 0.8 },
    uncertainties: [],
  },
  template_match: { status: "matched", template_id: "abstract-abbreviation" },
  similar_rule_matches: [],
};

const parsingRequestCheck: RuleAiParsingRequest = {
  rule_fields: {
    title: "摘要缩写规范",
    rule_body: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
    module_scope: "proofreading",
    manuscript_types: ["clinical_study"],
  },
};

const parsingResponseCheck: RuleAiParsingResponse = {
  ai_understanding_summary: "摘要英文缩写首次出现需要补全中文全称。",
  consistency: "consistent",
  findings: [],
  requires_human_confirmation: false,
};
```

Run: `pnpm --filter @medical/contracts test`

Expected before implementation: TypeScript fails because the exported types do not exist.

- [ ] **Step 2: Add the new contract file**

Create `packages/contracts/src/rule-ai-intake.ts` with:

```ts
import type { ManuscriptType } from "./manuscript.js";
import type { ModuleType } from "./templates.js";

export type RuleAiIntakeSourceKind = "manual_description";

export type RuleAiGovernanceLayer =
  | "template_family"
  | "module_template"
  | "journal_template"
  | "medical_package"
  | "general_package";

export type RuleAiTemplateMatchStatus =
  | "matched"
  | "multiple_candidates"
  | "no_match";

export type RuleAiSimilarityKind =
  | "duplicate"
  | "similar"
  | "conflict"
  | "no_material_overlap";

export type RuleAiParsingConsistency =
  | "consistent"
  | "partially_inconsistent"
  | "missing_evidence"
  | "possibly_duplicate"
  | "uncertain";

export interface RuleAiScopeDraft {
  module_scope?: ModuleType | "any";
  manuscript_types?: ManuscriptType[] | "any";
  sections?: string[];
  journal_key?: string;
  template_family_id?: string;
  module_template_id?: string;
  journal_template_id?: string;
}

export interface RuleAiEvidenceItem {
  kind:
    | "user_description"
    | "document_excerpt"
    | "diff_excerpt"
    | "table_snapshot"
    | "image_understanding";
  text?: string;
  source_id?: string;
  authority?: "authoritative" | "review_required" | "unavailable";
}

export interface RuleAiConfidenceMap {
  overall: number;
  fields?: Record<string, number>;
}

export interface RuleAiDraft {
  source_kind: RuleAiIntakeSourceKind;
  ai_understanding_summary: string;
  recommended_governance_layer: RuleAiGovernanceLayer;
  recommended_template_id?: string;
  new_template_candidate?: {
    title: string;
    rationale: string;
    review_required: true;
  };
  target_object: string;
  trigger: string;
  action: string;
  exclusions?: string[];
  scope: RuleAiScopeDraft;
  priority_suggestion?: {
    rationale: string;
    professional_authority?: boolean;
  };
  evidence: RuleAiEvidenceItem[];
  confidence: RuleAiConfidenceMap;
  uncertainties: string[];
}

export interface RuleAiTemplateMatch {
  status: RuleAiTemplateMatchStatus;
  template_id?: string;
  candidates?: Array<{ template_id: string; label: string; rationale: string }>;
  new_template_candidate?: RuleAiDraft["new_template_candidate"];
}

export interface RuleAiSimilarityMatch {
  kind: RuleAiSimilarityKind;
  rule_id?: string;
  title: string;
  rationale: string;
  suggested_resolution: "merge" | "reuse_existing" | "keep_separate" | "manual_review";
}

export interface RuleAiIntakeDraftRequest {
  source_kind: "manual_description";
  description: string;
  context?: RuleAiScopeDraft & {
    operator_hints?: string;
  };
}

export interface RuleAiIntakeDraftResponse {
  draft: RuleAiDraft;
  template_match: RuleAiTemplateMatch;
  similar_rule_matches: RuleAiSimilarityMatch[];
  warnings?: string[];
}

export interface RuleAiParsingRequest {
  rule_fields: {
    title?: string;
    rule_body: string;
    module_scope?: ModuleType | "any";
    manuscript_types?: ManuscriptType[] | "any";
    sections?: string[];
    target_object?: string;
    trigger?: string;
    action?: string;
    evidence?: RuleAiEvidenceItem[];
  };
}

export interface RuleAiParsingFinding {
  field: string;
  severity: "info" | "warning" | "blocking";
  message: string;
  suggested_revision?: string;
}

export interface RuleAiParsingResponse {
  ai_understanding_summary: string;
  consistency: RuleAiParsingConsistency;
  findings: RuleAiParsingFinding[];
  similar_rule_matches?: RuleAiSimilarityMatch[];
  requires_human_confirmation: boolean;
  warnings?: string[];
}
```

- [ ] **Step 3: Add additive optional fields to rule package candidates**

Modify `packages/contracts/src/editorial-rule-packages.ts` so `RulePackageCandidate` can carry AI metadata without changing existing callers:

```ts
import type {
  RuleAiDraft,
  RuleAiSimilarityMatch,
  RuleAiTemplateMatch,
} from "./rule-ai-intake.js";

export interface RulePackageCandidate {
  // existing fields stay unchanged
  ai_intake_metadata?: RuleAiDraft;
  template_match?: RuleAiTemplateMatch;
  similar_rule_matches?: RuleAiSimilarityMatch[];
  ai_review_status?: "ai_draft" | "awaiting_human_review" | "human_confirmed" | "rejected";
}
```

Keep these fields optional so old candidates and tests remain valid.

- [ ] **Step 4: Export the new contracts**

Add to `packages/contracts/src/index.ts`:

```ts
export * from "./rule-ai-intake.js";
```

- [ ] **Step 5: Run contract tests**

Run: `pnpm --filter @medical/contracts test`

Expected: PASS.

---

## Task 2: Implement Backend Rule AI Draft Generation

**Files:**
- Create: `apps/api/src/modules/editorial-rules/rule-template-matching-service.ts`
- Create: `apps/api/src/modules/editorial-rules/rule-similarity-service.ts`
- Create: `apps/api/src/modules/editorial-rules/rule-ai-intake-service.ts`
- Modify: `apps/api/src/modules/editorial-rules/index.ts`
- Test: `apps/api/test/editorial-rules/rule-ai-intake-service.spec.ts`

- [ ] **Step 1: Write failing service tests**

Create `apps/api/test/editorial-rules/rule-ai-intake-service.spec.ts` with tests for:

```ts
test("rule AI intake normalizes manual description drafts", async () => {
  const service = new RuleAiIntakeService({
    generator: {
      async createDraft() {
        return {
          draft: {
            source_kind: "manual_description",
            ai_understanding_summary: "摘要缩写首次出现需要中文全称。",
            recommended_governance_layer: "journal_template",
            target_object: "abstract_abbreviation",
            trigger: "first_abbreviation_occurrence",
            action: "manual_review_or_replace",
            scope: { module_scope: "proofreading", manuscript_types: ["clinical_study"], sections: ["abstract"] },
            evidence: [{ kind: "user_description", text: "摘要首次出现英文缩写时使用中文全称（英文缩写）。" }],
            confidence: { overall: 0.9 },
            uncertainties: [],
          },
          template_match: { status: "matched", template_id: "abstract_abbreviation" },
          similar_rule_matches: [],
        };
      },
    },
  });

  const result = await service.createDraft({
    source_kind: "manual_description",
    description: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
    context: { module_scope: "proofreading", manuscript_types: ["clinical_study"], sections: ["abstract"] },
  });

  assert.equal(result.draft.source_kind, "manual_description");
  assert.equal(result.draft.scope.module_scope, "proofreading");
  assert.equal(result.template_match.status, "matched");
});

test("rule AI intake rejects empty manual descriptions", async () => {
  const service = new RuleAiIntakeService({
    generator: {
      async createDraft() {
        throw new Error("should not call generator");
      },
    },
  });

  await assert.rejects(
    service.createDraft({ source_kind: "manual_description", description: "   " }),
    /description is required/u,
  );
});
```

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-ai-intake-service.spec.ts`

Expected before implementation: FAIL because files/classes do not exist.

- [ ] **Step 2: Implement deterministic template matcher**

Create `rule-template-matching-service.ts`:

```ts
import type { RuleAiDraft, RuleAiTemplateMatch } from "@medical/contracts";

export class RuleTemplateMatchingService {
  match(input: { draft: RuleAiDraft }): RuleAiTemplateMatch {
    const text = [
      input.draft.target_object,
      input.draft.trigger,
      input.draft.action,
      input.draft.ai_understanding_summary,
    ]
      .join(" ")
      .toLowerCase();

    if (text.includes("abstract") || text.includes("摘要")) {
      return { status: "matched", template_id: "abstract_rule_template" };
    }

    if (text.includes("table") || text.includes("表格")) {
      return { status: "matched", template_id: "table_rule_template" };
    }

    return {
      status: "no_match",
      new_template_candidate: {
        title: `${input.draft.target_object} template candidate`,
        rationale: "No existing deterministic template matched this AI draft.",
        review_required: true,
      },
    };
  }
}
```

- [ ] **Step 3: Implement deterministic similarity service**

Create `rule-similarity-service.ts`:

```ts
import type { RuleAiDraft, RuleAiSimilarityMatch } from "@medical/contracts";

export interface RuleSimilarityLedgerItem {
  id: string;
  title: string;
  targetObject?: string;
  trigger?: string;
  action?: string;
}

export class RuleSimilarityService {
  findSimilar(input: {
    draft: RuleAiDraft;
    existingRules?: readonly RuleSimilarityLedgerItem[];
  }): RuleAiSimilarityMatch[] {
    const existingRules = input.existingRules ?? [];
    return existingRules
      .map((rule): RuleAiSimilarityMatch | undefined => {
        const sameTarget =
          normalize(rule.targetObject) === normalize(input.draft.target_object);
        const sameTrigger = normalize(rule.trigger) === normalize(input.draft.trigger);
        const sameAction = normalize(rule.action) === normalize(input.draft.action);

        if (sameTarget && sameTrigger && sameAction) {
          return {
            kind: "duplicate",
            rule_id: rule.id,
            title: rule.title,
            rationale: "Target object, trigger, and action match the AI draft.",
            suggested_resolution: "reuse_existing",
          };
        }

        if (sameTarget && (sameTrigger || sameAction)) {
          return {
            kind: "similar",
            rule_id: rule.id,
            title: rule.title,
            rationale: "Target object overlaps with a similar trigger or action.",
            suggested_resolution: "manual_review",
          };
        }

        return undefined;
      })
      .filter((match): match is RuleAiSimilarityMatch => match !== undefined);
  }
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/gu, " ");
}
```

- [ ] **Step 4: Implement RuleAiIntakeService**

Create `rule-ai-intake-service.ts`:

```ts
import type {
  RuleAiDraft,
  RuleAiIntakeDraftRequest,
  RuleAiIntakeDraftResponse,
} from "@medical/contracts";
import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { AiProviderRuntimeService } from "../ai-provider-runtime/ai-provider-runtime-service.ts";
import { RuleSimilarityService, type RuleSimilarityLedgerItem } from "./rule-similarity-service.ts";
import { RuleTemplateMatchingService } from "./rule-template-matching-service.ts";

export interface RuleAiIntakeGenerator {
  createDraft(input: RuleAiIntakeDraftRequest): Promise<RuleAiIntakeDraftResponse>;
}

export interface RuleAiIntakeServiceOptions {
  generator?: RuleAiIntakeGenerator;
  templateMatchingService?: RuleTemplateMatchingService;
  similarityService?: RuleSimilarityService;
  existingRules?: () => Promise<RuleSimilarityLedgerItem[]>;
}

export class RuleAiIntakeUnavailableError extends Error {
  constructor(message = "Rule AI intake is unavailable.") {
    super(message);
    this.name = "RuleAiIntakeUnavailableError";
  }
}

export class RuleAiIntakeService {
  private readonly generator?: RuleAiIntakeGenerator;
  private readonly templateMatchingService: RuleTemplateMatchingService;
  private readonly similarityService: RuleSimilarityService;
  private readonly existingRules?: () => Promise<RuleSimilarityLedgerItem[]>;

  constructor(options: RuleAiIntakeServiceOptions) {
    this.generator = options.generator;
    this.templateMatchingService =
      options.templateMatchingService ?? new RuleTemplateMatchingService();
    this.similarityService = options.similarityService ?? new RuleSimilarityService();
    this.existingRules = options.existingRules;
  }

  async createDraft(input: RuleAiIntakeDraftRequest): Promise<RuleAiIntakeDraftResponse> {
    if (input.source_kind !== "manual_description") {
      throw new RuleAiIntakeUnavailableError("Only manual_description intake is supported in this MVP.");
    }
    if (!input.description.trim()) {
      throw new RuleAiIntakeUnavailableError("Rule AI intake description is required.");
    }
    if (!this.generator) {
      throw new RuleAiIntakeUnavailableError();
    }

    const generated = await this.generator.createDraft(input);
    const draft = normalizeDraft(generated.draft, input);
    const templateMatch =
      generated.template_match.status === "matched" ||
      generated.template_match.status === "multiple_candidates"
        ? generated.template_match
        : this.templateMatchingService.match({ draft });
    const existingRules = this.existingRules ? await this.existingRules() : [];
    const deterministicMatches = this.similarityService.findSimilar({
      draft,
      existingRules,
    });

    return {
      draft,
      template_match: templateMatch,
      similar_rule_matches: [
        ...deterministicMatches,
        ...(generated.similar_rule_matches ?? []),
      ],
      warnings: generated.warnings ?? [],
    };
  }
}

function normalizeDraft(
  draft: RuleAiDraft,
  input: RuleAiIntakeDraftRequest,
): RuleAiDraft {
  return {
    ...draft,
    source_kind: "manual_description",
    scope: {
      ...input.context,
      ...draft.scope,
    },
    evidence:
      draft.evidence.length > 0
        ? draft.evidence
        : [{ kind: "user_description", text: input.description }],
    confidence: {
      overall: clampConfidence(draft.confidence.overall),
      ...(draft.confidence.fields ? { fields: draft.confidence.fields } : {}),
    },
    uncertainties: [...new Set(draft.uncertainties ?? [])],
  };
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
```

- [ ] **Step 5: Add OpenAI-compatible generator**

In the same file, add `OpenAiRuleAiIntakeGenerator` modeled after knowledge AI assist:

```ts
export class OpenAiRuleAiIntakeGenerator implements RuleAiIntakeGenerator {
  constructor(
    private readonly options: {
      aiGatewayService: Pick<AiGatewayService, "resolveModelSelection">;
      aiProviderRuntimeService: Pick<AiProviderRuntimeService, "resolveSelectionRuntime">;
      fetch?: typeof fetch;
    },
  ) {}

  async createDraft(input: RuleAiIntakeDraftRequest): Promise<RuleAiIntakeDraftResponse> {
    const selection = await this.options.aiGatewayService.resolveModelSelection({
      module: input.context?.module_scope && input.context.module_scope !== "any"
        ? input.context.module_scope
        : "proofreading",
    });
    const runtime = await this.options.aiProviderRuntimeService.resolveSelectionRuntime(selection);
    const fetchImpl = this.options.fetch ?? fetch;
    const response = await fetchImpl(runtime.primary.request_url, {
      method: "POST",
      headers: runtime.primary.headers,
      body: JSON.stringify({
        model: runtime.primary.model_name,
        messages: [
          {
            role: "system",
            content:
              "You are a governed medical manuscript rule-authoring assistant. Return JSON only. Generate a draft; never claim it is published.",
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "rule_ai_manual_description_intake",
              contract: {
                draft: "RuleAiDraft",
                template_match: "RuleAiTemplateMatch",
                similar_rule_matches: "RuleAiSimilarityMatch[]",
                warnings: "string[]",
              },
              input,
            }),
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new RuleAiIntakeUnavailableError(`Rule AI intake request failed with status ${response.status}.`);
    }

    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new RuleAiIntakeUnavailableError("Rule AI intake returned an empty response.");
    }
    return JSON.parse(content) as RuleAiIntakeDraftResponse;
  }
}
```

- [ ] **Step 6: Export the services**

Modify `apps/api/src/modules/editorial-rules/index.ts`:

```ts
export * from "./rule-ai-intake-service.ts";
export * from "./rule-ai-parsing-service.ts";
export * from "./rule-template-matching-service.ts";
export * from "./rule-similarity-service.ts";
```

- [ ] **Step 7: Run focused API service test**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-ai-intake-service.spec.ts`

Expected: PASS.

---

## Task 3: Implement Backend Manual Rule AI Parsing

**Files:**
- Create: `apps/api/src/modules/editorial-rules/rule-ai-parsing-service.ts`
- Test: `apps/api/test/editorial-rules/rule-ai-parsing-service.spec.ts`

- [ ] **Step 1: Write failing parsing service tests**

Create tests proving:

```ts
test("rule AI parsing reports consistent manual rules", async () => {
  const service = new RuleAiParsingService({
    generator: {
      async parseRule() {
        return {
          ai_understanding_summary: "摘要英文缩写首次出现需要中文全称。",
          consistency: "consistent",
          findings: [],
          requires_human_confirmation: false,
        };
      },
    },
  });

  const result = await service.parseRule({
    rule_fields: {
      title: "摘要缩写规范",
      rule_body: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
      module_scope: "proofreading",
      manuscript_types: ["clinical_study"],
      sections: ["abstract"],
    },
  });

  assert.equal(result.consistency, "consistent");
});

test("rule AI parsing rejects empty rule bodies", async () => {
  const service = new RuleAiParsingService({
    generator: {
      async parseRule() {
        throw new Error("should not call generator");
      },
    },
  });

  await assert.rejects(
    service.parseRule({ rule_fields: { rule_body: " " } }),
    /rule body is required/u,
  );
});
```

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-ai-parsing-service.spec.ts`

Expected before implementation: FAIL.

- [ ] **Step 2: Implement RuleAiParsingService**

Create `rule-ai-parsing-service.ts` with:

```ts
import type { RuleAiParsingRequest, RuleAiParsingResponse } from "@medical/contracts";
import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { AiProviderRuntimeService } from "../ai-provider-runtime/ai-provider-runtime-service.ts";
import { RuleAiIntakeUnavailableError } from "./rule-ai-intake-service.ts";

export interface RuleAiParsingGenerator {
  parseRule(input: RuleAiParsingRequest): Promise<RuleAiParsingResponse>;
}

export class RuleAiParsingService {
  constructor(private readonly options: { generator?: RuleAiParsingGenerator }) {}

  async parseRule(input: RuleAiParsingRequest): Promise<RuleAiParsingResponse> {
    if (!input.rule_fields.rule_body.trim()) {
      throw new RuleAiIntakeUnavailableError("Rule AI parsing rule body is required.");
    }
    if (!this.options.generator) {
      throw new RuleAiIntakeUnavailableError("Rule AI parsing is unavailable.");
    }
    const parsed = await this.options.generator.parseRule(input);
    return {
      ai_understanding_summary: parsed.ai_understanding_summary.trim(),
      consistency: parsed.consistency,
      findings: parsed.findings ?? [],
      similar_rule_matches: parsed.similar_rule_matches ?? [],
      requires_human_confirmation: parsed.requires_human_confirmation,
      warnings: parsed.warnings ?? [],
    };
  }
}
```

- [ ] **Step 3: Add OpenAI-compatible parsing generator**

Add `OpenAiRuleAiParsingGenerator` in the same file:

```ts
export class OpenAiRuleAiParsingGenerator implements RuleAiParsingGenerator {
  constructor(
    private readonly options: {
      aiGatewayService: Pick<AiGatewayService, "resolveModelSelection">;
      aiProviderRuntimeService: Pick<AiProviderRuntimeService, "resolveSelectionRuntime">;
      fetch?: typeof fetch;
    },
  ) {}

  async parseRule(input: RuleAiParsingRequest): Promise<RuleAiParsingResponse> {
    const module =
      input.rule_fields.module_scope && input.rule_fields.module_scope !== "any"
        ? input.rule_fields.module_scope
        : "proofreading";
    const selection = await this.options.aiGatewayService.resolveModelSelection({ module });
    const runtime = await this.options.aiProviderRuntimeService.resolveSelectionRuntime(selection);
    const fetchImpl = this.options.fetch ?? fetch;
    const response = await fetchImpl(runtime.primary.request_url, {
      method: "POST",
      headers: runtime.primary.headers,
      body: JSON.stringify({
        model: runtime.primary.model_name,
        messages: [
          {
            role: "system",
            content:
              "You are a governed rule parsing reviewer. Compare the user's entered rule fields with your understanding. Return JSON only.",
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "rule_ai_manual_entry_parse",
              contract: {
                ai_understanding_summary: "string",
                consistency: "consistent|partially_inconsistent|missing_evidence|possibly_duplicate|uncertain",
                findings: [{ field: "string", severity: "info|warning|blocking", message: "string" }],
                requires_human_confirmation: "boolean",
                warnings: ["string"],
              },
              input,
            }),
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new RuleAiIntakeUnavailableError(`Rule AI parsing request failed with status ${response.status}.`);
    }
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new RuleAiIntakeUnavailableError("Rule AI parsing returned an empty response.");
    }
    return JSON.parse(content) as RuleAiParsingResponse;
  }
}
```

- [ ] **Step 4: Run focused parsing service test**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-ai-parsing-service.spec.ts`

Expected: PASS.

---

## Task 4: Add Editorial Rule API and HTTP Routes

**Files:**
- Modify: `apps/api/src/modules/editorial-rules/editorial-rule-api.ts`
- Modify: `apps/api/src/http/api-http-server.ts`
- Modify: `apps/api/src/http/persistent-governance-runtime.ts`
- Test: `apps/api/test/http/rule-ai-intake-http.spec.ts`

- [ ] **Step 1: Write failing HTTP tests**

Add tests that POST:

```ts
await fetch(`${baseUrl}/api/v1/editorial-rules/ai-intake/drafts`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    source_kind: "manual_description",
    description: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
    context: { module_scope: "proofreading", manuscript_types: ["clinical_study"], sections: ["abstract"] },
  }),
});

await fetch(`${baseUrl}/api/v1/editorial-rules/ai-intake/parse-manual-rule`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    rule_fields: {
      title: "摘要缩写规范",
      rule_body: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
      module_scope: "proofreading",
    },
  }),
});
```

Expected before implementation: 404 or missing route.

- [ ] **Step 2: Add API service methods**

In `editorial-rule-api.ts`, accept optional services and add:

```ts
async createRuleAiIntakeDraft(input: RuleAiIntakeDraftRequest): Promise<RouteResponse<RuleAiIntakeDraftResponse>> {
  return { status: 200, body: await ruleAiIntakeService!.createDraft(input) };
}

async parseManualRuleWithAi(input: RuleAiParsingRequest): Promise<RouteResponse<RuleAiParsingResponse>> {
  return { status: 200, body: await ruleAiParsingService!.parseRule(input) };
}
```

Return a service-unavailable error if the service is absent, matching knowledge AI assist behavior.

- [ ] **Step 3: Add HTTP route union and dispatch**

In `api-http-server.ts`, add routes:

```ts
route: "editorial-rules-create-ai-intake-draft";
route: "editorial-rules-parse-manual-rule-with-ai";
```

Add dispatch cases:

```ts
case "editorial-rules-create-ai-intake-draft":
  return runtime.editorialRuleApi.createRuleAiIntakeDraft(body as RuleAiIntakeDraftRequest);
case "editorial-rules-parse-manual-rule-with-ai":
  return runtime.editorialRuleApi.parseManualRuleWithAi(body as RuleAiParsingRequest);
```

Add path parsing:

```ts
if (method === "POST" && path === "/api/v1/editorial-rules/ai-intake/drafts") {
  return { route: "editorial-rules-create-ai-intake-draft" };
}
if (method === "POST" && path === "/api/v1/editorial-rules/ai-intake/parse-manual-rule") {
  return { route: "editorial-rules-parse-manual-rule-with-ai" };
}
```

- [ ] **Step 4: Wire demo and persistent runtimes**

In demo runtime setup, instantiate deterministic stub services for tests when no AI runtime is configured.

In `persistent-governance-runtime.ts`, instantiate:

```ts
const ruleAiIntakeService = new RuleAiIntakeService({
  generator: new OpenAiRuleAiIntakeGenerator({
    aiGatewayService,
    aiProviderRuntimeService,
  }),
});

const ruleAiParsingService = new RuleAiParsingService({
  generator: new OpenAiRuleAiParsingGenerator({
    aiGatewayService,
    aiProviderRuntimeService,
  }),
});
```

Pass both into `createEditorialRuleApi`.

- [ ] **Step 5: Run HTTP tests**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/http/rule-ai-intake-http.spec.ts`

Expected: PASS.

---

## Task 5: Add Web API Client and Controller Methods

**Files:**
- Modify: `apps/web/src/features/editorial-rules/types.ts`
- Modify: `apps/web/src/features/editorial-rules/editorial-rules-api.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Test: `apps/web/test/editorial-rules-api.spec.ts`
- Test: `apps/web/test/template-governance-controller.spec.ts`

- [ ] **Step 1: Write failing web API client tests**

Add tests proving:

```ts
await createRuleAiIntakeDraft(client, {
  source_kind: "manual_description",
  description: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
});

assert.equal(client.requests[0].url, "/api/v1/editorial-rules/ai-intake/drafts");

await parseManualRuleWithAi(client, {
  rule_fields: { rule_body: "摘要首次出现英文缩写时使用中文全称（英文缩写）。" },
});

assert.equal(client.requests[1].url, "/api/v1/editorial-rules/ai-intake/parse-manual-rule");
```

Expected before implementation: functions do not exist.

- [ ] **Step 2: Add web types**

In `apps/web/src/features/editorial-rules/types.ts`, re-export or mirror:

```ts
export type {
  RuleAiIntakeDraftRequest,
  RuleAiIntakeDraftResponse,
  RuleAiParsingRequest,
  RuleAiParsingResponse,
} from "@medical/contracts";
```

- [ ] **Step 3: Add web API functions**

In `editorial-rules-api.ts`:

```ts
export function createRuleAiIntakeDraft(
  client: HttpClient,
  input: RuleAiIntakeDraftRequest,
): Promise<RuleAiIntakeDraftResponse> {
  return client.request({
    method: "POST",
    url: "/api/v1/editorial-rules/ai-intake/drafts",
    body: input,
  });
}

export function parseManualRuleWithAi(
  client: HttpClient,
  input: RuleAiParsingRequest,
): Promise<RuleAiParsingResponse> {
  return client.request({
    method: "POST",
    url: "/api/v1/editorial-rules/ai-intake/parse-manual-rule",
    body: input,
  });
}
```

- [ ] **Step 4: Expose controller methods**

In `template-governance-controller.ts`, add controller methods:

```ts
createRuleAiIntakeDraft(input: RuleAiIntakeDraftRequest) {
  return requestCreateRuleAiIntakeDraft(client, input);
}

parseManualRuleWithAi(input: RuleAiParsingRequest) {
  return requestParseManualRuleWithAi(client, input);
}
```

- [ ] **Step 5: Run web API/controller tests**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/editorial-rules-api.spec.ts ./test/template-governance-controller.spec.ts`

Expected: PASS.

---

## Task 6: Add AI Parsing to the Existing Five-Step Wizard

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-api.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-step-semantic.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard.tsx`
- Test: `apps/web/test/template-governance-rule-wizard.spec.tsx`

- [ ] **Step 1: Write failing wizard tests**

Add tests proving:

```tsx
assert.match(markup, /AI解析/u);
assert.match(markup, /AI看到的规则理解/u);
assert.match(markup, /一致性检查/u);
```

and that a blocking AI parsing finding prevents direct publish but still allows saving draft/submitting review.

- [ ] **Step 2: Extend wizard semantic view model**

Add optional `aiParsing`:

```ts
aiParsing?: {
  aiUnderstandingSummary: string;
  consistency: RuleAiParsingResponse["consistency"];
  findings: RuleAiParsingResponse["findings"];
  requiresHumanConfirmation: boolean;
  warnings: string[];
}
```

Add a helper to map form state into `RuleAiParsingRequest`:

```ts
export function createRuleWizardAiParsingInput(
  form: RuleWizardEntryFormState,
): RuleAiParsingRequest {
  return {
    rule_fields: {
      title: form.title,
      rule_body: form.ruleBody,
      module_scope: form.moduleScope,
      manuscript_types: form.manuscriptTypes,
      sections: form.sections,
      evidence: form.supplementalBlocks?.map((block) => ({
        kind: block.block_type === "table_block" ? "table_snapshot" : block.block_type === "image_block" ? "image_understanding" : "user_description",
        text: JSON.stringify(block.content_payload),
        authority: "review_required",
      })),
    },
  };
}
```

- [ ] **Step 3: Render AI parsing in semantic step**

In `template-governance-rule-wizard-step-semantic.tsx`, render:

```tsx
<section className="template-governance-ai-parsing-panel">
  <h3>AI解析</h3>
  <p>AI看到的规则理解：{semantic.aiParsing.aiUnderstandingSummary}</p>
  <p>一致性检查：{formatRuleAiParsingConsistency(semantic.aiParsing.consistency)}</p>
  <ul>
    {semantic.aiParsing.findings.map((finding) => (
      <li key={`${finding.field}-${finding.message}`}>
        {finding.severity}：{finding.field} - {finding.message}
      </li>
    ))}
  </ul>
</section>
```

Use existing card styling; do not add a sixth step.

- [ ] **Step 4: Trigger parsing from wizard**

In `template-governance-rule-wizard.tsx`, when advancing into or refreshing the semantic step, call controller `parseManualRuleWithAi` if a controller is available and a draft has a non-empty `ruleBody`.

If parsing fails, show a non-blocking warning and keep existing manual flow usable.

- [ ] **Step 5: Enforce publish guard only for AI blocking findings**

If `aiParsing.findings.some(f => f.severity === "blocking")`, disable direct publish and show “需先处理 AI 解析阻断项或提交审核”.

Do not block saving drafts.

- [ ] **Step 6: Run wizard tests**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-wizard.spec.tsx`

Expected: PASS.

---

## Task 7: Add AI Draft Intake Entry and Apply-to-Wizard Flow

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-workbench-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-wizard-api.ts`
- Test: `apps/web/test/template-governance-workbench-page.spec.tsx`

- [ ] **Step 1: Write failing UI flow tests**

Add tests proving the rule ledger renders:

```tsx
assert.match(markup, /AI生成规则草稿/u);
```

and that applying an AI draft opens the existing rule wizard in create mode with rule body, scope, evidence, warnings, and review-only posture populated.

- [ ] **Step 2: Add the ledger action**

In `template-governance-rule-ledger-page.tsx`, add an action button:

```tsx
<button type="button" onClick={onCreateAiRuleDraft}>
  AI生成规则草稿
</button>
```

Wire the callback through existing page props.

- [ ] **Step 3: Add workbench intake panel state**

In `template-governance-workbench-page.tsx`, add state:

```ts
const [ruleAiIntakeDescription, setRuleAiIntakeDescription] = useState("");
const [ruleAiIntakeResult, setRuleAiIntakeResult] = useState<RuleAiIntakeDraftResponse | null>(null);
const [ruleAiIntakeStatus, setRuleAiIntakeStatus] = useState<"idle" | "loading" | "error">("idle");
```

Render a compact panel with textarea, context summary, generate button, draft preview, and “应用到规则向导”.

- [ ] **Step 4: Apply AI draft to existing wizard form state**

Add a helper:

```ts
export function createRuleWizardEntryFormStateFromAiDraft(
  response: RuleAiIntakeDraftResponse,
): RuleWizardEntryFormStateInput {
  return {
    title: response.draft.ai_understanding_summary.slice(0, 80),
    moduleScope: response.draft.scope.module_scope ?? "proofreading",
    manuscriptTypes: response.draft.scope.manuscript_types ?? "any",
    ruleBody: [
      response.draft.ai_understanding_summary,
      `命中对象：${response.draft.target_object}`,
      `触发条件：${response.draft.trigger}`,
      `执行动作：${response.draft.action}`,
      ...(response.draft.exclusions ?? []).map((item) => `排除边界：${item}`),
    ].join("\n"),
    sections: response.draft.scope.sections ?? [],
    sourceBasis: response.draft.evidence.map((item) => item.text).filter(Boolean).join("\n"),
    candidateOnly: true,
    conflictNotes: response.similar_rule_matches.map((match) => `${match.kind}: ${match.title} - ${match.rationale}`).join("\n"),
  };
}
```

Set `candidateOnly: true` so AI drafts default to review, not direct publish.

- [ ] **Step 5: Run workbench UI tests**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-workbench-page.spec.tsx`

Expected: PASS.

---

## Task 8: Add Rule Total-Ledger AI Source Display

**Files:**
- Modify: `apps/web/src/features/template-governance/template-governance-ledger-types.ts`
- Modify: `apps/web/src/features/template-governance/template-governance-rule-ledger-page.tsx`
- Modify: `apps/web/src/features/template-governance/template-governance-controller.ts`
- Test: `apps/web/test/template-governance-rule-ledger-page.spec.tsx`

- [ ] **Step 1: Write failing ledger metadata tests**

Add a row with:

```ts
ai_source_type: "ai_draft_generation",
ai_review_status: "awaiting_human_review",
ai_evidence_summary: "用户描述：摘要首次出现英文缩写...",
```

Assert the ledger renders:

```tsx
assert.match(markup, /AI草稿生成/u);
assert.match(markup, /待人工审核/u);
```

- [ ] **Step 2: Add optional ledger fields**

In `template-governance-ledger-types.ts`:

```ts
ai_source_type?: "none" | "ai_draft_generation" | "ai_semantic_parse";
ai_review_status?: "ai_draft" | "awaiting_human_review" | "human_confirmed" | "rejected";
ai_evidence_summary?: string;
similar_rule_resolution_summary?: string;
```

- [ ] **Step 3: Map AI metadata from authoring payload**

In controller ledger mappers, read:

```ts
const aiMetadata = asRecord(rule.authoring_payload.ai_intake_metadata);
```

and populate the optional ledger fields without changing old rows.

- [ ] **Step 4: Render ledger metadata**

In the rule ledger page, render source/status badges only when optional fields exist.

- [ ] **Step 5: Run ledger tests**

Run: `pnpm --filter @medsys/web exec node --import tsx --test ./test/template-governance-rule-ledger-page.spec.tsx`

Expected: PASS.

---

## Task 9: Final Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run focused contract tests**

Run: `pnpm --filter @medical/contracts test`

Expected: PASS.

- [ ] **Step 2: Run focused API tests**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/rule-ai-intake-service.spec.ts ./test/editorial-rules/rule-ai-parsing-service.spec.ts ./test/http/rule-ai-intake-http.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run focused web tests**

Run:

```bash
pnpm --filter @medsys/web exec node --import tsx --test ./test/editorial-rules-api.spec.ts ./test/template-governance-controller.spec.ts ./test/template-governance-rule-wizard.spec.tsx ./test/template-governance-workbench-page.spec.tsx ./test/template-governance-rule-ledger-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 4: Run typechecks**

Run:

```bash
pnpm --filter @medical/api typecheck
pnpm --filter @medsys/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Check diff hygiene**

Run: `git diff --check`

Expected: no whitespace errors.

---

## Explicitly Deferred Work

- Journal rule document batch extraction.
- Manuscript original/edited diff rule extraction.
- Persistent standalone AI draft tables and migrations.
- Automatic duplicate merge.
- Automatic old-rule replacement or priority rewriting.
- Full cross-layer runtime priority redesign for template family/module/journal/medical/general precedence.
- LLM-based similarity search over the full rule ledger.
