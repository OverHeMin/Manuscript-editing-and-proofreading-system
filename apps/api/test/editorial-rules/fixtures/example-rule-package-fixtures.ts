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
