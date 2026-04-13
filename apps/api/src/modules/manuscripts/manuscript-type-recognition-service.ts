import type {
  ManuscriptType,
  ManuscriptTypeDetectionSummary,
} from "@medical/contracts";

export interface DetectManuscriptTypeInput {
  title: string;
  fileName: string;
  fileContentBase64?: string;
}

export interface ManuscriptTypeRecognitionService {
  detect(
    input: DetectManuscriptTypeInput,
  ): Promise<ManuscriptTypeDetectionSummary>;
}

interface HeuristicRule {
  type: ManuscriptType;
  confidence: number;
  rawSignals?: string[];
  normalizedSignals?: string[];
}

const HEURISTIC_RULES: readonly HeuristicRule[] = [
  {
    type: "meta_analysis",
    confidence: 0.94,
    rawSignals: ["meta-analysis"],
    normalizedSignals: ["meta analysis"],
  },
  {
    type: "systematic_review",
    confidence: 0.9,
    normalizedSignals: ["systematic review"],
  },
  {
    type: "case_report",
    confidence: 0.88,
    normalizedSignals: ["case report"],
  },
  {
    type: "guideline_interpretation",
    confidence: 0.87,
    normalizedSignals: ["guideline interpretation", "practice guideline"],
  },
  {
    type: "expert_consensus",
    confidence: 0.86,
    normalizedSignals: ["expert consensus", "consensus statement"],
  },
  {
    type: "clinical_study",
    confidence: 0.82,
    normalizedSignals: ["clinical study", "clinical trial"],
  },
];

export class HeuristicManuscriptTypeRecognitionService
  implements ManuscriptTypeRecognitionService
{
  async detect(
    input: DetectManuscriptTypeInput,
  ): Promise<ManuscriptTypeDetectionSummary> {
    const rawHaystack = [input.title, input.fileName, decodeInlineText(input.fileContentBase64)]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" ")
      .toLowerCase();
    const normalizedHaystack = normalizeText(rawHaystack);

    for (const rule of HEURISTIC_RULES) {
      const matchedSignals = collectMatchedSignals({
        rawHaystack,
        normalizedHaystack,
        rule,
      });

      if (matchedSignals.length === 0) {
        continue;
      }

      return {
        detected_type: rule.type,
        final_type: rule.type,
        source: "heuristic",
        confidence: rule.confidence,
        ...(matchedSignals.length > 0 ? { matched_signals: matchedSignals } : {}),
      };
    }

    return {
      detected_type: "review",
      final_type: "review",
      source: "heuristic",
      confidence: 0.52,
    };
  }
}

function collectMatchedSignals(input: {
  rawHaystack: string;
  normalizedHaystack: string;
  rule: HeuristicRule;
}): string[] {
  const matchedSignals = new Set<string>();

  for (const signal of input.rule.rawSignals ?? []) {
    if (input.rawHaystack.includes(signal)) {
      matchedSignals.add(signal);
    }
  }

  for (const signal of input.rule.normalizedSignals ?? []) {
    if (input.normalizedHaystack.includes(signal)) {
      matchedSignals.add(signal);
    }
  }

  return [...matchedSignals];
}

function normalizeText(value: string): string {
  return value
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function decodeInlineText(value: string | undefined): string {
  if (!value?.trim()) {
    return "";
  }

  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
  }
}
