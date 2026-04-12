from typing import Any, Literal


MANUSCRIPT_QUALITY_ACTION_LADDER = (
    "auto_fix",
    "suggest_fix",
    "manual_review",
    "block",
)
GENERAL_PROOFREADING_SCOPE = "general_proofreading"
MEDICAL_SPECIALIZED_SCOPE = "medical_specialized"

type ManuscriptQualityScope = Literal[
    "general_proofreading", "medical_specialized"
]
type ManuscriptQualityAction = Literal[
    "auto_fix", "suggest_fix", "manual_review", "block"
]
type ManuscriptQualitySeverity = Literal["low", "medium", "high", "critical"]
type ManuscriptQualityCategory = Literal[
    "punctuation_and_pairs",
    "full_half_width_and_spacing",
    "typo_redundancy_and_omission",
    "consistency",
    "sensitive_and_compliance",
    "sentence_and_logic",
    "medical_calculation_and_parsing",
    "medical_logic",
    "medical_norms_and_magnitude",
    "table_text_consistency",
    "system_fallback",
]
type ManuscriptQualitySourceKind = Literal[
    "deterministic_rule",
    "lexicon",
    "language_model",
    "third_party_adapter",
    "system_fallback",
]

type ParagraphBlock = dict[str, Any]
type SentenceBlock = dict[str, Any]
type NormalizedDocument = dict[str, Any]
type QualityIssue = dict[str, Any]
type QualityPackageRecord = dict[str, Any]
