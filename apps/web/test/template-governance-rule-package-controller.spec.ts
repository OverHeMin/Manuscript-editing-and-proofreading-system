import assert from "node:assert/strict";
import test from "node:test";
import { createTemplateGovernanceWorkbenchController } from "../src/features/template-governance/template-governance-controller.ts";

test("template governance controller creates uploaded sessions and loads rule-package workspace by source union", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createTemplateGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (
        input.url ===
          "/api/v1/editorial-rules/rule-packages/example-source-sessions" &&
        input.method === "POST"
      ) {
        return {
          status: 201,
          body: {
            session_id: "session-demo-1",
            source_kind: "uploaded_example_pair",
            original_asset: {
              file_name: "原稿.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            },
            edited_asset: {
              file_name: "编后稿.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            },
            created_at: "2026-04-10T10:00:00.000Z",
            expires_at: "2026-04-11T10:00:00.000Z",
          } as TResponse,
        };
      }

      if (
        input.url === "/api/v1/editorial-rules/rule-packages/workspace" &&
        input.method === "POST"
      ) {
        return {
          status: 200,
          body: {
            source: {
              sourceKind: "uploaded_example_pair",
              exampleSourceSessionId: "session-demo-1",
            },
            selectedPackageId: "package-front-matter",
            candidates: [
              {
                package_id: "package-front-matter",
                package_kind: "front_matter",
                title: "前置信息包",
                rule_object: "front_matter",
                suggested_layer: "journal_template",
                automation_posture: "guarded_auto",
                status: "draft",
                cards: {
                  rule_what: {
                    title: "前置信息包",
                    object: "front_matter",
                    publish_layer: "journal_template",
                  },
                  ai_understanding: {
                    summary: "统一作者、单位与通信作者块。",
                    hit_objects: ["author_line"],
                    hit_locations: ["front_matter"],
                  },
                  applicability: {
                    manuscript_types: ["clinical_study"],
                    modules: ["editing"],
                    sections: ["front_matter"],
                    table_targets: [],
                  },
                  evidence: {
                    examples: [
                      {
                        before: "第一作者：张三",
                        after: "（作者简介）张三",
                      },
                    ],
                  },
                  exclusions: {
                    not_applicable_when: ["原稿作者元数据缺失"],
                    human_review_required_when: ["新增通信作者"],
                    risk_posture: "guarded_auto",
                  },
                },
                preview: {
                  hit_summary: "命中前置信息块。",
                  hits: [
                    {
                      target: "author_line",
                      reason: "作者行样式发生归一化。",
                      matched_text: "张三 李四",
                    },
                  ],
                  misses: [],
                  decision: {
                    automation_posture: "guarded_auto",
                    needs_human_review: true,
                    reason: "新增或改写作者元数据时需人工复核。",
                  },
                },
                semantic_draft: {
                  semantic_summary: "统一作者、单位与通信作者块。",
                  hit_scope: ["author_line:text_style_normalization"],
                  applicability: ["front_matter"],
                  evidence_examples: [
                    {
                      before: "第一作者：张三",
                      after: "（作者简介）张三",
                    },
                  ],
                  failure_boundaries: ["原稿作者元数据缺失"],
                  normalization_recipe: ["统一作者与通信作者标签"],
                  review_policy: ["新增通信作者时人工复核"],
                  confirmed_fields: ["summary", "evidence"],
                },
                supporting_signals: [],
              },
            ],
          } as TResponse,
        };
      }

      if (
        input.url === "/api/v1/editorial-rules/rule-packages/preview" &&
        input.method === "POST"
      ) {
        return {
          status: 200,
          body: {
            hit_summary: "命中前置信息块。",
            hits: [
              {
                target: "author_line",
                reason: "作者行样式发生归一化。",
                matched_text: "张三 李四",
              },
            ],
            misses: [
              {
                target: "classification_line",
                reason: "样本文本中未出现分类号。",
              },
            ],
            decision: {
              automation_posture: "guarded_auto",
              needs_human_review: true,
              reason: "新增作者元数据时需要人工复核。",
            },
          } as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const session = await controller.createRulePackageExampleSourceSession({
    originalFile: {
      fileName: "原稿.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileContentBase64: "b3JpZ2luYWw=",
    },
    editedFile: {
      fileName: "编后稿.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileContentBase64: "ZWRpdGVk",
    },
  });

  assert.equal(session.session_id, "session-demo-1");

  const workspace = await controller.loadRulePackageWorkspace({
    sourceKind: "uploaded_example_pair",
    exampleSourceSessionId: session.session_id,
  });

  assert.equal(workspace.candidates.length, 1);
  assert.equal(workspace.selectedPackageId, "package-front-matter");

  const preview = await controller.previewRulePackageDraft({
    packageDraft: {
      ...workspace.candidates[0],
      preview: undefined,
    },
    sampleText: "作者行 张三 李四 通信作者 王五",
  });

  assert.equal(preview.hits.length, 1);
  assert.equal(
    requests.some(
      (request) =>
        request.url ===
        "/api/v1/editorial-rules/rule-packages/example-source-sessions",
    ),
    true,
  );
  assert.equal(
    requests.some(
      (request) =>
        request.url === "/api/v1/editorial-rules/rule-packages/workspace",
    ),
    true,
  );
  assert.equal(
    requests.some(
      (request) => request.url === "/api/v1/editorial-rules/rule-packages/preview",
    ),
    true,
  );
});

test("template governance controller previews package compile results and compiles into a draft rule set", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createTemplateGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (
        input.url ===
          "/api/v1/editorial-rules/rule-packages/compile-preview" &&
        input.method === "POST"
      ) {
        return {
          status: 200,
          body: {
            packages: [
              {
                package_id: "package-front-matter",
                readiness: {
                  status: "ready",
                  reasons: [],
                },
                draft_rule_seeds: [
                  {
                    package_id: "package-front-matter",
                    coverage_key: "author_line::demo",
                    rule_object: "author_line",
                    rule_type: "format",
                    execution_mode: "apply_and_inspect",
                    confidence_policy: "high_confidence_only",
                    severity: "warning",
                    scope: {
                      sections: ["front_matter"],
                    },
                    selector: {
                      section_selector: "front_matter",
                    },
                    trigger: {
                      kind: "author_line_pattern",
                    },
                    action: {
                      kind: "inspect_author_line",
                    },
                    authoring_payload: {
                      source: "rule_package_compile",
                    },
                  },
                ],
                overrides_published_coverage_keys: [],
                warnings: [],
              },
            ],
          } as TResponse,
        };
      }

      if (
        input.url ===
          "/api/v1/editorial-rules/rule-packages/compile-to-draft" &&
        input.method === "POST"
      ) {
        return {
          status: 200,
          body: {
            rule_set_id: "rule-set-draft-1",
            target_mode: "reused_selected_draft",
            created_rule_ids: ["rule-1"],
            replaced_rule_ids: [],
            skipped_packages: [],
            publish_readiness: {
              status: "review_before_publish",
              reasons: [
                "1 compiled rule overlaps with published coverage and should be reviewed before publish.",
              ],
              blocked_package_count: 0,
              override_count: 1,
              guarded_rule_count: 1,
              inspect_rule_count: 0,
            },
            projection_readiness: {
              projected_kinds: ["rule", "checklist", "prompt_snippet"],
              confirmed_semantic_fields: [
                "summary",
                "applicability",
                "evidence",
                "boundaries",
              ],
              withheld_semantic_fields: [],
              reasons: [
                "Confirmed semantic fields will be projected after the draft rule set is published.",
              ],
            },
          } as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const packageDraft = {
    package_id: "package-front-matter",
    package_kind: "front_matter" as const,
    title: "Front matter package",
    rule_object: "front_matter",
    suggested_layer: "journal_template" as const,
    automation_posture: "guarded_auto" as const,
    status: "draft" as const,
    cards: {
      rule_what: {
        title: "Front matter package",
        object: "front_matter",
        publish_layer: "journal_template" as const,
      },
      ai_understanding: {
        summary: "Normalize front matter blocks.",
        hit_objects: ["author_line"],
        hit_locations: ["front_matter"],
      },
      applicability: {
        manuscript_types: ["clinical_study"],
        modules: ["editing"],
        sections: ["front_matter"],
        table_targets: [],
      },
      evidence: {
        examples: [
          {
            before: "First author: Zhang San",
            after: "Author: Zhang San",
          },
        ],
      },
      exclusions: {
        not_applicable_when: ["Source metadata is missing."],
        human_review_required_when: ["A corresponding author is added."],
        risk_posture: "guarded_auto" as const,
      },
    },
    semantic_draft: {
      semantic_summary: "Normalize front matter blocks.",
      hit_scope: ["author_line:text_style_normalization"],
      applicability: ["front_matter"],
      evidence_examples: [
        {
          before: "First author: Zhang San",
          after: "Author: Zhang San",
        },
      ],
      failure_boundaries: ["Source metadata is missing."],
      normalization_recipe: ["Normalize author labels."],
      review_policy: ["Review when a corresponding author is added."],
      confirmed_fields: ["summary", "applicability", "evidence", "boundaries"],
    },
    supporting_signals: [],
  };

  const preview = await controller.previewRulePackageCompile({
    source: {
      sourceKind: "uploaded_example_pair",
      exampleSourceSessionId: "session-demo-1",
    },
    packageDrafts: [packageDraft],
    templateFamilyId: "family-1",
    module: "editing",
  });

  assert.equal(preview.packages[0]?.readiness.status, "ready");

  const result = await controller.compileRulePackagesToDraft({
    actorRole: "admin",
    source: {
      sourceKind: "uploaded_example_pair",
      exampleSourceSessionId: "session-demo-1",
    },
    packageDrafts: [packageDraft],
    templateFamilyId: "family-1",
    module: "editing",
  });

  assert.equal(result.created_rule_ids.length, 1);
  assert.equal(result.target_mode, "reused_selected_draft");
  assert.equal(result.publish_readiness.status, "review_before_publish");
  assert.equal(result.publish_readiness.override_count, 1);
  assert.deepEqual(result.projection_readiness.projected_kinds, [
    "rule",
    "checklist",
    "prompt_snippet",
  ]);
  assert.deepEqual(result.projection_readiness.confirmed_semantic_fields, [
    "summary",
    "applicability",
    "evidence",
    "boundaries",
  ]);
  assert.equal(
    requests.some(
      (request) =>
        request.url === "/api/v1/editorial-rules/rule-packages/compile-preview",
    ),
    true,
  );
  assert.equal(
    requests.some(
      (request) =>
        request.url === "/api/v1/editorial-rules/rule-packages/compile-to-draft",
    ),
    true,
  );
});

test("template governance controller loads extraction tasks and selected task candidates", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createTemplateGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (
        input.url === "/api/v1/editorial-rules/extraction-tasks" &&
        input.method === "GET"
      ) {
        return {
          status: 200,
          body: [
            {
              id: "task-demo-1",
              task_name: "原稿/编辑稿提取",
              manuscript_type: "clinical_study",
              original_file_name: "original.docx",
              edited_file_name: "edited.docx",
              source_session_id: "session-demo-1",
              status: "awaiting_confirmation",
              candidate_count: 2,
              pending_confirmation_count: 2,
              created_at: "2026-04-13T09:30:00.000Z",
              updated_at: "2026-04-13T09:30:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (
        input.url === "/api/v1/editorial-rules/extraction-tasks/task-demo-1" &&
        input.method === "GET"
      ) {
        return {
          status: 200,
          body: {
            id: "task-demo-1",
            task_name: "原稿/编辑稿提取",
            manuscript_type: "clinical_study",
            original_file_name: "original.docx",
            edited_file_name: "edited.docx",
            source_session_id: "session-demo-1",
            status: "awaiting_confirmation",
            candidate_count: 2,
            pending_confirmation_count: 2,
            created_at: "2026-04-13T09:30:00.000Z",
            updated_at: "2026-04-13T09:30:00.000Z",
            candidates: [
              {
                id: "candidate-demo-1",
                task_id: "task-demo-1",
                package_id: "package-front-matter",
                package_kind: "front_matter",
                title: "前置信息包",
                confirmation_status: "ai_semantic_ready",
                suggested_destination: "template",
                candidate_payload: {
                  package_id: "package-front-matter",
                  package_kind: "front_matter",
                  title: "前置信息包",
                  rule_object: "front_matter",
                  suggested_layer: "journal_template",
                  automation_posture: "guarded_auto",
                  status: "draft",
                  cards: {
                    rule_what: {
                      title: "前置信息包",
                      object: "front_matter",
                      publish_layer: "journal_template",
                    },
                    ai_understanding: {
                      summary: "统一作者、单位与通讯作者块。",
                      hit_objects: ["author_line"],
                      hit_locations: ["front_matter"],
                    },
                    applicability: {
                      manuscript_types: ["clinical_study"],
                      modules: ["editing"],
                      sections: ["front_matter"],
                      table_targets: [],
                    },
                    evidence: {
                      examples: [],
                    },
                    exclusions: {
                      not_applicable_when: [],
                      human_review_required_when: [],
                      risk_posture: "guarded_auto",
                    },
                  },
                  preview: {
                    hit_summary: "命中前置信息块。",
                    hits: [],
                    misses: [],
                    decision: {
                      automation_posture: "guarded_auto",
                      needs_human_review: true,
                      reason: "需人工确认。",
                    },
                  },
                  semantic_draft: {
                    semantic_summary: "统一作者、单位与通讯作者块。",
                    hit_scope: ["author_line"],
                    applicability: ["front_matter"],
                    evidence_examples: [],
                    failure_boundaries: [],
                    normalization_recipe: ["统一作者标签"],
                    review_policy: ["人工确认后入库"],
                    confirmed_fields: [],
                  },
                },
                semantic_draft_payload: {
                  semantic_summary: "统一作者、单位与通讯作者块。",
                  hit_scope: ["author_line"],
                  applicability: ["front_matter"],
                  evidence_examples: [],
                  failure_boundaries: [],
                  normalization_recipe: ["统一作者标签"],
                  review_policy: ["人工确认后入库"],
                  confirmed_fields: [],
                },
                created_at: "2026-04-13T09:30:00.000Z",
                updated_at: "2026-04-13T09:30:00.000Z",
              },
            ],
          } as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const ledger = await controller.loadExtractionLedger();

  assert.equal(ledger.tasks.length, 1);
  assert.equal(ledger.selectedTaskId, "task-demo-1");
  assert.equal(
    ledger.selectedTask?.candidates[0]?.confirmation_status,
    "ai_semantic_ready",
  );
  assert.equal(ledger.summary.totalTaskCount, 1);
  assert.equal(ledger.summary.awaitingConfirmationCount, 2);
  assert.equal(
    requests.some(
      (request) => request.url === "/api/v1/editorial-rules/extraction-tasks",
    ),
    true,
  );
  assert.equal(
    requests.some(
      (request) =>
        request.url === "/api/v1/editorial-rules/extraction-tasks/task-demo-1",
    ),
    true,
  );
});

test("template governance controller loads governed content-module and template ledgers", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createTemplateGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (
        input.method === "GET" &&
        input.url.startsWith("/api/v1/templates/content-modules")
      ) {
        const moduleClass = new URL(
          `https://example.test${input.url}`,
        ).searchParams.get("moduleClass");

        if (moduleClass === "medical_specialized") {
          return {
            status: 200,
            body: [
              {
                id: "medical-module-1",
                module_class: "medical_specialized",
                name: "medical terminology guard",
                category: "medical_fact",
                manuscript_type_scope: ["clinical_study"],
                execution_module_scope: ["editing", "proofreading"],
                summary: "Focused on medical terminology and outcome wording.",
                template_usage_count: 2,
                evidence_level: "guideline",
                risk_level: "medium",
                status: "published",
                created_at: "2026-04-13T12:10:00.000Z",
                updated_at: "2026-04-13T12:10:00.000Z",
              },
            ] as TResponse,
          };
        }

        return {
          status: 200,
          body: [
            {
              id: "general-module-1",
              module_class: "general",
              name: "参考文献格式统一",
              category: "reference",
              manuscript_type_scope: ["review"],
              execution_module_scope: ["editing"],
              summary: "统一参考文献著录顺序与标点。",
              template_usage_count: 1,
              status: "draft",
              created_at: "2026-04-13T12:00:00.000Z",
              updated_at: "2026-04-13T12:00:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (
        input.url === "/api/v1/templates/template-compositions" &&
        input.method === "GET"
      ) {
        return {
          status: 200,
          body: [
            {
              id: "template-composition-1",
              name: "临床研究主模板",
              manuscript_type: "clinical_study",
              general_module_ids: ["general-module-1"],
              medical_module_ids: ["medical-module-1"],
              execution_module_scope: ["editing"],
              version_no: 1,
              status: "draft",
              created_at: "2026-04-13T12:00:00.000Z",
              updated_at: "2026-04-13T12:00:00.000Z",
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const moduleLedger = await controller.loadContentModuleLedger({
    moduleClass: "general",
  });
  const templateLedger = await controller.loadTemplateLedger();

  assert.equal(moduleLedger.modules.length, 1);
  assert.equal(moduleLedger.summary.totalCount, 1);
  assert.equal(templateLedger.templates.length, 1);
  assert.equal(templateLedger.generalModules.length, 1);
  assert.equal(templateLedger.medicalModules.length, 1);
  assert.equal(templateLedger.summary.templateCount, 1);
  assert.equal(
    requests.some(
      (request) =>
        request.url === "/api/v1/templates/content-modules?moduleClass=general",
    ),
    true,
  );
  assert.equal(
    requests.some(
      (request) =>
        request.url ===
        "/api/v1/templates/content-modules?moduleClass=medical_specialized",
    ),
    true,
  );
  assert.equal(
    requests.some(
      (request) => request.url === "/api/v1/templates/template-compositions",
    ),
    true,
  );
});
