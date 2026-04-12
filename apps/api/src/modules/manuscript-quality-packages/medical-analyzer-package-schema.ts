import type {
  ManuscriptQualityAction,
  ManuscriptQualitySeverity,
} from "@medical/contracts";
import { ManuscriptQualityPackageValidationError } from "./general-style-package-schema.ts";

const ALLOWED_ACTIONS = new Set<ManuscriptQualityAction>([
  "auto_fix",
  "suggest_fix",
  "manual_review",
  "block",
]);
const ALLOWED_SEVERITIES = new Set<ManuscriptQualitySeverity>([
  "low",
  "medium",
  "high",
  "critical",
]);

export interface MedicalAnalyzerIndicatorDefinition {
  aliases: string[];
  default_unit?: string;
}

export interface MedicalAnalyzerUnitRange {
  unit: string;
  min?: number;
  max?: number;
}

export interface MedicalAnalyzerIssuePolicy {
  severity: ManuscriptQualitySeverity;
  action: ManuscriptQualityAction;
}

export interface MedicalAnalyzerPackageManifest {
  indicator_dictionary: Record<string, MedicalAnalyzerIndicatorDefinition>;
  unit_ranges: Record<string, MedicalAnalyzerUnitRange[]>;
  comparison_templates: {
    pre_post: string[];
    group_comparison: string[];
  };
  count_constraints: Record<string, { max_percent?: number }>;
  issue_policy: Record<string, MedicalAnalyzerIssuePolicy>;
  analyzer_toggles: Record<string, boolean>;
}

export function isLegacyMedicalAnalyzerPackageManifest(
  manifest: Record<string, unknown>,
): boolean {
  return typeof manifest.analyzer_family === "string";
}

