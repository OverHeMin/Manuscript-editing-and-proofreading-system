import type {
  ExamplePairUploadInput,
  RulePackageCandidate,
  RulePackageDraft,
} from "@medical/contracts";
import { buildRealDocxGoldCase } from "./real-docx-rule-package-gold-case.ts";

export function buildRealSampleFixture(): ExamplePairUploadInput {
  return buildRealDocxGoldCase();
}

export function buildAbstractKeywordCandidate(): RulePackageDraft {
  return {
    package_id: "candidate-abstract-keywords",
    package_kind: "abstract_keywords",
    title: "摘要关键词包",
    rule_object: "abstract",
    suggested_layer: "template_family",
    automation_posture: "guarded_auto",
    status: "draft",
    cards: {
      rule_what: {
        title: "摘要与关键词规范",
        object: "abstract",
        publish_layer: "template_family",
      },
      ai_understanding: {
        summary: "统一摘要标签、关键词标签和分隔样式。",
        hit_objects: ["摘要", "关键词"],
        hit_locations: ["摘要段", "关键词段"],
      },
      applicability: {
        manuscript_types: ["clinical_study"],
        modules: ["editing"],
        sections: ["abstract"],
        table_targets: [],
      },
      evidence: {
        examples: [
          {
            before: "摘要 目的 观察治疗效果。关键词 高血压 疗效",
            after: "摘要：目的 观察治疗效果。关键词：高血压；疗效；预后",
          },
        ],
      },
      exclusions: {
        not_applicable_when: ["摘要已按期刊格式标注"],
        human_review_required_when: ["中英文摘要不一致"],
        risk_posture: "guarded_auto",
      },
    },
  };
}

export function buildRealGoldSnapshots(): Pick<
  ExamplePairUploadInput,
  "context" | "original" | "edited"
> {
  const fixture = buildRealSampleFixture();
  return {
    context: fixture.context,
    original: fixture.original,
    edited: fixture.edited,
  };
}

export function buildMiniFrontMatterFixture(): ExamplePairUploadInput {
  const fixture = buildRealSampleFixture();
  return {
    context: fixture.context,
    original: {
      ...fixture.original,
      sections: [],
      blocks: fixture.original.blocks.filter(
        (block) => block.section_key === "front_matter",
      ),
      tables: [],
    },
    edited: {
      ...fixture.edited,
      sections: [],
      blocks: fixture.edited.blocks.filter(
        (block) => block.section_key === "front_matter",
      ),
      tables: [],
    },
  };
}

export function buildMiniTableReferenceFixture(): ExamplePairUploadInput {
  const fixture = buildRealSampleFixture();
  return {
    context: fixture.context,
    original: {
      ...fixture.original,
      sections: fixture.original.sections.filter((section) =>
        isResultOrReferenceSectionHeading(section.heading),
      ),
      blocks: fixture.original.blocks.filter(
        (block) =>
          block.section_key === "results" || block.section_key === "reference",
      ),
      tables: fixture.original.tables,
    },
    edited: {
      ...fixture.edited,
      sections: fixture.edited.sections.filter((section) =>
        isResultOrReferenceSectionHeading(section.heading),
      ),
      blocks: fixture.edited.blocks.filter(
        (block) =>
          block.section_key === "results" || block.section_key === "reference",
      ),
      tables: fixture.edited.tables,
    },
  };
}

export function buildMiniTerminologyFixture(): ExamplePairUploadInput {
  return createMiniFixture({
    originalSections: [section(1, "摘要", 1, 1)],
    editedSections: [section(1, "摘要", 1, 1)],
    originalBlocks: [
      paragraph(
        "term-1",
        "abstract",
        "terminology",
        "检测中性粒细胞明胶酶相关脂质运载蛋白水平。",
      ),
    ],
    editedBlocks: [
      paragraph(
        "term-1",
        "abstract",
        "terminology",
        "检测 NGAL 水平。",
      ),
    ],
  });
}

export function buildMiniStatementFixture(): ExamplePairUploadInput {
  return createMiniFixture({
    originalSections: [],
    editedSections: [section(1, "伦理声明", 1, 12)],
    originalBlocks: [],
    editedBlocks: [
      paragraph(
        "statement-ethics",
        "back_matter",
        "statement",
        "伦理声明：本研究已通过医院伦理委员会审批。",
      ),
    ],
  });
}

export function buildMiniManuscriptStructureFixture(): ExamplePairUploadInput {
  return createMiniFixture({
    originalSections: [
      section(1, "摘要", 1, 1),
      section(2, "结果", 1, 8),
      section(3, "讨论", 1, 14),
    ],
    editedSections: [
      section(1, "摘要", 1, 1),
      section(2, "材料与方法", 1, 5),
      section(3, "结果", 1, 10),
      section(4, "讨论", 1, 16),
    ],
    originalBlocks: [],
    editedBlocks: [],
  });
}

function isResultOrReferenceSectionHeading(heading: string): boolean {
  const normalized = heading.replaceAll(/[\s　]/g, "");
  return normalized.startsWith("2") || normalized.includes("参考文献");
}

export function findCandidate(
  candidates: RulePackageCandidate[],
  packageKind: RulePackageCandidate["package_kind"],
): RulePackageCandidate | undefined {
  return candidates.find((candidate) => candidate.package_kind === packageKind);
}

function createMiniFixture(input: {
  originalSections: ExamplePairUploadInput["original"]["sections"];
  editedSections: ExamplePairUploadInput["edited"]["sections"];
  originalBlocks: ExamplePairUploadInput["original"]["blocks"];
  editedBlocks: ExamplePairUploadInput["edited"]["blocks"];
}): ExamplePairUploadInput {
  return {
    context: {
      manuscript_type: "clinical_study",
      module: "editing",
      journal_key: "journal-alpha",
    },
    original: {
      source: "original",
      parser_status: "ready",
      sections: input.originalSections,
      blocks: input.originalBlocks,
      tables: [],
      warnings: [],
    },
    edited: {
      source: "edited",
      parser_status: "ready",
      sections: input.editedSections,
      blocks: input.editedBlocks,
      tables: [],
      warnings: [],
    },
  };
}

function section(
  order: number,
  heading: string,
  level: number,
  paragraphIndex: number,
) {
  return {
    order,
    heading,
    level,
    paragraph_index: paragraphIndex,
  };
}

function paragraph(
  blockId: string,
  sectionKey: string,
  semanticRole: string,
  text: string,
) {
  return {
    block_id: blockId,
    kind: "paragraph" as const,
    section_key: sectionKey,
    semantic_role: semanticRole,
    text,
  };
}
