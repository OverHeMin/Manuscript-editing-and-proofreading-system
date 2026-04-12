import type {
  ManuscriptQualityAction,
  ManuscriptQualitySeverity,
} from "@medical/contracts";

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

export interface GeneralStyleSectionExpectation {
  required_labels?: string[];
}

export interface GeneralStyleIssuePolicy {
  severity: ManuscriptQualitySeverity;
  action: ManuscriptQualityAction;
}

export interface GeneralStylePackageManifest {
  section_expectations: Record<string, GeneralStyleSectionExpectation>;
  tone_markers: {
    strong_claims: string[];
    cautious_claims: string[];
  };
  posture_checks: {
    abstract: string[];
    results: string[];
    conclusion: string[];
  };
  genre_wording_suspicions?: string[];
  issue_policy: Record<string, GeneralStyleIssuePolicy>;
}

export class ManuscriptQualityPackageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManuscriptQualityPackageValidationError";
  }
}

export function isLegacyGeneralStylePackageManifest(
  manifest: Record<string, unknown>,
): boolean {
  return (
    typeof manifest.style_family === "string" ||
    typeof manifest.punctuation_profile === "string"
  );
}

export function parseGeneralStylePackageManifest(
  manifest: Record<string, unknown>,
): GeneralStylePackageManifest {
  const sectionExpectations = readRecord(
    manifest.section_expectations,
    "general_style_package.section_expectations must be an object.",
  );
  const toneMarkers = readRecord(
    manifest.tone_markers,
    "general_style_package.tone_markers must be an object.",
  );
  const postureChecks = readRecord(
    manifest.posture_checks,
    "general_style_package.posture_checks must be an object.",
  );
  const issuePolicy = readRecord(
    manifest.issue_policy,
    "general_style_package.issue_policy must be an object.",
  );

  return {
    section_expectations: Object.fromEntries(
      Object.entries(sectionExpectations).map(([sectionKey, rawExpectation]) => {
        const expectation = readRecord(
          rawExpectation,
          `general_style_package.section_expectations.${sectionKey} must be an object.`,
        );

        return [
          sectionKey,
          {
            ...(expectation.required_labels === undefined
              ? {}
              : {
                  required_labels: readStringArray(
                    expectation.required_labels,
                    `general_style_package.section_expectations.${sectionKey}.required_labels must be a string array.`,
                  ),
                }),
          },
        ];
      }),
    ),
    tone_markers: {
      strong_claims: readStringArray(
        toneMarkers.strong_claims,
        "general_style_package.tone_markers.strong_claims must be a string array.",
      ),
      cautious_claims: readStringArray(
        toneMarkers.cautious_claims,
        "general_style_package.tone_markers.cautious_claims must be a string array.",
      ),
    },
    posture_checks: {
      abstract: readStringArray(
        postureChecks.abstract,
        "general_style_package.posture_checks.abstract must be a string array.",
      ),
      results: readStringArray(
        postureChecks.results,
        "general_style_package.posture_checks.results must be a string array.",
      ),
      conclusion: readStringArray(
        postureChecks.conclusion,
        "general_style_package.posture_checks.conclusion must be a string array.",
      ),
    },
    ...(manifest.genre_wording_suspicions === undefined
      ? {}
      : {
          genre_wording_suspicions: readStringArray(
            manifest.genre_wording_suspicions,
            "general_style_package.genre_wording_suspicions must be a string array.",
          ),
        }),
    issue_policy: Object.fromEntries(
      Object.entries(issuePolicy).map(([issueKey, rawPolicy]) => {
        const policy = readRecord(
          rawPolicy,
          `general_style_package.issue_policy.${issueKey} must be an object.`,
        );
        const severity = policy.severity;
        const action = policy.action;

        if (!isAllowedSeverity(severity)) {
          throw new ManuscriptQualityPackageValidationError(
            `general_style_package.issue_policy.${issueKey}.severity must be one of: ${[...ALLOWED_SEVERITIES].join(", ")}.`,
          );
        }
        if (!isAllowedAction(action)) {
          throw new ManuscriptQualityPackageValidationError(
            `general_style_package.issue_policy.${issueKey}.action must be one of: ${[...ALLOWED_ACTIONS].join(", ")}.`,
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