export function parseMedicalAnalyzerPackageManifest(
  manifest: Record<string, unknown>,
): MedicalAnalyzerPackageManifest {
  const indicatorDictionary = readRecord(
    manifest.indicator_dictionary,
    "medical_analyzer_package.indicator_dictionary must be an object.",
  );
  const unitRanges = readRecord(
    manifest.unit_ranges,
    "medical_analyzer_package.unit_ranges must be an object.",
  );
  const comparisonTemplates = readRecord(
    manifest.comparison_templates,
    "medical_analyzer_package.comparison_templates must be an object.",
  );
  const countConstraints = readRecord(
    manifest.count_constraints,
    "medical_analyzer_package.count_constraints must be an object.",
  );
  const issuePolicy = readRecord(
    manifest.issue_policy,
    "medical_analyzer_package.issue_policy must be an object.",
  );
  const analyzerToggles = readRecord(
    manifest.analyzer_toggles,
    "medical_analyzer_package.analyzer_toggles must be an object.",
  );

  return {
    indicator_dictionary: Object.fromEntries(
      Object.entries(indicatorDictionary).map(([indicatorKey, rawDefinition]) => {
        const definition = readRecord(
          rawDefinition,
          `medical_analyzer_package.indicator_dictionary.${indicatorKey} must be an object.`,
        );

        return [
          indicatorKey,
          {
            aliases: readStringArray(
              definition.aliases,
              `medical_analyzer_package.indicator_dictionary.${indicatorKey}.aliases must be a string array.`,
            ),
            ...(definition.default_unit === undefined
              ? {}
              : {
                  default_unit: readString(
                    definition.default_unit,
                    `medical_analyzer_package.indicator_dictionary.${indicatorKey}.default_unit must be a string.`,
                  ),
                }),
          },
        ];
      }),
    ),
    unit_ranges: Object.fromEntries(
      Object.entries(unitRanges).map(([metricKey, rawRanges]) => {
        if (!Array.isArray(rawRanges)) {
          throw new ManuscriptQualityPackageValidationError(
            `medical_analyzer_package.unit_ranges.${metricKey} must be an array.`,
          );
        }

        return [
          metricKey,
          rawRanges.map((rawRange, index) => {
            const range = readRecord(
              rawRange,
              `medical_analyzer_package.unit_ranges.${metricKey}[${index}] must be an object.`,
            );
            const normalizedRange: MedicalAnalyzerUnitRange = {
              unit: readString(
                range.unit,
                `medical_analyzer_package.unit_ranges.${metricKey}[${index}].unit must be a string.`,
              ),
            };

            if (range.min !== undefined) {
              normalizedRange.min = readNumber(
                range.min,
                `medical_analyzer_package.unit_ranges.${metricKey}[${index}].min must be a number.`,
              );
            }
            if (range.max !== undefined) {
              normalizedRange.max = readNumber(
                range.max,
                `medical_analyzer_package.unit_ranges.${metricKey}[${index}].max must be a number.`,
              );
            }

            return normalizedRange;
          }),
        ];
      }),
    ),
    comparison_templates: {
      pre_post: readNonEmptyStringArray(
        comparisonTemplates.pre_post,
        "medical_analyzer_package.comparison_templates.pre_post must be a non-empty string array.",
      ),
      group_comparison: readNonEmptyStringArray(
        comparisonTemplates.group_comparison,
        "medical_analyzer_package.comparison_templates.group_comparison must be a non-empty string array.",
      ),
    },
    count_constraints: Object.fromEntries(
      Object.entries(countConstraints).map(([constraintKey, rawConstraint]) => {
        const constraint = readRecord(
          rawConstraint,
          `medical_analyzer_package.count_constraints.${constraintKey} must be an object.`,
        );

        return [
          constraintKey,
          {
            ...(constraint.max_percent === undefined
              ? {}
              : {
                  max_percent: readNumber(
                    constraint.max_percent,
                    `medical_analyzer_package.count_constraints.${constraintKey}.max_percent must be a number.`,
                  ),
                }),
          },
        ];
      }),
    ),
    issue_policy: Object.fromEntries(
      Object.entries(issuePolicy).map(([issueKey, rawPolicy]) => {
        const policy = readRecord(
          rawPolicy,
          `medical_analyzer_package.issue_policy.${issueKey} must be an object.`,
        );
        const severity = policy.severity;
        const action = policy.action;

        if (!isAllowedSeverity(severity)) {
          throw new ManuscriptQualityPackageValidationError(
            `medical_analyzer_package.issue_policy.${issueKey}.severity must be one of: ${[...ALLOWED_SEVERITIES].join(", ")}.`,
          );
        }
        if (!isAllowedAction(action)) {
          throw new ManuscriptQualityPackageValidationError(
            `medical_analyzer_package.issue_policy.${issueKey}.action must be one of: ${[...ALLOWED_ACTIONS].join(", ")}.`,
          );
        }

        return [
          issueKey,
          {
            severity,
            action,
          },
        ];
      }),
    ),
    analyzer_toggles: Object.fromEntries(
      Object.entries(analyzerToggles).map(([toggleKey, rawValue]) => {
        if (typeof rawValue !== "boolean") {
          throw new ManuscriptQualityPackageValidationError(
            `medical_analyzer_package.analyzer_toggles.${toggleKey} must be a boolean.`,
          );
        }

        return [toggleKey, rawValue];
      }),
    ),
  };
}

function readRecord(
  value: unknown,
  message: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ManuscriptQualityPackageValidationError(message);
  }

  return value as Record<string, unknown>;
}

function readStringArray(value: unknown, message: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new ManuscriptQualityPackageValidationError(message);
  }

  return [...value];
}

function readNonEmptyStringArray(value: unknown, message: string): string[] {
  const result = readStringArray(value, message);
  if (result.length === 0) {
    throw new ManuscriptQualityPackageValidationError(message);
  }
  return result;
}

function readString(value: unknown, message: string): string {
  if (typeof value !== "string") {
    throw new ManuscriptQualityPackageValidationError(message);
  }

  return value;
}

function readNumber(value: unknown, message: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ManuscriptQualityPackageValidationError(message);
  }

  return value;
}

function isAllowedSeverity(
  value: unknown,
): value is ManuscriptQualitySeverity {
  return typeof value === "string" && ALLOWED_SEVERITIES.has(value as ManuscriptQualitySeverity);
}

function isAllowedAction(
  value: unknown,
): value is ManuscriptQualityAction {
  return typeof value === "string" && ALLOWED_ACTIONS.has(value as ManuscriptQualityAction);
}
