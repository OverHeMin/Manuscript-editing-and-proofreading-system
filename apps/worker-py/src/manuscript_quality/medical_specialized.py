from __future__ import annotations

import hashlib
import math
import re
from collections import defaultdict

from document_enhancement.privacy import build_privacy_advisory

from .contracts import (
    MEDICAL_SPECIALIZED_SCOPE,
    NormalizedDocument,
    QualityIssue,
    QualityPackageRecord,
)
from .medical_asset_runtime import (
    is_analyzer_enabled,
    load_medical_assets,
    resolve_comparison_template_pairs,
    resolve_count_constraint,
    resolve_confusion_matrix_aliases,
    resolve_diagnostic_confidence_levels,
    resolve_diagnostic_metric_aliases,
    resolve_diagnostic_metric_range,
    resolve_group_comparison_groups,
    resolve_indicator_unit_ranges,
    resolve_issue_policy,
    resolve_regression_confidence_levels,
    resolve_regression_field_aliases,
)
from .text_normalization import build_normalized_document


ABBREVIATION_DEFINITION_PATTERN = re.compile(
    r"(?P<long>[A-Za-z][A-Za-z \-]{4,}?)\s*\((?P<abbr>[A-Z]{2,10})\)"
)
ENROLLED_COUNT_PATTERN = re.compile(
    r"\b(?P<count>\d{1,5})\s+(?:participants?|patients?|subjects?)\s+"
    r"(?:were\s+)?enrolled\b",
    re.IGNORECASE,
)
NARRATIVE_GROUP_COUNT_PATTERNS = (
    re.compile(
        r"\b(?P<count>\d{1,5})\s+(?:participants?|patients?|subjects?)\s+"
        r"(?:were\s+)?(?:assigned|allocated|randomized|included|enrolled)\s+"
        r"to\s+(?:the\s+)?(?P<group>treatment group|control group)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?P<group>treatment group|control group)\s*\(\s*n\s*[=:：]\s*(?P<count>\d{1,5})\s*\)",
        re.IGNORECASE,
    ),
)
SEX_COUNT_PAIR_PATTERNS = (
    re.compile(
        r"\b(?P<male>\d{1,5})\s+(?:male|males|men)\b.*?\b(?P<female>\d{1,5})\s+"
        r"(?:female|females|women)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?P<female>\d{1,5})\s+(?:female|females|women)\b.*?\b(?P<male>\d{1,5})\s+"
        r"(?:male|males|men)\b",
        re.IGNORECASE,
    ),
)
EVENT_COUNT_PATTERNS = (
    re.compile(
        r"\b(?P<count>\d{1,5})\s+(?:patients?|participants?|subjects?)\s+"
        r"(?:experienced|had|developed)\s+(?P<event>adverse events?|adverse reactions?|complications?)\b",
        re.IGNORECASE,
    ),
)
GROUP_EVENT_COUNT_PATTERNS = (
    re.compile(
        r"\b(?P<count>\d{1,5})\s+(?:patients?|participants?|subjects?)\s+in\s+"
        r"(?:the\s+)?(?P<group>treatment group|control group)\s+"
        r"(?:experienced|had|developed)\s+(?P<event>adverse events?|adverse reactions?|complications?)\b",
        re.IGNORECASE,
    ),
)
GROUP_EVENT_COUNT_INLINE_PATTERN = re.compile(
    r"\b(?P<count>\d{1,5})\s+(?:patients?|participants?|subjects?)\s+in\s+"
    r"(?:the\s+)?(?P<group>treatment group|control group)\b",
    re.IGNORECASE,
)
GROUP_EVENT_COUNT_PERCENT_PATTERNS = (
    re.compile(
        r"\b(?P<count>\d{1,5})\s*[\(\[]\s*(?P<percent>\d+(?:\.\d+)?)\s*%\s*[\)\]]\s+"
        r"(?:patients?|participants?|subjects?)\s+in\s+(?:the\s+)?"
        r"(?P<group>treatment group|control group)\s+"
        r"(?:experienced|had|developed)\s+(?P<event>adverse events?|adverse reactions?|complications?)\b",
        re.IGNORECASE,
    ),
)
GROUP_EVENT_COUNT_PERCENT_INLINE_PATTERN = re.compile(
    r"\b(?P<count>\d{1,5})\s*[\(\[]\s*(?P<percent>\d+(?:\.\d+)?)\s*%\s*[\)\]]\s+"
    r"(?:patients?|participants?|subjects?)\s+in\s+(?:the\s+)?"
    r"(?P<group>treatment group|control group)\b",
    re.IGNORECASE,
)
GROUP_EVENT_NAME_PATTERN = re.compile(
    r"\b(?:experienced|had|developed)\s+"
    r"(?P<event>adverse events?|adverse reactions?|complications?)\b",
    re.IGNORECASE,
)
COUNT_PERCENT_ROW_SUFFIX_PATTERN = re.compile(
    r"\s*[\(\[]\s*n\s*[\(\[]?\s*%\s*[\)\]]\s*[\)\]]\s*$",
    re.IGNORECASE,
)
EVENT_TOPIC_PATTERN = re.compile(
    r"\b(?P<event>"
    r"adverse event rate|adverse event count|adverse events?|"
    r"adverse reaction rate|adverse reactions?|"
    r"complication rate|complications?"
    r")\b",
    re.IGNORECASE,
)
GROUP_ATTRITION_COUNT_PATTERNS = (
    re.compile(
        r"\b(?P<count>\d{1,5})\s+(?:patients?|participants?|subjects?)\s+in\s+"
        r"(?:the\s+)?(?P<group>treatment group|control group)\s+"
        r"(?:were\s+)?(?:lost to follow-up|lost to follow up|withdrawn|withdrew|discontinued)\b",
        re.IGNORECASE,
    ),
)
GROUP_ANALYZED_COUNT_PATTERNS = (
    re.compile(
        r"\b(?P<count>\d{1,5})\s+(?:patients?|participants?|subjects?)\s+in\s+"
        r"(?:the\s+)?(?P<group>treatment group|control group)\s+"
        r"(?:were\s+)?analy[sz]ed\b",
        re.IGNORECASE,
    ),
)
ATTRITION_COUNT_PATTERNS = (
    re.compile(
        r"\b(?P<count>\d{1,5})\s+(?:patients?|participants?|subjects?)\s+"
        r"(?:were\s+)?(?:lost to follow-up|lost to follow up|withdrawn|withdrew|discontinued)\b",
        re.IGNORECASE,
    ),
)
ANALYZED_COUNT_PATTERNS = (
    re.compile(
        r"\b(?P<count>\d{1,5})\s+(?:patients?|participants?|subjects?)\s+"
        r"(?:were\s+)?analy[sz]ed\b",
        re.IGNORECASE,
    ),
)
FOLLOW_UP_DURATION_PATTERNS = (
    re.compile(
        r"\bfollow[\s-]?up(?:\s+period)?\s+(?:was|of)\s+(?P<value>\d{1,4})\s+"
        r"(?P<unit>days?|weeks?|months?|years?)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bfollowed\s+(?:for|up\s+for)\s+(?P<value>\d{1,4})\s+"
        r"(?P<unit>days?|weeks?|months?|years?)\b",
        re.IGNORECASE,
    ),
)
P_VALUE_PATTERN = re.compile(
    r"\bp\s*(?P<operator><=|>=|=|<|>)\s*(?P<value>\d+(?:\.\d+)?)\b",
    re.IGNORECASE,
)
CONFIDENCE_INTERVAL_PATTERN = re.compile(
    r"\b(?P<level>\d{1,2}(?:\.\d+)?)%\s*(?:CI|confidence interval)\s*[\[\(]?\s*"
    r"(?P<low>-?\d+(?:\.\d+)?)\s*(?:,|to|-|–|~)\s*(?P<high>-?\d+(?:\.\d+)?)\s*[\]\)]?",
    re.IGNORECASE,
)
INTERVAL_PAIR_PATTERN = re.compile(
    r"(?P<low>-?\d+(?:\.\d+)?)\s*(?:,|to|-|–|~)\s*(?P<high>-?\d+(?:\.\d+)?)"
)
PERCENT_PATTERN = re.compile(
    r"\b(?P<value>\d+(?:\.\d+)?)\s*%(?!\s*(?:CI|confidence interval)\b)",
    re.IGNORECASE,
)
LOW_EVIDENCE_MARKERS = (
    "observational study",
    "retrospective study",
    "case report",
    "case series",
)
OVERSTATED_CONCLUSION_MARKERS = (
    "proves",
    "definitively effective",
    "cures every patient",
    "for every patient",
)
SIGNIFICANT_POSITIVE_MARKERS = (
    "statistically significant",
    "significant improvement",
    "significant difference",
)
SIGNIFICANT_NEGATIVE_MARKERS = (
    "not statistically significant",
    "no statistically significant",
    "without statistical significance",
)
MEAN_SD_PATTERN = re.compile(
    r"(?P<mean>\d+(?:\.\d+)?)\s*(?:±|\+/-|¡À)\s*(?P<sd>\d+(?:\.\d+)?)"
)
DECIMAL_PATTERN = re.compile(r"\b\d+(?:\.\d+)?\b")
COUNT_CELL_PATTERN = re.compile(
    r"^(?:n\s*[=:：]\s*)?(?P<count>\d+(?:\.\d+)?)(?:\s*(?:例|人|cases?|patients?|subjects?|participants?))?$",
    re.IGNORECASE,
)
SAMPLE_SIZE_LABEL_MARKERS = (
    "sample size",
    "sample count",
    "participants",
    "patients",
    "subjects",
    "cases",
    "样本量",
    "样本数",
    "病例数",
    "受试者数",
    "纳入例数",
    "例数",
)
TOTAL_LABEL_MARKERS = (
    "total",
    "overall",
    "combined",
    "合计",
    "总计",
    "总体",
    "全部",
)


UNIT_TOKEN_PATTERN = (
    r"(?:U/L|IU/L|mmol/L|umol/L|mg/L|mg/dL|g/L|g/dL|ng/mL|pg/mL|mmHg|bpm|years?|kg|cm|mm|%)"
)
LABEL_UNIT_PATTERN = re.compile(
    rf"^(?P<metric>.+?)\s*[\(\[](?P<unit>{UNIT_TOKEN_PATTERN})[\)\]]$",
    re.IGNORECASE,
)
COUNT_PERCENT_PATTERN = re.compile(
    r"^(?P<count>\d+(?:\.\d+)?)\s*[\(\[](?P<percent>\d+(?:\.\d+)?)\s*%?[\)\]]$"
)
METRIC_UNIT_CLAIM_PATTERN = re.compile(
    rf"\b(?P<metric>[A-Za-z][A-Za-z0-9/ \-]{{1,40}}?)\s+"
    rf"(?:was|were|is)\s+"
    rf"(?P<value>\d+(?:\.\d+)?)\s*(?P<unit>{UNIT_TOKEN_PATTERN})\b",
    re.IGNORECASE,
)
AGE_RANGE_PATTERN = re.compile(
    r"\b(?:aged?|age(?:\s+range)?(?:\s+was|\s+of)?|mean age(?:\s+was|\s+of)?|median age(?:\s+was|\s+of)?)\s*"
    r"(?P<low>\d{1,3})(?:\s*(?:-|–|to|~)\s*(?P<high>\d{1,3}))?\s*years?\b",
    re.IGNORECASE,
)
UNIT_DRIFT_EXCLUDED_METRICS = {"participants", "patients", "subjects", "group", "groups"}
MAX_REASONABLE_AGE = 130
PRE_TREATMENT_MARKERS = (
    "before treatment",
    "baseline",
    "pre treatment",
    "pre-treatment",
    "pretreatment",
    "治疗前",
    "基线",
    "干预前",
)
POST_TREATMENT_MARKERS = (
    "after treatment",
    "post treatment",
    "post-treatment",
    "posttreatment",
    "follow up",
    "follow-up",
    "治疗后",
    "干预后",
    "随访后",
)
INCREASE_MARKERS = ("increased", "increase", "rose", "升高", "上升", "增加")
DECREASE_MARKERS = ("decreased", "decrease", "declined", "reduced", "fell", "下降", "降低", "减少")
HIGHER_THAN_MARKERS = ("higher than", "greater than", "more than", "高于")
LOWER_THAN_MARKERS = ("lower than", "less than", "低于")
SECTION_PREFIX_PATTERN = re.compile(
    r"^(?P<section>abstract|results|conclusion|discussion|methods)\s*:\s*",
    re.IGNORECASE,
)
GROUP_COMPARISON_REFERENCE_GROUPS = ("treatment group", "control group")
METRIC_TOKEN_PATTERN = re.compile(r"\b[A-Z]{2,10}\b")
CHI_SQUARE_PATTERN = re.compile(
    r"(?:χ2|χ²|chi-square|chi square)\s*(?:\(\s*(?P<df>\d+(?:\.\d+)?)\s*\))?\s*[=:]?\s*(?P<value>\d+(?:\.\d+)?)",
    re.IGNORECASE,
)
T_VALUE_PATTERN = re.compile(
    r"\bt\s*(?:\(\s*(?P<df>\d+(?:\.\d+)?)\s*\))?\s*[=:]?\s*(?P<value>-?\d+(?:\.\d+)?)",
    re.IGNORECASE,
)
F_VALUE_PATTERN = re.compile(
    r"\bf\s*\(\s*(?P<df1>\d+(?:\.\d+)?)\s*,\s*(?P<df2>\d+(?:\.\d+)?)\s*\)\s*[=:]?\s*(?P<value>-?\d+(?:\.\d+)?)",
    re.IGNORECASE,
)
GROUP_MEAN_SD_N_PATTERN = re.compile(
    r"(?P<group>treatment group|control group)\s+(?P<mean>-?\d+(?:\.\d+)?)\s*(?:卤|\+/-)\s*(?P<sd>\d+(?:\.\d+)?)\s*\(\s*n\s*[=:]?\s*(?P<n>\d+)\s*\)",
    re.IGNORECASE,
)
CONFIDENCE_LEVEL_Z_SCORES = {
    90.0: 1.645,
    95.0: 1.96,
    99.0: 2.576,
}
STATISTICAL_RECHECK_TOLERANCE = 0.01


def run_medical_specialized(
    blocks: list[dict],
    table_snapshots: list[dict] | None = None,
    quality_packages: list[QualityPackageRecord] | None = None,
) -> dict:
    normalized = build_normalized_document(blocks)
    medical_assets = load_medical_assets(quality_packages)
    issues: list[QualityIssue] = []
    issues.extend(check_medical_terminology_drift(normalized))
    if is_analyzer_enabled("numeric_consistency", medical_assets):
        issues.extend(check_medical_numeric_consistency(normalized, medical_assets))
        issues.extend(check_medical_norms_and_magnitude(normalized, medical_assets))
        issues.extend(
            check_table_norms_and_magnitude(
                normalized,
                table_snapshots,
                medical_assets,
            )
        )
        issues.extend(check_table_group_sum_consistency(normalized, table_snapshots))
        issues.extend(check_table_count_percent_consistency(normalized, table_snapshots))
        issues.extend(
            check_table_pre_post_direction_logic(
                normalized,
                table_snapshots,
                medical_assets,
            )
        )
    if is_analyzer_enabled("medical_logic", medical_assets):
        issues.extend(check_cross_section_direction_conflicts(normalized, medical_assets))
        issues.extend(
            check_cross_section_group_comparison_conflicts(normalized, medical_assets)
        )
        issues.extend(
            check_cross_section_group_event_comparison_conflicts(
                normalized,
                medical_assets,
            )
        )
    issues.extend(check_statistical_expression(normalized, medical_assets, table_snapshots))
    issues.extend(check_evidence_alignment(normalized))
    issues.extend(check_privacy_ethics(normalized))
    if is_analyzer_enabled("table_text_consistency", medical_assets):
        issues.extend(
            check_narrative_table_direction_consistency(
                normalized,
                table_snapshots,
                medical_assets,
            )
        )
        issues.extend(check_table_text_consistency(normalized, table_snapshots))

    return {
        "module_scope": MEDICAL_SPECIALIZED_SCOPE,
        **normalized,
        "issues": issues,
    }


def check_medical_terminology_drift(
    normalized: NormalizedDocument,
) -> list[QualityIssue]:
    definitions: dict[str, list[dict[str, object]]] = defaultdict(list)

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        for match in ABBREVIATION_DEFINITION_PATTERN.finditer(sentence_text):
            abbreviation = match.group("abbr")
            long_form = _normalize_long_form(match.group("long"))
            definitions[abbreviation].append(
                {
                    "long_form": long_form,
                    "raw_text": match.group(0),
                    "paragraph_index": sentence["paragraph_index"],
                    "sentence_index": sentence["sentence_index"],
                }
            )

    issues: list[QualityIssue] = []
    for abbreviation, entries in definitions.items():
        long_forms = {str(entry["long_form"]) for entry in entries}
        if len(long_forms) < 2:
            continue

        anchor = entries[0]
        issues.append(
            _build_issue(
                issue_type="medical_terminology.abbreviation_drift",
                category="medical_logic",
                severity="high",
                action="manual_review",
                confidence=0.9,
                paragraph_index=_as_int(anchor["paragraph_index"]),
                sentence_index=_as_int(anchor["sentence_index"]),
                text_excerpt=" / ".join(str(entry["raw_text"]) for entry in entries[:3]),
                normalized_excerpt=" / ".join(sorted(long_forms)),
                explanation=(
                    f"Abbreviation {abbreviation} maps to multiple long forms: "
                    + ", ".join(sorted(long_forms))
                    + "."
                ),
                source_kind="deterministic_rule",
                source_id="medical-terminology/abbreviation-drift",
            )
        )

    return issues


def check_medical_numeric_consistency(
    normalized: NormalizedDocument,
    medical_assets: dict[str, object],
) -> list[QualityIssue]:
    issues: list[QualityIssue] = []
    enrollment_claims = _collect_enrollment_claims(normalized)
    group_count_claims = _collect_narrative_group_count_claims(normalized)
    percent_constraint = resolve_count_constraint("percent", medical_assets)
    max_percent = _resolve_max_percent(percent_constraint)
    group_reference_groups = _resolve_group_comparison_reference_groups(medical_assets)

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        percent_match = PERCENT_PATTERN.search(sentence_text)
        if percent_match:
            percent_value = float(percent_match.group("value"))
            if percent_value > max_percent:
                issues.append(
                    _build_issue(
                        issue_type="medical_data_consistency.percent_out_of_range",
                        category="medical_norms_and_magnitude",
                        severity="high",
                        action="manual_review",
                        confidence=0.88,
                        paragraph_index=sentence["paragraph_index"],
                        sentence_index=sentence["sentence_index"],
                        text_excerpt=sentence_text,
                        normalized_excerpt=sentence_text,
                        explanation=(
                            f"Detected a percentage above the governed maximum "
                            f"({percent_value:g}% > {max_percent:g}%)."
                        ),
                        source_kind="deterministic_rule",
                        source_id="medical-data/percent-out-of-range",
                    )
                )

    distinct_counts = sorted({str(claim["count"]) for claim in enrollment_claims})
    if len(distinct_counts) > 1:
        anchor = enrollment_claims[0]
        issues.append(
            _build_issue(
                issue_type="medical_data_consistency.sample_size_conflict",
                category="medical_calculation_and_parsing",
                severity="high",
                action="manual_review",
                confidence=0.92,
                paragraph_index=_as_int(anchor["paragraph_index"]),
                sentence_index=_as_int(anchor["sentence_index"]),
                text_excerpt=" / ".join(str(claim["text"]) for claim in enrollment_claims),
                normalized_excerpt=" / ".join(
                    str(claim["text"]) for claim in enrollment_claims
                ),
                explanation=(
                    "Detected conflicting enrolled-participant counts: "
                    + ", ".join(distinct_counts)
                    + "."
                ),
                source_kind="deterministic_rule",
                source_id="medical-data/sample-size-conflict",
            )
        )

    follow_up_claims = _collect_follow_up_duration_claims(normalized)
    distinct_follow_up = sorted(
        {
            (
                int(claim["value"]),
                str(claim["unit"]),
                str(claim["display"]),
            )
            for claim in follow_up_claims
        }
    )
    if len(distinct_follow_up) > 1:
        anchor = follow_up_claims[0]
        issues.append(
            _build_issue(
                issue_type="medical_data_consistency.follow_up_duration_conflict",
                category="medical_calculation_and_parsing",
                severity="high",
                action="manual_review",
                confidence=0.88,
                paragraph_index=_as_int(anchor["paragraph_index"]),
                sentence_index=_as_int(anchor["sentence_index"]),
                text_excerpt=" / ".join(str(claim["text"]) for claim in follow_up_claims[:3]),
                normalized_excerpt=" / ".join(
                    str(claim["display"]) for claim in follow_up_claims[:3]
                ),
                explanation=(
                    "Detected conflicting follow-up durations: "
                    + ", ".join(str(duration[2]) for duration in distinct_follow_up)
                    + "."
                ),
                source_kind="deterministic_rule",
                source_id="medical-data/follow-up-duration-conflict",
            )
        )

    group_counts_by_group: dict[str, list[dict[str, object]]] = defaultdict(list)
    for claim in group_count_claims:
        group_counts_by_group[str(claim["group_key"])].append(claim)

    stable_group_counts: dict[str, dict[str, object]] = {}
    for group_key, claims_for_group in group_counts_by_group.items():
        distinct_group_counts = sorted({int(claim["count"]) for claim in claims_for_group})
        if len(distinct_group_counts) != 1:
            continue
        anchor = claims_for_group[0]
        stable_group_counts[group_key] = {
            "display_group": str(anchor["display_group"]),
            "count": distinct_group_counts[0],
        }

    for claims_for_group in group_counts_by_group.values():
        sections = {
            str(claim["section"])
            for claim in claims_for_group
            if str(claim.get("section", "")).strip()
        }
        distinct_group_counts = sorted({int(claim["count"]) for claim in claims_for_group})
        if len(sections) < 2 or len(distinct_group_counts) < 2:
            continue

        anchor = claims_for_group[0]
        section_summary = " / ".join(
            f'{str(claim["section"])}: {int(claim["count"]):g}'
            for claim in claims_for_group[:3]
        )
        issues.append(
            _build_issue(
                issue_type="medical_data_consistency.cross_section_group_count_conflict",
                category="medical_calculation_and_parsing",
                severity="high",
                action="manual_review",
                confidence=0.9,
                paragraph_index=_as_int(anchor["paragraph_index"]),
                sentence_index=_as_int(anchor["sentence_index"]),
                text_excerpt=" / ".join(str(claim["text"]) for claim in claims_for_group[:3]),
                normalized_excerpt=section_summary,
                explanation=(
                    f'{_display_group_label(str(anchor["display_group"]))} has conflicting '
                    f"group counts across sections ({section_summary})."
                ),
                source_kind="deterministic_rule",
                source_id="medical-data/cross-section-group-count-conflict",
            )
        )
        break

    group_event_claims_by_group: dict[str, list[dict[str, object]]] = defaultdict(list)
    for claim in _collect_group_event_count_claims(normalized):
        group_event_claims_by_group[str(claim["group_key"])].append(claim)

    sentence_event_claims: dict[tuple[int, int], list[dict[str, object]]] = defaultdict(
        list
    )
    paragraph_event_claims: dict[int, list[dict[str, object]]] = defaultdict(list)
    for claims_for_group in group_event_claims_by_group.values():
        for claim in claims_for_group:
            paragraph_index = _as_int(claim["paragraph_index"]) or 0
            sentence_event_claims[
                (
                    paragraph_index,
                    _as_int(claim["sentence_index"]) or 0,
                )
            ].append(claim)
            paragraph_event_claims[paragraph_index].append(claim)

    group_event_percent_claims_by_group: dict[str, list[dict[str, object]]] = defaultdict(
        list
    )
    for claim in _collect_group_event_count_percent_claims(normalized):
        group_event_percent_claims_by_group[str(claim["group_key"])].append(claim)

    for sentence in normalized["sentence_blocks"]:
        sentence_key = (
            _as_int(sentence["paragraph_index"]) or 0,
            _as_int(sentence["sentence_index"]) or 0,
        )
        claims_in_sentence = list(sentence_event_claims.get(sentence_key, []))
        paragraph_claims = paragraph_event_claims.get(sentence_key[0], [])
        if len(claims_in_sentence) < 2 and paragraph_claims:
            claims_in_sentence = list(paragraph_claims)
        if len(claims_in_sentence) < 2:
            continue

        lowered_sentence = _normalize_numeric_text(
            str(sentence["normalized_text"])
        ).lower()
        comparison_claim = _read_group_comparison_claim(
            lowered_sentence,
            group_reference_groups,
        )
        if not comparison_claim:
            continue

        original_left_group, original_right_group, original_relation = comparison_claim
        canonical_claim = _canonicalize_group_comparison_claim(*comparison_claim)
        if not canonical_claim:
            continue

        left_group, right_group, claimed_relation = canonical_claim
        claim_by_group: dict[str, dict[str, object]] = {}
        for claim in claims_in_sentence:
            group_key = str(claim["group_key"])
            existing = claim_by_group.get(group_key)
            if existing is None:
                claim_by_group[group_key] = claim
                continue
            if int(existing["count"]) != int(claim["count"]):
                claim_by_group = {}
                break

        left_claim = claim_by_group.get(left_group)
        right_claim = claim_by_group.get(right_group)
        if not left_claim or not right_claim:
            continue
        if str(left_claim["event_key"]) != str(right_claim["event_key"]):
            continue

        left_count = int(left_claim["count"])
        right_count = int(right_claim["count"])
        if left_count == right_count:
            continue

        actual_relation = "higher" if left_count > right_count else "lower"
        if actual_relation == claimed_relation:
            continue

        issues.append(
            _build_issue(
                issue_type="medical_data_consistency.group_comparison_event_count_conflict",
                category="medical_calculation_and_parsing",
                severity="high",
                action="manual_review",
                confidence=0.91,
                paragraph_index=_as_int(sentence["paragraph_index"]),
                sentence_index=_as_int(sentence["sentence_index"]),
                text_excerpt=str(sentence["normalized_text"]),
                normalized_excerpt=(
                    f'{_display_group_label(left_group)}={left_count:g}, '
                    f'{_display_group_label(right_group)}={right_count:g}'
                ),
                explanation=(
                    f'{str(left_claim["event"])} is described as '
                    f'{_display_group_label(original_left_group)} {original_relation} than '
                    f'{_display_group_label(original_right_group)}, but the '
                    f'reported counts are {left_count:g} vs {right_count:g}.'
                ),
                source_kind="deterministic_rule",
                source_id="medical-data/group-comparison-event-count-conflict",
            )
        )
        break

    sentence_event_percent_claims: dict[tuple[int, int], list[dict[str, object]]] = (
        defaultdict(list)
    )
    paragraph_event_percent_claims: dict[int, list[dict[str, object]]] = defaultdict(list)
    for claims_for_group in group_event_percent_claims_by_group.values():
        for claim in claims_for_group:
            paragraph_index = _as_int(claim["paragraph_index"]) or 0
            sentence_event_percent_claims[
                (
                    paragraph_index,
                    _as_int(claim["sentence_index"]) or 0,
                )
            ].append(claim)
            paragraph_event_percent_claims[paragraph_index].append(claim)

    for sentence in normalized["sentence_blocks"]:
        sentence_key = (
            _as_int(sentence["paragraph_index"]) or 0,
            _as_int(sentence["sentence_index"]) or 0,
        )
        claims_in_sentence = list(sentence_event_percent_claims.get(sentence_key, []))
        paragraph_claims = paragraph_event_percent_claims.get(sentence_key[0], [])
        if len(claims_in_sentence) < 2 and paragraph_claims:
            claims_in_sentence = list(paragraph_claims)
        if len(claims_in_sentence) < 2:
            continue

        lowered_sentence = _normalize_numeric_text(
            str(sentence["normalized_text"])
        ).lower()
        comparison_claim = _read_group_comparison_claim(
            lowered_sentence,
            group_reference_groups,
        )
        if not comparison_claim:
            continue

        original_left_group, original_right_group, original_relation = comparison_claim
        canonical_claim = _canonicalize_group_comparison_claim(*comparison_claim)
        if not canonical_claim:
            continue

        left_group, right_group, claimed_relation = canonical_claim
        claim_by_group: dict[str, dict[str, object]] = {}
        for claim in claims_in_sentence:
            group_key = str(claim["group_key"])
            existing = claim_by_group.get(group_key)
            if existing is None:
                claim_by_group[group_key] = claim
                continue
            if (
                int(existing["count"]) != int(claim["count"])
                or float(existing["percent"]) != float(claim["percent"])
            ):
                claim_by_group = {}
                break

        left_claim = claim_by_group.get(left_group)
        right_claim = claim_by_group.get(right_group)
        if not left_claim or not right_claim:
            continue
        if str(left_claim["event_key"]) != str(right_claim["event_key"]):
            continue

        left_percent = float(left_claim["percent"])
        right_percent = float(right_claim["percent"])
        if left_percent == right_percent:
            continue

        actual_relation = "higher" if left_percent > right_percent else "lower"
        if actual_relation == claimed_relation:
            continue

        issues.append(
            _build_issue(
                issue_type="medical_data_consistency.group_comparison_event_percent_conflict",
                category="medical_calculation_and_parsing",
                severity="high",
                action="manual_review",
                confidence=0.91,
                paragraph_index=_as_int(sentence["paragraph_index"]),
                sentence_index=_as_int(sentence["sentence_index"]),
                text_excerpt=str(sentence["normalized_text"]),
                normalized_excerpt=(
                    f'{_display_group_label(left_group)}={left_percent:g}%, '
                    f'{_display_group_label(right_group)}={right_percent:g}%'
                ),
                explanation=(
                    f'{str(left_claim["event"])} is described as '
                    f'{_display_group_label(original_left_group)} {original_relation} than '
                    f'{_display_group_label(original_right_group)}, but the '
                    f'reported percentages are {left_percent:g}% vs {right_percent:g}%.'
                ),
                source_kind="deterministic_rule",
                source_id="medical-data/group-comparison-event-percent-conflict",
            )
        )
        break

    event_claims_by_group_and_event: dict[tuple[str, str], list[dict[str, object]]] = (
        defaultdict(list)
    )
    for claims_for_group in group_event_claims_by_group.values():
        for claim in claims_for_group:
            event_claims_by_group_and_event[
                (str(claim["group_key"]), str(claim["event_key"]))
            ].append(claim)

    for (_, _), claims_for_event in event_claims_by_group_and_event.items():
        sections = {
            str(claim["section"])
            for claim in claims_for_event
            if str(claim.get("section", "")).strip()
        }
        distinct_counts = sorted({int(claim["count"]) for claim in claims_for_event})
        if len(sections) < 2 or len(distinct_counts) < 2:
            continue

        anchor = claims_for_event[0]
        section_summary = " / ".join(
            f'{str(claim["section"])}: {int(claim["count"]):g}'
            for claim in claims_for_event[:3]
        )
        issues.append(
            _build_issue(
                issue_type="medical_data_consistency.cross_section_group_event_count_conflict",
                category="medical_calculation_and_parsing",
                severity="high",
                action="manual_review",
                confidence=0.9,
                paragraph_index=_as_int(anchor["paragraph_index"]),
                sentence_index=_as_int(anchor["sentence_index"]),
                text_excerpt=" / ".join(str(claim["text"]) for claim in claims_for_event[:3]),
                normalized_excerpt=section_summary,
                explanation=(
                    f'{_display_group_label(str(anchor["display_group"]))} has conflicting '
                    f'{str(anchor["event"])} counts across sections ({section_summary}).'
                ),
                source_kind="deterministic_rule",
                source_id="medical-data/cross-section-group-event-count-conflict",
            )
        )
        break

    event_percent_claims_by_group_and_event: dict[
        tuple[str, str], list[dict[str, object]]
    ] = defaultdict(list)
    for claims_for_group in group_event_percent_claims_by_group.values():
        for claim in claims_for_group:
            event_percent_claims_by_group_and_event[
                (str(claim["group_key"]), str(claim["event_key"]))
            ].append(claim)

    for (_, _), claims_for_event in event_percent_claims_by_group_and_event.items():
        sections = {
            str(claim["section"])
            for claim in claims_for_event
            if str(claim.get("section", "")).strip()
        }
        distinct_pairs = sorted(
            {(int(claim["count"]), float(claim["percent"])) for claim in claims_for_event}
        )
        if len(sections) < 2 or len(distinct_pairs) < 2:
            continue

        anchor = claims_for_event[0]
        section_summary = " / ".join(
            (
                f'{str(claim["section"])}: {int(claim["count"]):g} '
                f'({float(claim["percent"]):g}%)'
            )
            for claim in claims_for_event[:3]
        )
        issues.append(
            _build_issue(
                issue_type="medical_data_consistency.cross_section_group_event_count_percent_conflict",
                category="medical_calculation_and_parsing",
                severity="high",
                action="manual_review",
                confidence=0.9,
                paragraph_index=_as_int(anchor["paragraph_index"]),
                sentence_index=_as_int(anchor["sentence_index"]),
                text_excerpt=" / ".join(str(claim["text"]) for claim in claims_for_event[:3]),
                normalized_excerpt=section_summary,
                explanation=(
                    f'{_display_group_label(str(anchor["display_group"]))} has conflicting '
                    f'{str(anchor["event"])} count-percent claims across sections '
                    f"({section_summary})."
                ),
                source_kind="deterministic_rule",
                source_id="medical-data/cross-section-group-event-count-percent-conflict",
            )
        )
        break

    for group_key, claims_for_group in group_event_claims_by_group.items():
        group_size = stable_group_counts.get(group_key)
        if group_size is None:
            continue

        distinct_event_counts = sorted({int(claim["count"]) for claim in claims_for_group})
        if len(distinct_event_counts) != 1:
            continue

        event_count = distinct_event_counts[0]
        if event_count <= int(group_size["count"]):
            continue

        anchor = claims_for_group[0]
        issues.append(
            _build_issue(
                issue_type="medical_data_consistency.group_event_count_exceeds_group_size",
                category="medical_calculation_and_parsing",
                severity="high",
                action="manual_review",
                confidence=0.9,
                paragraph_index=_as_int(anchor["paragraph_index"]),
                sentence_index=_as_int(anchor["sentence_index"]),
                text_excerpt=str(anchor["text"]),
                normalized_excerpt=(
                    f'{_display_group_label(str(group_size["display_group"]))}='
                    f'{int(group_size["count"]):g}'
                ),
                explanation=(
                    f'{_display_group_label(str(group_size["display_group"]))} has a detected '
                    f'sample size of {int(group_size["count"]):g}, but the manuscript states '
                    f'{event_count:g} patients in that group experienced '
                    f'{str(anchor["event"])}.'
                ),
                source_kind="deterministic_rule",
                source_id="medical-data/group-event-count-exceeds-group-size",
            )
        )
        break

    for group_key, claims_for_group in group_event_percent_claims_by_group.items():
        group_size = stable_group_counts.get(group_key)
        if group_size is None:
            continue

        distinct_pairs = sorted(
            {(int(claim["count"]), float(claim["percent"])) for claim in claims_for_group}
        )
        if len(distinct_pairs) != 1:
            continue

        count_value, reported_percent = distinct_pairs[0]
        expected_percent = count_value / int(group_size["count"]) * 100
        if abs(expected_percent - reported_percent) <= 1:
            continue

        anchor = claims_for_group[0]
        issues.append(
            _build_issue(
                issue_type="medical_data_consistency.group_event_count_percent_mismatch",
                category="medical_calculation_and_parsing",
                severity="high",
                action="manual_review",
                confidence=0.91,
                paragraph_index=_as_int(anchor["paragraph_index"]),
                sentence_index=_as_int(anchor["sentence_index"]),
                text_excerpt=str(anchor["text"]),
                normalized_excerpt=(
                    f'{_display_group_label(str(group_size["display_group"]))}='
                    f'{int(group_size["count"]):g}'
                ),
                explanation=(
                    f'{_display_group_label(str(group_size["display_group"]))} has a detected '
                    f'sample size of {int(group_size["count"]):g}; {count_value:g} '
                    f'participants with {str(anchor["event"])} implies about '
                    f'{expected_percent:g}%, but the manuscript states {reported_percent:g}%.'
                ),
                source_kind="deterministic_rule",
                source_id="medical-data/group-event-count-percent-mismatch",
            )
        )
        break

    group_attrition_claims_by_group: dict[str, list[dict[str, object]]] = defaultdict(list)
    for claim in _collect_group_attrition_count_claims(normalized):
        group_attrition_claims_by_group[str(claim["group_key"])].append(claim)

    group_analyzed_claims_by_group: dict[str, list[dict[str, object]]] = defaultdict(list)
    for claim in _collect_group_analyzed_count_claims(normalized):
        group_analyzed_claims_by_group[str(claim["group_key"])].append(claim)

    for group_key, attrition_claims in group_attrition_claims_by_group.items():
        group_size = stable_group_counts.get(group_key)
        if group_size is None:
            continue

        distinct_attrition_counts = sorted(
            {int(claim["count"]) for claim in attrition_claims}
        )
        if len(distinct_attrition_counts) != 1:
            continue

        attrition_count = distinct_attrition_counts[0]
        if attrition_count > int(group_size["count"]):
            anchor = attrition_claims[0]
            issues.append(
                _build_issue(
                    issue_type="medical_data_consistency.group_attrition_count_exceeds_group_size",
                    category="medical_calculation_and_parsing",
                    severity="high",
                    action="manual_review",
                    confidence=0.9,
                    paragraph_index=_as_int(anchor["paragraph_index"]),
                    sentence_index=_as_int(anchor["sentence_index"]),
                    text_excerpt=str(anchor["text"]),
                    normalized_excerpt=(
                        f'{_display_group_label(str(group_size["display_group"]))}='
                        f'{int(group_size["count"]):g}'
                    ),
                    explanation=(
                        f'{_display_group_label(str(group_size["display_group"]))} has a detected '
                        f'sample size of {int(group_size["count"]):g}, but the manuscript states '
                        f'{attrition_count:g} participants in that group were lost to follow-up.'
                    ),
                    source_kind="deterministic_rule",
                    source_id="medical-data/group-attrition-count-exceeds-group-size",
                )
            )
            break

        analyzed_claims = group_analyzed_claims_by_group.get(group_key)
        if not analyzed_claims:
            continue

        distinct_analyzed_counts = sorted(
            {int(claim["count"]) for claim in analyzed_claims}
        )
        if len(distinct_attrition_counts) != 1 or len(distinct_analyzed_counts) != 1:
            continue

        analyzed_count = distinct_analyzed_counts[0]
        expected_analyzed = int(group_size["count"]) - attrition_count
        if expected_analyzed == analyzed_count:
            continue

        anchor = analyzed_claims[0]
        issues.append(
            _build_issue(
                issue_type="medical_data_consistency.group_attrition_analysis_count_conflict",
                category="medical_calculation_and_parsing",
                severity="high",
                action="manual_review",
                confidence=0.91,
                paragraph_index=_as_int(anchor["paragraph_index"]),
                sentence_index=_as_int(anchor["sentence_index"]),
                text_excerpt=(
                    f'{str(attrition_claims[0]["text"])} / {str(analyzed_claims[0]["text"])}'
                ),
                normalized_excerpt=(
                    f'{_display_group_label(str(group_size["display_group"]))}: '
                    f'n={int(group_size["count"]):g}, attrition={attrition_count:g}, '
                    f'analyzed={analyzed_count:g}'
                ),
                explanation=(
                    f'{_display_group_label(str(group_size["display_group"]))} has a detected '
                    f'sample size of {int(group_size["count"]):g}; subtracting attrition count '
                    f'{attrition_count:g} implies {expected_analyzed:g} analyzed participants, '
                    f'but the manuscript states {analyzed_count:g}.'
                ),
                source_kind="deterministic_rule",
                source_id="medical-data/group-attrition-analysis-count-conflict",
            )
        )
        break

    for group_key, analyzed_claims in group_analyzed_claims_by_group.items():
        group_size = stable_group_counts.get(group_key)
        if group_size is None:
            continue

        distinct_analyzed_counts = sorted(
            {int(claim["count"]) for claim in analyzed_claims}
        )
        if len(distinct_analyzed_counts) != 1:
            continue

        analyzed_count = distinct_analyzed_counts[0]
        if analyzed_count <= int(group_size["count"]):
            continue

        anchor = analyzed_claims[0]
        issues.append(
            _build_issue(
                issue_type="medical_data_consistency.group_analyzed_count_exceeds_group_size",
                category="medical_calculation_and_parsing",
                severity="high",
                action="manual_review",
                confidence=0.9,
                paragraph_index=_as_int(anchor["paragraph_index"]),
                sentence_index=_as_int(anchor["sentence_index"]),
                text_excerpt=str(anchor["text"]),
                normalized_excerpt=(
                    f'{_display_group_label(str(group_size["display_group"]))}='
                    f'{int(group_size["count"]):g}'
                ),
                explanation=(
                    f'{_display_group_label(str(group_size["display_group"]))} has a detected '
                    f'sample size of {int(group_size["count"]):g}, but the manuscript states '
                    f'{analyzed_count:g} analyzed participants in that group.'
                ),
                source_kind="deterministic_rule",
                source_id="medical-data/group-analyzed-count-exceeds-group-size",
            )
        )
        break

    if len(distinct_counts) == 1 and len(group_count_claims) >= 2:
        grouped_counts: dict[str, dict[str, object]] = {}
        has_conflicting_group_counts = False

        for claim in group_count_claims:
            group_key = str(claim["group_key"])
            count = int(str(claim["count"]))
            existing = grouped_counts.get(group_key)
            if existing is None:
                grouped_counts[group_key] = {
                    "display_group": str(claim["display_group"]),
                    "count": count,
                }
                continue
            if int(existing["count"]) != count:
                has_conflicting_group_counts = True
                break

        if not has_conflicting_group_counts and len(grouped_counts) >= 2:
            narrative_count = int(distinct_counts[0])
            group_sum = sum(int(entry["count"]) for entry in grouped_counts.values())
            if narrative_count != group_sum:
                anchor = group_count_claims[0]
                group_summary = ", ".join(
                    (
                        f'{_display_group_label(str(entry["display_group"]))}='
                        f'{int(entry["count"]):g}'
                    )
                    for entry in grouped_counts.values()
                )
                issues.append(
                    _build_issue(
                        issue_type="medical_data_consistency.narrative_group_sum_conflict",
                        category="medical_calculation_and_parsing",
                        severity="high",
                        action="manual_review",
                        confidence=0.9,
                        paragraph_index=_as_int(anchor["paragraph_index"]),
                        sentence_index=_as_int(anchor["sentence_index"]),
                        text_excerpt=" / ".join(
                            str(claim["text"]) for claim in group_count_claims[:3]
                        ),
                        normalized_excerpt=group_summary,
                        explanation=(
                            f"Narrative enrolled count {narrative_count} conflicts with the "
                            f"detected group-count sum {group_sum} ({group_summary})."
                        ),
                        source_kind="deterministic_rule",
                        source_id="medical-data/narrative-group-sum-conflict",
                    )
                )

    if len(distinct_counts) == 1:
        narrative_count = int(distinct_counts[0])
        sex_count_pair = _collect_narrative_sex_count_pair(normalized)
        if sex_count_pair:
            sex_sum = int(sex_count_pair["male"]) + int(sex_count_pair["female"])
            if sex_sum != narrative_count:
                issues.append(
                    _build_issue(
                        issue_type="medical_data_consistency.sex_count_sum_conflict",
                        category="medical_calculation_and_parsing",
                        severity="high",
                        action="manual_review",
                        confidence=0.9,
                        paragraph_index=_as_int(sex_count_pair["paragraph_index"]),
                        sentence_index=_as_int(sex_count_pair["sentence_index"]),
                        text_excerpt=str(sex_count_pair["text"]),
                        normalized_excerpt=(
                            f'male={int(sex_count_pair["male"]):g}, '
                            f'female={int(sex_count_pair["female"]):g}'
                        ),
                        explanation=(
                            f"Narrative enrolled count {narrative_count} conflicts with the "
                            f"detected male/female sum {sex_sum} "
                            f'(male={int(sex_count_pair["male"]):g}, '
                            f'female={int(sex_count_pair["female"]):g}).'
                        ),
                        source_kind="deterministic_rule",
                        source_id="medical-data/sex-count-sum-conflict",
                    )
                )

        event_count_claim = _collect_narrative_event_count_claim(normalized)
        if event_count_claim and int(event_count_claim["count"]) > narrative_count:
            issues.append(
                _build_issue(
                    issue_type="medical_data_consistency.event_count_exceeds_sample_size",
                    category="medical_calculation_and_parsing",
                    severity="high",
                    action="manual_review",
                    confidence=0.9,
                    paragraph_index=_as_int(event_count_claim["paragraph_index"]),
                    sentence_index=_as_int(event_count_claim["sentence_index"]),
                    text_excerpt=str(event_count_claim["text"]),
                    normalized_excerpt=str(event_count_claim["event"]),
                    explanation=(
                        f'Narrative enrolled count {narrative_count} is lower than the '
                        f'detected "{str(event_count_claim["event"])}" patient count '
                        f'({int(event_count_claim["count"]):g}).'
                    ),
                    source_kind="deterministic_rule",
                    source_id="medical-data/event-count-exceeds-sample-size",
                )
            )

        attrition_claim = _collect_single_count_claim(
            normalized,
            ATTRITION_COUNT_PATTERNS,
        )
        analyzed_claim = _collect_single_count_claim(
            normalized,
            ANALYZED_COUNT_PATTERNS,
        )
        if attrition_claim and analyzed_claim:
            expected_analyzed = narrative_count - int(attrition_claim["count"])
            if expected_analyzed != int(analyzed_claim["count"]):
                issues.append(
                    _build_issue(
                        issue_type="medical_data_consistency.attrition_analysis_count_conflict",
                        category="medical_calculation_and_parsing",
                        severity="high",
                        action="manual_review",
                        confidence=0.91,
                        paragraph_index=_as_int(analyzed_claim["paragraph_index"]),
                        sentence_index=_as_int(analyzed_claim["sentence_index"]),
                        text_excerpt=(
                            f'{str(attrition_claim["text"])} / {str(analyzed_claim["text"])}'
                        ),
                        normalized_excerpt=(
                            f'enrolled={narrative_count}, attrition={int(attrition_claim["count"])}, '
                            f'analyzed={int(analyzed_claim["count"])}'
                        ),
                        explanation=(
                            f"Narrative enrolled count {narrative_count} minus attrition count "
                            f'{int(attrition_claim["count"]):g} implies {expected_analyzed:g} '
                            f'participants analyzed, but the manuscript states '
                            f'{int(analyzed_claim["count"]):g}.'
                        ),
                        source_kind="deterministic_rule",
                        source_id="medical-data/attrition-analysis-count-conflict",
                    )
                )

    return issues


def check_cross_section_direction_conflicts(
    normalized: NormalizedDocument,
    medical_assets: dict[str, object],
) -> list[QualityIssue]:
    observations: dict[tuple[str, str], list[dict[str, object]]] = defaultdict(list)
    pre_post_template_pairs = resolve_comparison_template_pairs(
        "pre_post",
        medical_assets,
    )

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        lowered_sentence = _normalize_numeric_text(sentence_text).lower()
        section = _read_section_label(sentence_text)
        direction = _read_sentence_direction_claim(lowered_sentence)
        if not section or not direction:
            continue

        phase = _read_sentence_phase(lowered_sentence, pre_post_template_pairs) or ""
        for metric in _read_metric_tokens(sentence_text):
            observations[(metric.lower(), phase)].append(
                {
                    "metric": metric,
                    "section": section,
                    "direction": direction,
                    "text": sentence_text,
                    "paragraph_index": sentence["paragraph_index"],
                    "sentence_index": sentence["sentence_index"],
                }
            )

    issues: list[QualityIssue] = []
    for (_, _), entries in observations.items():
        sections = {str(entry["section"]) for entry in entries}
        directions = {str(entry["direction"]) for entry in entries}
        if len(sections) < 2 or len(directions) < 2:
            continue

        anchor = entries[0]
        section_summary = " / ".join(
            f'{str(entry["section"])}: {str(entry["direction"])}' for entry in entries[:3]
        )
        issues.append(
            _build_issue(
                issue_type="medical_logic.cross_section_direction_conflict",
                category="medical_logic",
                severity="high",
                action="manual_review",
                confidence=0.86,
                paragraph_index=_as_int(anchor["paragraph_index"]),
                sentence_index=_as_int(anchor["sentence_index"]),
                text_excerpt=" / ".join(str(entry["text"]) for entry in entries[:3]),
                normalized_excerpt=section_summary,
                explanation=(
                    f'Metric {str(anchor["metric"])} has conflicting directions across sections '
                    f"({section_summary})."
                ),
                source_kind="deterministic_rule",
                source_id="medical-logic/cross-section-direction-conflict",
            )
        )
        break

    return issues


def check_cross_section_group_comparison_conflicts(
    normalized: NormalizedDocument,
    medical_assets: dict[str, object],
) -> list[QualityIssue]:
    observations: dict[tuple[str, str, str, str], list[dict[str, object]]] = defaultdict(
        list
    )
    pre_post_template_pairs = resolve_comparison_template_pairs(
        "pre_post",
        medical_assets,
    )
    group_reference_groups = _resolve_group_comparison_reference_groups(medical_assets)

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        lowered_sentence = _normalize_numeric_text(sentence_text).lower()
        section = _read_section_label(sentence_text)
        phase = _read_sentence_phase(lowered_sentence, pre_post_template_pairs)
        if not section or not phase:
            continue

        group_comparison = _read_group_comparison_claim(
            lowered_sentence,
            group_reference_groups,
        )
        if not group_comparison:
            continue

        canonical_claim = _canonicalize_group_comparison_claim(*group_comparison)
        if not canonical_claim:
            continue

        left_group, right_group, relation = canonical_claim
        for metric in _read_metric_tokens(sentence_text):
            observations[(metric.lower(), phase, left_group, right_group)].append(
                {
                    "metric": metric,
                    "section": section,
                    "left_group": left_group,
                    "right_group": right_group,
                    "relation": relation,
                    "text": sentence_text,
                    "paragraph_index": sentence["paragraph_index"],
                    "sentence_index": sentence["sentence_index"],
                }
            )

    issues: list[QualityIssue] = []
    for (_, _, _, _), entries in observations.items():
        sections = {str(entry["section"]) for entry in entries}
        relations = {str(entry["relation"]) for entry in entries}
        if len(sections) < 2 or len(relations) < 2:
            continue

        anchor = entries[0]
        section_summary = " / ".join(
            (
                f'{str(entry["section"])}: {_display_group_label(str(entry["left_group"]))} '
                f'{str(entry["relation"])} than {_display_group_label(str(entry["right_group"]))}'
            )
            for entry in entries[:3]
        )
        issues.append(
            _build_issue(
                issue_type="medical_logic.cross_section_group_comparison_conflict",
                category="medical_logic",
                severity="high",
                action="manual_review",
                confidence=0.85,
                paragraph_index=_as_int(anchor["paragraph_index"]),
                sentence_index=_as_int(anchor["sentence_index"]),
                text_excerpt=" / ".join(str(entry["text"]) for entry in entries[:3]),
                normalized_excerpt=section_summary,
                explanation=(
                    f'Metric {str(anchor["metric"])} has conflicting group comparisons across '
                    f"sections ({section_summary})."
                ),
                source_kind="deterministic_rule",
                source_id="medical-logic/cross-section-group-comparison-conflict",
            )
        )
        break

    return issues


def check_cross_section_group_event_comparison_conflicts(
    normalized: NormalizedDocument,
    medical_assets: dict[str, object],
) -> list[QualityIssue]:
    observations: dict[tuple[str, str, str], list[dict[str, object]]] = defaultdict(list)
    group_reference_groups = _resolve_group_comparison_reference_groups(medical_assets)

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        lowered_sentence = _normalize_numeric_text(sentence_text).lower()
        section = _read_section_label(sentence_text)
        if not section:
            continue

        event_topic = _read_event_topic(sentence_text)
        if not event_topic:
            continue

        group_comparison = _read_group_comparison_claim(
            lowered_sentence,
            group_reference_groups,
        )
        if not group_comparison:
            continue

        canonical_claim = _canonicalize_group_comparison_claim(*group_comparison)
        if not canonical_claim:
            continue

        left_group, right_group, relation = canonical_claim
        display_event, event_key = event_topic
        observations[(event_key, left_group, right_group)].append(
            {
                "event": display_event,
                "section": section,
                "left_group": left_group,
                "right_group": right_group,
                "relation": relation,
                "text": sentence_text,
                "paragraph_index": sentence["paragraph_index"],
                "sentence_index": sentence["sentence_index"],
            }
        )

    issues: list[QualityIssue] = []
    for (_, _, _), entries in observations.items():
        sections = {str(entry["section"]) for entry in entries}
        relations = {str(entry["relation"]) for entry in entries}
        if len(sections) < 2 or len(relations) < 2:
            continue

        anchor = entries[0]
        section_summary = " / ".join(
            (
                f'{str(entry["section"])}: {_display_group_label(str(entry["left_group"]))} '
                f'{str(entry["relation"])} than {_display_group_label(str(entry["right_group"]))}'
            )
            for entry in entries[:3]
        )
        issues.append(
            _build_issue(
                issue_type="medical_logic.cross_section_group_event_comparison_conflict",
                category="medical_logic",
                severity="high",
                action="manual_review",
                confidence=0.86,
                paragraph_index=_as_int(anchor["paragraph_index"]),
                sentence_index=_as_int(anchor["sentence_index"]),
                text_excerpt=" / ".join(str(entry["text"]) for entry in entries[:3]),
                normalized_excerpt=section_summary,
                explanation=(
                    f'{str(anchor["event"])} has conflicting group comparisons across sections '
                    f"({section_summary})."
                ),
                source_kind="deterministic_rule",
                source_id="medical-logic/cross-section-group-event-comparison-conflict",
            )
        )
        break

    return issues


def check_medical_norms_and_magnitude(
    normalized: NormalizedDocument,
    medical_assets: dict[str, object],
) -> list[QualityIssue]:
    issues: list[QualityIssue] = []
    issues.extend(check_metric_unit_drift(normalized))
    issues.extend(check_metric_unit_range_conflicts(normalized, medical_assets))
    issues.extend(check_age_range_anomalies(normalized))
    return issues


def check_table_norms_and_magnitude(
    normalized: NormalizedDocument,
    table_snapshots: list[dict] | None,
    medical_assets: dict[str, object],
) -> list[QualityIssue]:
    if not table_snapshots:
        return []

    issues: list[QualityIssue] = []
    document_text = normalized["normalized_text"].lower()

    for table in table_snapshots:
        table_id = str(table.get("table_id", "")).strip()
        if table_id and table_id.lower() not in document_text:
            continue

        unit_issue = _check_single_table_metric_unit_drift(table_id, table)
        if unit_issue:
            issues.append(unit_issue)
            return issues

        percent_issue = _check_single_table_percent_out_of_range(
            table_id,
            table,
            medical_assets,
        )
        if percent_issue:
            issues.append(percent_issue)
            return issues

    return issues


def check_metric_unit_drift(normalized: NormalizedDocument) -> list[QualityIssue]:
    sightings: dict[str, list[dict[str, object]]] = defaultdict(list)

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        for match in METRIC_UNIT_CLAIM_PATTERN.finditer(sentence_text):
            metric = _normalize_metric_label(match.group("metric"))
            if not metric or metric in UNIT_DRIFT_EXCLUDED_METRICS:
                continue

            sightings[metric].append(
                {
                    "display_metric": match.group("metric").strip(),
                    "unit": _normalize_unit(match.group("unit")),
                    "text": sentence_text,
                    "paragraph_index": sentence["paragraph_index"],
                    "sentence_index": sentence["sentence_index"],
                }
            )

    issues: list[QualityIssue] = []
    for metric, entries in sightings.items():
        units = sorted({str(entry["unit"]) for entry in entries})
        if len(units) < 2:
            continue

        anchor = entries[0]
        display_metric = str(anchor["display_metric"])
        issues.append(
            _build_issue(
                issue_type="medical_norms_and_magnitude.metric_unit_drift",
                category="medical_norms_and_magnitude",
                severity="high",
                action="manual_review",
                confidence=0.84,
                paragraph_index=_as_int(anchor["paragraph_index"]),
                sentence_index=_as_int(anchor["sentence_index"]),
                text_excerpt=" / ".join(str(entry["text"]) for entry in entries[:3]),
                normalized_excerpt=" / ".join(units),
                explanation=(
                    f"Metric {display_metric} appears with multiple units: "
                    + ", ".join(units)
                    + "."
                ),
                source_kind="deterministic_rule",
                source_id="medical-norms/metric-unit-drift",
            )
        )

    return issues


def check_metric_unit_range_conflicts(
    normalized: NormalizedDocument,
    medical_assets: dict[str, object],
) -> list[QualityIssue]:
    issues: list[QualityIssue] = []

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        for match in METRIC_UNIT_CLAIM_PATTERN.finditer(sentence_text):
            display_metric = match.group("metric").strip()
            normalized_metric = _normalize_metric_label(display_metric)
            if not normalized_metric or normalized_metric in UNIT_DRIFT_EXCLUDED_METRICS:
                continue

            unit = _normalize_unit(match.group("unit"))
            value = float(match.group("value"))
            unit_ranges = resolve_indicator_unit_ranges(display_metric, medical_assets)
            if not unit_ranges:
                unit_ranges = resolve_indicator_unit_ranges(normalized_metric, medical_assets)
            if not unit_ranges:
                continue

            governed_range = _find_unit_range_for_unit(unit_ranges, unit)
            if governed_range is None:
                continue

            min_value = governed_range.get("min")
            max_value = governed_range.get("max")
            if _value_matches_unit_range(value, min_value, max_value):
                continue

            policy = resolve_issue_policy("unit_range_conflict", medical_assets)
            range_summary = _format_unit_range_summary(unit, min_value, max_value)
            issues.append(
                _build_issue(
                    issue_type="medical_norms_and_magnitude.unit_range_conflict",
                    category="medical_norms_and_magnitude",
                    severity=policy["severity"],
                    action=policy["action"],
                    confidence=0.87,
                    paragraph_index=sentence["paragraph_index"],
                    sentence_index=sentence["sentence_index"],
                    text_excerpt=sentence_text,
                    normalized_excerpt=f"{display_metric} {value:g} {unit}",
                    explanation=(
                        f"Metric {display_metric} is reported as {value:g} {unit}, "
                        f"which falls outside the governed range {range_summary}."
                    ),
                    source_kind="deterministic_rule",
                    source_id="medical-norms/unit-range-conflict",
                )
            )
            return issues

    return issues


def check_age_range_anomalies(
    normalized: NormalizedDocument,
) -> list[QualityIssue]:
    issues: list[QualityIssue] = []

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        for match in AGE_RANGE_PATTERN.finditer(sentence_text):
            low = int(match.group("low"))
            high = int(match.group("high") or low)

            if low <= high and high <= MAX_REASONABLE_AGE:
                continue

            explanation = (
                f"Detected an implausible age range/value ({low} to {high} years)."
                if match.group("high")
                else f"Detected an implausible age value ({low} years)."
            )
            if low > high:
                explanation = (
                    f"Detected an inverted age range ({low} to {high} years)."
                )

            issues.append(
                _build_issue(
                    issue_type="medical_norms_and_magnitude.age_range_anomaly",
                    category="medical_norms_and_magnitude",
                    severity="high",
                    action="manual_review",
                    confidence=0.88,
                    paragraph_index=sentence["paragraph_index"],
                    sentence_index=sentence["sentence_index"],
                    text_excerpt=sentence_text,
                    normalized_excerpt=sentence_text,
                    explanation=explanation,
                    source_kind="deterministic_rule",
                    source_id="medical-norms/age-range-anomaly",
                )
            )
            break

    return issues


def check_table_group_sum_consistency(
    normalized: NormalizedDocument,
    table_snapshots: list[dict] | None,
) -> list[QualityIssue]:
    if not table_snapshots:
        return []

    issues: list[QualityIssue] = []
    enrollment_claims = _collect_enrollment_claims(normalized)
    distinct_narrative_counts = sorted(
        {int(str(claim["count"])) for claim in enrollment_claims}
    )
    narrative_anchor = enrollment_claims[0] if enrollment_claims else None
    narrative_issue_emitted = False

    for table in table_snapshots:
        table_summary = _extract_table_sample_size_summary(table)
        if not table_summary:
            continue

        table_id = str(table_summary["table_id"])
        group_counts = list(table_summary["group_counts"])
        group_sum = int(table_summary["group_sum"])
        group_summary = _summarize_group_counts(group_counts)
        explicit_total = table_summary["explicit_total"]

        if explicit_total is not None and explicit_total != group_sum:
            issues.append(
                _build_issue(
                    issue_type="medical_data_consistency.table_group_total_conflict",
                    category="medical_calculation_and_parsing",
                    severity="high",
                    action="manual_review",
                    confidence=0.92,
                    text_excerpt=group_summary,
                    normalized_excerpt=f"{table_id} total={explicit_total}",
                    explanation=(
                        f"{table_id} reports a total sample size of {explicit_total}, "
                        f"but the detected group counts sum to {group_sum} ({group_summary})."
                    ),
                    source_kind="deterministic_rule",
                    source_id="medical-data/table-group-total-conflict",
                )
            )

        if (
            narrative_issue_emitted
            or len(distinct_narrative_counts) != 1
            or narrative_anchor is None
        ):
            continue

        narrative_count = distinct_narrative_counts[0]
        if narrative_count == group_sum:
            continue
        if explicit_total is not None and narrative_count == explicit_total:
            continue

        issues.append(
            _build_issue(
                issue_type="medical_data_consistency.narrative_table_group_sum_conflict",
                category="medical_calculation_and_parsing",
                severity="high",
                action="manual_review",
                confidence=0.9,
                paragraph_index=_as_int(narrative_anchor["paragraph_index"]),
                sentence_index=_as_int(narrative_anchor["sentence_index"]),
                text_excerpt=str(narrative_anchor["text"]),
                normalized_excerpt=group_summary,
                explanation=(
                    f"Narrative enrolled count {narrative_count} conflicts with the "
                    f"detected sample-size group sum in {table_id} ({group_sum}; {group_summary})."
                ),
                source_kind="deterministic_rule",
                source_id="medical-data/narrative-table-group-sum-conflict",
            )
        )
        narrative_issue_emitted = True

    return issues


def check_table_count_percent_consistency(
    normalized: NormalizedDocument,
    table_snapshots: list[dict] | None,
) -> list[QualityIssue]:
    if not table_snapshots:
        return []

    issues: list[QualityIssue] = []
    document_text = normalized["normalized_text"].lower()

    for table in table_snapshots:
        table_id = str(table.get("table_id", "")).strip()
        if table_id and table_id.lower() not in document_text:
            continue

        group_totals = _extract_table_group_totals(table)
        if not group_totals:
            continue

        for cell in table.get("data_cells", []):
            if not isinstance(cell, dict):
                continue

            row_key = str(cell.get("row_key", "")).strip()
            column_key = str(cell.get("column_key", "")).strip()
            cell_text = str(cell.get("text", "")).strip()
            if not row_key or not column_key or not cell_text:
                continue
            if not _has_percent_context(row_key, column_key, cell_text):
                continue

            count_percent = _read_count_percent_pair(cell_text)
            if not count_percent:
                continue

            group_total = group_totals.get(_normalize_table_label(column_key))
            if group_total is None:
                group_total = group_totals.get(_normalize_table_label(row_key))
            if not group_total:
                continue

            count_value, reported_percent = count_percent
            expected_percent = count_value / group_total * 100
            if abs(expected_percent - reported_percent) <= 1:
                continue

            issues.append(
                _build_issue(
                    issue_type="medical_calculation_and_parsing.table_count_percent_mismatch",
                    category="medical_calculation_and_parsing",
                    severity="high",
                    action="manual_review",
                    confidence=0.92,
                    text_excerpt=cell_text,
                    normalized_excerpt=f"{table_id} {row_key} {column_key}".strip(),
                    explanation=(
                        f'Table {table_id} reports {count_value:g} ({reported_percent:g}%) '
                        f'for "{row_key}" / "{column_key}", but the group total {group_total} '
                        f'implies about {expected_percent:g}%.'
                    ),
                    source_kind="deterministic_rule",
                    source_id="medical-data/table-count-percent-mismatch",
                )
            )
            return issues

    return issues


def check_table_pre_post_direction_logic(
    normalized: NormalizedDocument,
    table_snapshots: list[dict] | None,
    medical_assets: dict[str, object],
) -> list[QualityIssue]:
    if not table_snapshots:
        return []

    issues: list[QualityIssue] = []
    document_text = normalized["normalized_text"].lower()
    pre_post_template_pairs = resolve_comparison_template_pairs(
        "pre_post",
        medical_assets,
    )

    for table in table_snapshots:
        table_id = str(table.get("table_id", "")).strip()
        if table_id and table_id.lower() not in document_text:
            continue

        grouped_values, metric_display = _extract_pre_post_metric_values(
            table,
            pre_post_template_pairs,
        )

        for metric_key, columns in grouped_values.items():
            direction_by_group: dict[str, str] = {}
            for column_key, phase_values in columns.items():
                before_value = phase_values.get("before")
                after_value = phase_values.get("after")
                if before_value is None or after_value is None:
                    continue
                if after_value == before_value:
                    continue
                direction_by_group[column_key] = (
                    "increase" if after_value > before_value else "decrease"
                )

            if len(direction_by_group) < 2:
                continue

            distinct_directions = sorted(set(direction_by_group.values()))
            if len(distinct_directions) < 2:
                continue

            group_summary = ", ".join(
                f"{group}={direction}" for group, direction in direction_by_group.items()
            )
            issues.append(
                _build_issue(
                    issue_type="medical_logic.table_pre_post_direction_divergence",
                    category="medical_logic",
                    severity="high",
                    action="manual_review",
                    confidence=0.82,
                    text_excerpt=table_id,
                    normalized_excerpt=group_summary,
                    explanation=(
                        f'Table {table_id} shows opposite pre/post directions for '
                        f'{metric_display[metric_key]} across groups ({group_summary}).'
                    ),
                    source_kind="deterministic_rule",
                    source_id="medical-logic/table-pre-post-direction-divergence",
                )
            )
            return issues

    return issues


def check_narrative_table_direction_consistency(
    normalized: NormalizedDocument,
    table_snapshots: list[dict] | None,
    medical_assets: dict[str, object],
) -> list[QualityIssue]:
    if not table_snapshots:
        return []

    issues: list[QualityIssue] = []
    pre_post_template_pairs = resolve_comparison_template_pairs(
        "pre_post",
        medical_assets,
    )

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        lowered_sentence = _normalize_numeric_text(sentence_text).lower()

        for table in table_snapshots:
            table_id = str(table.get("table_id", "")).strip()
            if table_id and table_id.lower() not in lowered_sentence:
                continue

            grouped_values, metric_display = _extract_pre_post_metric_values(
                table,
                pre_post_template_pairs,
            )
            count_percent_values, count_percent_display = (
                _extract_table_group_count_percent_values(table)
            )
            if not grouped_values and not count_percent_values:
                continue

            if grouped_values:
                direction_issue = _check_sentence_table_direction_claim(
                    sentence,
                    sentence_text,
                    lowered_sentence,
                    table_id,
                    grouped_values,
                    metric_display,
                    medical_assets,
                )
                if direction_issue:
                    issues.append(direction_issue)
                    return issues

                comparison_issue = _check_sentence_table_group_comparison_claim(
                    sentence,
                    sentence_text,
                    lowered_sentence,
                    table_id,
                    grouped_values,
                    metric_display,
                    pre_post_template_pairs,
                )
                if comparison_issue:
                    issues.append(comparison_issue)
                    return issues

            if count_percent_values:
                count_percent_issue = (
                    _check_sentence_table_group_count_percent_comparison_claim(
                        sentence,
                        sentence_text,
                        lowered_sentence,
                        table_id,
                        count_percent_values,
                        count_percent_display,
                    )
                )
                if count_percent_issue:
                    issues.append(count_percent_issue)
                    return issues

    return issues


def check_statistical_expression(
    normalized: NormalizedDocument,
    medical_assets: dict[str, object],
    table_snapshots: list[dict] | None = None,
) -> list[QualityIssue]:
    issues: list[QualityIssue] = []

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        lowered_sentence = sentence_text.lower()
        for match in P_VALUE_PATTERN.finditer(sentence_text):
            operator = match.group("operator")
            p_value = float(match.group("value"))
            positive_claim = _has_positive_significance_claim(lowered_sentence)
            negative_claim = _has_negative_significance_claim(lowered_sentence)

            if not _p_value_is_in_range(p_value):
                issues.append(
                    _build_issue(
                        issue_type="statistical_expression.p_value_out_of_range",
                        category="medical_calculation_and_parsing",
                        severity="high",
                        action="manual_review",
                        confidence=0.95,
                        paragraph_index=sentence["paragraph_index"],
                        sentence_index=sentence["sentence_index"],
                        text_excerpt=sentence_text,
                        normalized_excerpt=sentence_text,
                        explanation=(
                            f"Detected an out-of-range p-value ({operator} {p_value:g})."
                        ),
                        source_kind="deterministic_rule",
                        source_id="statistics/p-value-out-of-range",
                    )
                )
                break

            if _p_value_conflicts_with_claim(operator, p_value, positive_claim, negative_claim):
                policy = resolve_issue_policy("significance_claim_conflict", medical_assets)
                issues.append(
                    _build_issue(
                        issue_type="statistical_expression.significance_mismatch",
                        category="medical_calculation_and_parsing",
                        severity=policy["severity"],
                        action=policy["action"],
                        confidence=0.89,
                        paragraph_index=sentence["paragraph_index"],
                        sentence_index=sentence["sentence_index"],
                        text_excerpt=sentence_text,
                        normalized_excerpt=sentence_text,
                        explanation=(
                            "The stated statistical significance appears inconsistent "
                            f"with the reported p-value ({operator} {p_value:g})."
                        ),
                        source_kind="deterministic_rule",
                        source_id="statistics/significance-mismatch",
                    )
                )
                break

        for match in CONFIDENCE_INTERVAL_PATTERN.finditer(sentence_text):
            lower_bound = float(match.group("low"))
            upper_bound = float(match.group("high"))
            if lower_bound <= upper_bound:
                continue

            issues.append(
                _build_issue(
                    issue_type="statistical_expression.confidence_interval_inversion",
                    category="medical_calculation_and_parsing",
                    severity="high",
                    action="manual_review",
                    confidence=0.91,
                    paragraph_index=sentence["paragraph_index"],
                    sentence_index=sentence["sentence_index"],
                    text_excerpt=sentence_text,
                    normalized_excerpt=sentence_text,
                    explanation=(
                        "Detected an inverted confidence interval "
                        f"({lower_bound:g} to {upper_bound:g})."
                    ),
                    source_kind="deterministic_rule",
                    source_id="statistics/confidence-interval-inversion",
                )
            )
            break

        issues.extend(
            _check_sentence_diagnostic_metric_ranges(
                sentence,
                sentence_text,
                medical_assets,
            )
        )

    for paragraph in normalized["paragraph_blocks"]:
        paragraph_text = str(paragraph.get("normalized_text", ""))

        auc_issue = _check_sentence_auc_confidence_interval(
            paragraph,
            paragraph_text,
            medical_assets,
        )
        if auc_issue:
            issues.append(auc_issue)

        diagnostic_metric_issue = _check_sentence_diagnostic_metric_recheck(
            paragraph,
            paragraph_text,
            medical_assets,
        )
        if diagnostic_metric_issue:
            issues.append(diagnostic_metric_issue)

        regression_issue = _check_sentence_regression_coefficient_recheck(
            paragraph,
            paragraph_text,
            medical_assets,
        )
        if regression_issue:
            issues.append(regression_issue)

        inferential_issue = _check_paragraph_test_statistic_consistency(
            paragraph,
            paragraph_text,
            medical_assets,
        )
        if inferential_issue:
            issues.append(inferential_issue)

    issues.extend(check_table_statistical_boundaries(normalized, table_snapshots))
    issues.extend(check_table_p_value_conflicts(normalized, medical_assets, table_snapshots))
    return issues


def _check_sentence_diagnostic_metric_ranges(
    sentence: dict[str, object],
    sentence_text: str,
    medical_assets: dict[str, object],
) -> list[QualityIssue]:
    if not is_analyzer_enabled("diagnostic_metric_consistency", medical_assets):
        return []

    issues: list[QualityIssue] = []
    metric_claims = _read_metric_value_claims(
        sentence_text,
        resolve_diagnostic_metric_aliases(medical_assets),
    )
    for metric_key, metric_value in metric_claims.items():
        metric_range = resolve_diagnostic_metric_range(metric_key, medical_assets)
        if not metric_range:
            continue

        min_value = metric_range.get("min")
        max_value = metric_range.get("max")
        if _value_matches_unit_range(metric_value, min_value, max_value):
            continue

        policy = resolve_issue_policy("diagnostic_metric_out_of_range", medical_assets)
        issues.append(
            _build_issue(
                issue_type="statistical_expression.diagnostic_metric_out_of_range",
                category="medical_calculation_and_parsing",
                severity=policy["severity"],
                action=policy["action"],
                confidence=0.9,
                paragraph_index=_as_int(sentence.get("paragraph_index")),
                sentence_index=_as_int(sentence.get("sentence_index")),
                text_excerpt=sentence_text,
                normalized_excerpt=metric_key,
                explanation=(
                    f"{metric_key} is reported as {metric_value:g}, which falls outside the "
                    f"governed range {_format_numeric_range_summary(min_value, max_value)}."
                ),
                source_kind="deterministic_rule",
                source_id="statistics/diagnostic-metric-out-of-range",
            )
        )

    return issues


def _check_sentence_auc_confidence_interval(
    sentence: dict[str, object],
    sentence_text: str,
    medical_assets: dict[str, object],
) -> QualityIssue | None:
    if not (
        is_analyzer_enabled("diagnostic_metric_consistency", medical_assets)
        and is_analyzer_enabled("statistical_recheck", medical_assets)
    ):
        return None

    metric_claims = _read_metric_value_claims(
        sentence_text,
        resolve_diagnostic_metric_aliases(medical_assets),
    )
    auc_value = _read_metric_claim(metric_claims, "AUC")
    if auc_value is None:
        return None

    interval = _read_confidence_interval(sentence_text, sentence_text)
    if not interval:
        return None

    min_value, max_value = _read_metric_range_bounds(
        resolve_diagnostic_metric_range("AUC", medical_assets)
    )
    lower_bound, upper_bound = interval
    if (
        _metric_value_within_bounds(auc_value, min_value, max_value)
        and _metric_value_within_bounds(lower_bound, min_value, max_value)
        and _metric_value_within_bounds(upper_bound, min_value, max_value)
    ):
        return None

    policy = resolve_issue_policy("auc_confidence_interval_conflict", medical_assets)
    return _build_issue(
        issue_type="statistical_expression.auc_confidence_interval_conflict",
        category="medical_calculation_and_parsing",
        severity=policy["severity"],
        action=policy["action"],
        confidence=0.91,
        paragraph_index=_as_int(sentence.get("paragraph_index")),
        sentence_index=_as_int(sentence.get("sentence_index")),
        text_excerpt=sentence_text,
        normalized_excerpt="AUC",
        explanation=(
            f"AUC is reported as {auc_value:g} with CI {lower_bound:g} to {upper_bound:g}, "
            f"but the governed range is {_format_numeric_range_summary(min_value, max_value)}."
        ),
        source_kind="deterministic_rule",
        source_id="statistics/auc-confidence-interval-conflict",
    )


def _check_sentence_diagnostic_metric_recheck(
    sentence: dict[str, object],
    sentence_text: str,
    medical_assets: dict[str, object],
) -> QualityIssue | None:
    if not (
        is_analyzer_enabled("diagnostic_metric_consistency", medical_assets)
        and is_analyzer_enabled("statistical_recheck", medical_assets)
    ):
        return None

    metric_claims = _read_metric_value_claims(
        sentence_text,
        resolve_diagnostic_metric_aliases(medical_assets),
    )
    if not metric_claims:
        return None

    confusion_counts = _read_confusion_matrix_counts(sentence_text, medical_assets)
    if not confusion_counts:
        return None

    sensitivity_value = _read_metric_claim(metric_claims, "sensitivity")
    if sensitivity_value is not None:
        denominator = confusion_counts["tp"] + confusion_counts["fn"]
        if denominator > 0:
            recalculated = confusion_counts["tp"] / denominator
            if abs(recalculated - sensitivity_value) > STATISTICAL_RECHECK_TOLERANCE:
                policy = resolve_issue_policy("diagnostic_metric_mismatch", medical_assets)
                return _build_issue(
                    issue_type="statistical_expression.diagnostic_metric_mismatch",
                    category="medical_calculation_and_parsing",
                    severity=policy["severity"],
                    action=policy["action"],
                    confidence=0.93,
                    paragraph_index=_as_int(sentence.get("paragraph_index")),
                    sentence_index=_as_int(sentence.get("sentence_index")),
                    text_excerpt=sentence_text,
                    normalized_excerpt="sensitivity",
                    explanation=(
                        f"Sensitivity is reported as {sensitivity_value:g}, but TP={confusion_counts['tp']:g} "
                        f"and FN={confusion_counts['fn']:g} imply {recalculated:.2f}."
                    ),
                    source_kind="deterministic_rule",
                    source_id="statistics/diagnostic-metric-mismatch",
                )

    specificity_value = _read_metric_claim(metric_claims, "specificity")
    if specificity_value is not None:
        denominator = confusion_counts["tn"] + confusion_counts["fp"]
        if denominator > 0:
            recalculated = confusion_counts["tn"] / denominator
            if abs(recalculated - specificity_value) > STATISTICAL_RECHECK_TOLERANCE:
                policy = resolve_issue_policy("diagnostic_metric_mismatch", medical_assets)
                return _build_issue(
                    issue_type="statistical_expression.diagnostic_metric_mismatch",
                    category="medical_calculation_and_parsing",
                    severity=policy["severity"],
                    action=policy["action"],
                    confidence=0.93,
                    paragraph_index=_as_int(sentence.get("paragraph_index")),
                    sentence_index=_as_int(sentence.get("sentence_index")),
                    text_excerpt=sentence_text,
                    normalized_excerpt="specificity",
                    explanation=(
                        f"Specificity is reported as {specificity_value:g}, but TN={confusion_counts['tn']:g} "
                        f"and FP={confusion_counts['fp']:g} imply {recalculated:.2f}."
                    ),
                    source_kind="deterministic_rule",
                    source_id="statistics/diagnostic-metric-mismatch",
                )

    return None


def _check_sentence_regression_coefficient_recheck(
    sentence: dict[str, object],
    sentence_text: str,
    medical_assets: dict[str, object],
) -> QualityIssue | None:
    if not (
        is_analyzer_enabled("regression_consistency", medical_assets)
        and is_analyzer_enabled("statistical_recheck", medical_assets)
    ):
        return None

    field_claims = _read_metric_value_claims(
        sentence_text,
        resolve_regression_field_aliases(medical_assets),
    )
    beta_value = _read_metric_claim(field_claims, "beta")
    se_value = _read_metric_claim(field_claims, "SE")
    interval = _read_confidence_interval(sentence_text, sentence_text)
    if beta_value is None or se_value is None or interval is None or se_value < 0:
        return None

    confidence_levels = resolve_regression_confidence_levels(medical_assets)
    z_score = _resolve_z_score(confidence_levels or [95.0])
    expected_low = beta_value - z_score * se_value
    expected_high = beta_value + z_score * se_value
    lower_bound, upper_bound = interval

    if (
        abs(expected_low - lower_bound) <= 0.05
        and abs(expected_high - upper_bound) <= 0.05
    ):
        return None

    policy = resolve_issue_policy("regression_coefficient_conflict", medical_assets)
    return _build_issue(
        issue_type="statistical_expression.regression_coefficient_conflict",
        category="medical_calculation_and_parsing",
        severity=policy["severity"],
        action=policy["action"],
        confidence=0.92,
        paragraph_index=_as_int(sentence.get("paragraph_index")),
        sentence_index=_as_int(sentence.get("sentence_index")),
        text_excerpt=sentence_text,
        normalized_excerpt="beta/SE",
        explanation=(
            f"beta={beta_value:g} and SE={se_value:g} imply an approximate CI of "
            f"{expected_low:.2f} to {expected_high:.2f}, but the manuscript reports "
            f"{lower_bound:g} to {upper_bound:g}."
        ),
        source_kind="deterministic_rule",
        source_id="statistics/regression-coefficient-conflict",
    )


def _check_paragraph_test_statistic_consistency(
    paragraph: dict[str, object],
    paragraph_text: str,
    medical_assets: dict[str, object],
) -> QualityIssue | None:
    if not is_analyzer_enabled("inferential_statistic_consistency", medical_assets):
        return None

    mean_sd_issue = _check_mean_sd_t_value_consistency(paragraph, paragraph_text, medical_assets)
    if mean_sd_issue:
        return mean_sd_issue

    p_value_claim = _read_p_value_claim(paragraph_text)
    if not p_value_claim:
        return None

    chi_square_issue = _check_chi_square_p_value_consistency(
        paragraph,
        paragraph_text,
        p_value_claim,
        medical_assets,
    )
    if chi_square_issue:
        return chi_square_issue

    t_value_issue = _check_t_value_p_value_consistency(
        paragraph,
        paragraph_text,
        p_value_claim,
        medical_assets,
    )
    if t_value_issue:
        return t_value_issue

    return _check_f_value_p_value_consistency(
        paragraph,
        paragraph_text,
        p_value_claim,
        medical_assets,
    )


def _check_mean_sd_t_value_consistency(
    paragraph: dict[str, object],
    paragraph_text: str,
    medical_assets: dict[str, object],
) -> QualityIssue | None:
    group_summaries = _read_group_mean_sd_summaries(paragraph_text)
    if len(group_summaries) < 2:
        return None

    t_match = T_VALUE_PATTERN.search(_normalize_numeric_text(paragraph_text))
    if not t_match:
        return None

    first_group = group_summaries[0]
    second_group = group_summaries[1]
    reported_t = abs(float(t_match.group("value")))
    expected_t = _calculate_welch_t_value(first_group, second_group)
    if expected_t is None or abs(expected_t - reported_t) <= 0.2:
        return None

    policy = resolve_issue_policy("test_statistic_conflict", medical_assets)
    return _build_issue(
        issue_type="statistical_expression.test_statistic_conflict",
        category="medical_calculation_and_parsing",
        severity=policy["severity"],
        action=policy["action"],
        confidence=0.9,
        paragraph_index=_as_int(paragraph.get("paragraph_index")),
        sentence_index=_as_int(paragraph.get("sentence_index")),
        text_excerpt=paragraph_text,
        normalized_excerpt="t value",
        explanation=(
            f"The reported t value is {reported_t:g}, but the two-group mean±SD summaries "
            f"imply approximately {expected_t:.2f}."
        ),
        source_kind="deterministic_rule",
        source_id="statistics/test-statistic-conflict",
    )


def _check_chi_square_p_value_consistency(
    paragraph: dict[str, object],
    paragraph_text: str,
    p_value_claim: tuple[str, float],
    medical_assets: dict[str, object],
) -> QualityIssue | None:
    match = CHI_SQUARE_PATTERN.search(_normalize_numeric_text(paragraph_text))
    if not match or match.group("df") is None:
        return None

    chi_square_value = float(match.group("value"))
    degrees_of_freedom = float(match.group("df"))
    expected_p = _chi_square_upper_tail_p(chi_square_value, degrees_of_freedom)
    if expected_p is None:
        return None

    return _build_test_statistic_p_value_issue(
        paragraph,
        paragraph_text,
        medical_assets,
        statistic_label="chi-square",
        statistic_value=chi_square_value,
        expected_p=expected_p,
        reported_p=p_value_claim,
    )


def _check_t_value_p_value_consistency(
    paragraph: dict[str, object],
    paragraph_text: str,
    p_value_claim: tuple[str, float],
    medical_assets: dict[str, object],
) -> QualityIssue | None:
    match = T_VALUE_PATTERN.search(_normalize_numeric_text(paragraph_text))
    if not match or match.group("df") is None:
        return None

    t_value = abs(float(match.group("value")))
    degrees_of_freedom = float(match.group("df"))
    expected_p = _student_t_two_tailed_p(t_value, degrees_of_freedom)
    if expected_p is None:
        return None

    return _build_test_statistic_p_value_issue(
        paragraph,
        paragraph_text,
        medical_assets,
        statistic_label="t",
        statistic_value=t_value,
        expected_p=expected_p,
        reported_p=p_value_claim,
    )


def _check_f_value_p_value_consistency(
    paragraph: dict[str, object],
    paragraph_text: str,
    p_value_claim: tuple[str, float],
    medical_assets: dict[str, object],
) -> QualityIssue | None:
    match = F_VALUE_PATTERN.search(_normalize_numeric_text(paragraph_text))
    if not match:
        return None

    f_value = float(match.group("value"))
    degrees_of_freedom_1 = float(match.group("df1"))
    degrees_of_freedom_2 = float(match.group("df2"))
    expected_p = _f_upper_tail_p(
        f_value,
        degrees_of_freedom_1,
        degrees_of_freedom_2,
    )
    if expected_p is None:
        return None

    return _build_test_statistic_p_value_issue(
        paragraph,
        paragraph_text,
        medical_assets,
        statistic_label="F",
        statistic_value=f_value,
        expected_p=expected_p,
        reported_p=p_value_claim,
    )


def _build_test_statistic_p_value_issue(
    paragraph: dict[str, object],
    paragraph_text: str,
    medical_assets: dict[str, object],
    *,
    statistic_label: str,
    statistic_value: float,
    expected_p: float,
    reported_p: tuple[str, float],
) -> QualityIssue | None:
    reported_operator, reported_value = reported_p
    if (
        abs(expected_p - reported_value) <= 0.05
        and _p_value_significance("=", expected_p) == _p_value_significance(reported_operator, reported_value)
    ):
        return None

    policy = resolve_issue_policy("test_statistic_conflict", medical_assets)
    return _build_issue(
        issue_type="statistical_expression.test_statistic_conflict",
        category="medical_calculation_and_parsing",
        severity=policy["severity"],
        action=policy["action"],
        confidence=0.9,
        paragraph_index=_as_int(paragraph.get("paragraph_index")),
        sentence_index=_as_int(paragraph.get("sentence_index")),
        text_excerpt=paragraph_text,
        normalized_excerpt=statistic_label,
        explanation=(
            f"{statistic_label}={statistic_value:g} implies an approximate P value of "
            f"{expected_p:.3f}, but the manuscript reports P {reported_operator} {reported_value:g}."
        ),
        source_kind="deterministic_rule",
        source_id="statistics/test-statistic-conflict",
    )


def check_evidence_alignment(normalized: NormalizedDocument) -> list[QualityIssue]:
    issues: list[QualityIssue] = []
    document_text = normalized["normalized_text"].lower()
    low_evidence_context = any(
        marker in document_text for marker in LOW_EVIDENCE_MARKERS
    )

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        lowered = sentence_text.lower()
        has_overstatement = any(marker in lowered for marker in OVERSTATED_CONCLUSION_MARKERS)
        has_low_evidence_marker = any(marker in lowered for marker in LOW_EVIDENCE_MARKERS)

        if not has_overstatement:
            continue

        if not (low_evidence_context or has_low_evidence_marker):
            continue

        issues.append(
            _build_issue(
                issue_type="evidence_alignment.overstated_conclusion",
                category="medical_logic",
                severity="high",
                action="manual_review",
                confidence=0.84,
                paragraph_index=sentence["paragraph_index"],
                sentence_index=sentence["sentence_index"],
                text_excerpt=sentence_text,
                normalized_excerpt=sentence_text,
                explanation=(
                    "The conclusion language appears stronger than the study design "
                    "or reported evidence supports."
                ),
                source_kind="language_model",
                source_id="medical/evidence-alignment",
            )
        )

    return issues


def check_privacy_ethics(normalized: NormalizedDocument) -> list[QualityIssue]:
    advisory = build_privacy_advisory(normalized["normalized_text"])
    if advisory.status != "needs_review" or not advisory.findings:
        return []

    findings_summary = ", ".join(
        sorted({f"{finding.category}:{finding.match}" for finding in advisory.findings})
    )
    return [
        _build_issue(
            issue_type="ethics_privacy.direct_identifier",
            category="medical_logic",
            severity="critical",
            action="block",
            confidence=0.97,
            text_excerpt=findings_summary,
            normalized_excerpt=normalized["normalized_text"],
            explanation=(
                "Potential directly identifying information requires privacy review: "
                + findings_summary
                + "."
            ),
            source_kind="deterministic_rule",
            source_id="privacy/direct-identifier",
        )
    ]


def check_table_text_consistency(
    normalized: NormalizedDocument,
    table_snapshots: list[dict] | None,
) -> list[QualityIssue]:
    if not table_snapshots:
        return []

    issues: list[QualityIssue] = []
    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        lowered_sentence = sentence_text.lower()

        for table in table_snapshots:
            table_id = str(table.get("table_id", ""))
            lowered_table_id = table_id.lower()
            if lowered_table_id and lowered_table_id not in lowered_sentence:
                continue

            for cell in table.get("data_cells", []):
                if not isinstance(cell, dict):
                    continue

                row_key = str(cell.get("row_key", "")).strip()
                column_key = str(cell.get("column_key", "")).strip()
                cell_text = str(cell.get("text", "")).strip()
                if not row_key or not column_key or not cell_text:
                    continue
                if _is_p_value_column(column_key):
                    continue

                if row_key.lower() not in lowered_sentence or column_key.lower() not in lowered_sentence:
                    continue

                sentence_value = _extract_numeric_expression(sentence_text)
                cell_value = _extract_numeric_expression(cell_text)
                if not sentence_value or not cell_value:
                    continue

                if sentence_value == cell_value:
                    continue

                issues.append(
                    _build_issue(
                        issue_type="table_text_consistency.narrative_table_value_conflict",
                        category="table_text_consistency",
                        severity="high",
                        action="manual_review",
                        confidence=0.91,
                        paragraph_index=sentence["paragraph_index"],
                        sentence_index=sentence["sentence_index"],
                        text_excerpt=sentence_text,
                        normalized_excerpt=cell_text,
                        explanation=(
                            f'Row "{row_key}" and column "{column_key}" show '
                            f"{cell_value} in {table_id}, but the narrative states {sentence_value}."
                        ),
                        source_kind="deterministic_rule",
                        source_id="table-text/narrative-table-value-conflict",
                    )
                )
                return issues

    return issues


def check_table_p_value_conflicts(
    normalized: NormalizedDocument,
    medical_assets: dict[str, object],
    table_snapshots: list[dict] | None,
) -> list[QualityIssue]:
    if not table_snapshots:
        return []

    issues: list[QualityIssue] = []
    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        lowered_sentence = sentence_text.lower()
        sentence_p = _read_p_value_claim(sentence_text)
        positive_claim = _has_positive_significance_claim(lowered_sentence)
        negative_claim = _has_negative_significance_claim(lowered_sentence)

        if not sentence_p and not positive_claim and not negative_claim:
            continue

        for table in table_snapshots:
            table_id = str(table.get("table_id", ""))
            lowered_table_id = table_id.lower()
            if lowered_table_id and lowered_table_id not in lowered_sentence:
                continue

            for cell in table.get("data_cells", []):
                if not isinstance(cell, dict):
                    continue

                row_key = str(cell.get("row_key", "")).strip()
                column_key = str(cell.get("column_key", "")).strip()
                cell_text = str(cell.get("text", "")).strip()
                if not row_key or row_key.lower() not in lowered_sentence:
                    continue
                if not _is_p_value_column(column_key):
                    continue

                table_p = _read_p_value_claim(cell_text)
                if not table_p:
                    continue

                conflict = False
                if sentence_p:
                    conflict = _p_value_significance(sentence_p[0], sentence_p[1]) != _p_value_significance(
                        table_p[0], table_p[1]
                    )
                elif positive_claim or negative_claim:
                    conflict = _p_value_conflicts_with_claim(
                        table_p[0], table_p[1], positive_claim, negative_claim
                    )

                if not conflict:
                    continue

                sentence_claim = (
                    f"P {sentence_p[0]} {sentence_p[1]:g}"
                    if sentence_p
                    else ("positive significance claim" if positive_claim else "negative significance claim")
                )
                policy = resolve_issue_policy("significance_claim_conflict", medical_assets)
                issues.append(
                    _build_issue(
                        issue_type="statistical_expression.table_p_value_conflict",
                        category="table_text_consistency",
                        severity=policy["severity"],
                        action=policy["action"],
                        confidence=0.9,
                        paragraph_index=sentence["paragraph_index"],
                        sentence_index=sentence["sentence_index"],
                        text_excerpt=sentence_text,
                        normalized_excerpt=cell_text,
                        explanation=(
                            f'Row "{row_key}" is described as {sentence_claim}, '
                            f"but {table_id} reports P = {table_p[1]:g}."
                        ),
                        source_kind="deterministic_rule",
                        source_id="statistics/table-p-value-conflict",
                    )
                )
                return issues

    return issues


def check_table_statistical_boundaries(
    normalized: NormalizedDocument,
    table_snapshots: list[dict] | None,
) -> list[QualityIssue]:
    if not table_snapshots:
        return []

    issues: list[QualityIssue] = []
    document_text = normalized["normalized_text"].lower()

    for table in table_snapshots:
        table_id = str(table.get("table_id", "")).strip()
        if table_id and table_id.lower() not in document_text:
            continue

        for cell in table.get("data_cells", []):
            if not isinstance(cell, dict):
                continue

            row_key = str(cell.get("row_key", "")).strip()
            column_key = str(cell.get("column_key", "")).strip()
            cell_text = str(cell.get("text", "")).strip()
            if not cell_text:
                continue

            if _is_p_value_column(column_key):
                table_p = _read_p_value_claim(cell_text)
                if table_p and not _p_value_is_in_range(table_p[1]):
                    issues.append(
                        _build_issue(
                            issue_type="statistical_expression.table_p_value_out_of_range",
                            category="medical_calculation_and_parsing",
                            severity="high",
                            action="manual_review",
                            confidence=0.95,
                            text_excerpt=cell_text,
                            normalized_excerpt=f"{table_id} {row_key} {column_key}".strip(),
                            explanation=(
                                f'{table_id} reports an out-of-range P value '
                                f'for row "{row_key}" ({table_p[1]:g}).'
                            ),
                            source_kind="deterministic_rule",
                            source_id="statistics/table-p-value-out-of-range",
                        )
                    )
                    return issues

            interval = _read_confidence_interval(cell_text, f"{row_key} {column_key}")
            if not interval:
                continue
            lower_bound, upper_bound = interval
            if lower_bound <= upper_bound:
                continue

            issues.append(
                _build_issue(
                    issue_type="statistical_expression.table_confidence_interval_inversion",
                    category="medical_calculation_and_parsing",
                    severity="high",
                    action="manual_review",
                    confidence=0.91,
                    text_excerpt=cell_text,
                    normalized_excerpt=f"{table_id} {row_key} {column_key}".strip(),
                    explanation=(
                        f'{table_id} contains an inverted confidence interval '
                        f'for "{row_key}" ({lower_bound:g} to {upper_bound:g}).'
                    ),
                    source_kind="deterministic_rule",
                    source_id="statistics/table-confidence-interval-inversion",
                )
            )
            return issues

    return issues


def _p_value_conflicts_with_claim(
    operator: str,
    p_value: float,
    positive_claim: bool,
    negative_claim: bool,
) -> bool:
    is_significant = _p_value_significance(operator, p_value)

    return (positive_claim and not is_significant) or (
        negative_claim and is_significant
    )


def _p_value_is_in_range(p_value: float) -> bool:
    return 0 <= p_value <= 1


def _p_value_significance(operator: str, p_value: float) -> bool:
    if operator == "<":
        return p_value < 0.05
    if operator == "<=":
        return p_value <= 0.05
    if operator == "=":
        return p_value < 0.05
    if operator == ">":
        return False
    if operator == ">=":
        return False
    return False


def _read_p_value_claim(text: str) -> tuple[str, float] | None:
    match = P_VALUE_PATTERN.search(text)
    if not match:
        normalized = _normalize_numeric_text(text)
        if DECIMAL_PATTERN.fullmatch(normalized):
            return "=", float(normalized)
        return None
    return match.group("operator"), float(match.group("value"))


def _read_confidence_interval(
    text: str,
    context: str = "",
) -> tuple[float, float] | None:
    match = CONFIDENCE_INTERVAL_PATTERN.search(text)
    if match:
        return float(match.group("low")), float(match.group("high"))

    combined_context = f"{context} {text}".lower()
    if "ci" not in combined_context and "confidence interval" not in combined_context:
        return None

    pair_match = INTERVAL_PAIR_PATTERN.search(text)
    if not pair_match:
        return None

    return float(pair_match.group("low")), float(pair_match.group("high"))


def _read_metric_value_claims(
    text: str,
    aliases_by_metric: dict[str, list[str]],
) -> dict[str, float]:
    normalized = _normalize_numeric_text(text)
    metric_claims: dict[str, float] = {}

    for metric_key, aliases in aliases_by_metric.items():
        candidates = [metric_key, *aliases]
        for alias in candidates:
            if not alias:
                continue

            pattern = re.compile(
                rf"(?<!\w){re.escape(alias)}(?!\w)\s*(?:=|:|was|is|of)?\s*(?P<value>-?\d+(?:\.\d+)?)",
                re.IGNORECASE,
            )
            match = pattern.search(normalized)
            if not match:
                continue

            metric_claims[metric_key] = float(match.group("value"))
            break

    return metric_claims


def _read_metric_claim(metric_claims: dict[str, float], metric_key: str) -> float | None:
    target = metric_key.lower()
    for key, value in metric_claims.items():
        if key.lower() == target:
            return value
    return None


def _read_confusion_matrix_counts(
    text: str,
    medical_assets: dict[str, object],
) -> dict[str, float]:
    aliases_by_label = resolve_confusion_matrix_aliases(medical_assets)
    counts: dict[str, float] = {}
    normalized = _normalize_numeric_text(text)

    for label in ("tp", "fp", "fn", "tn"):
        aliases = aliases_by_label.get(label, [])
        candidates = [label.upper(), label, *aliases]
        for alias in candidates:
            if not alias:
                continue

            pattern = re.compile(
                rf"(?<!\w){re.escape(alias)}(?!\w)\s*(?:=|:)\s*(?P<value>-?\d+(?:\.\d+)?)",
                re.IGNORECASE,
            )
            match = pattern.search(normalized)
            if not match:
                continue

            counts[label] = float(match.group("value"))
            break

    return counts if all(key in counts for key in ("tp", "fp", "fn", "tn")) else {}


def _resolve_z_score(confidence_levels: list[float]) -> float:
    for confidence_level in confidence_levels:
        rounded_level = round(confidence_level, 1)
        if rounded_level in CONFIDENCE_LEVEL_Z_SCORES:
            return CONFIDENCE_LEVEL_Z_SCORES[rounded_level]

    return CONFIDENCE_LEVEL_Z_SCORES[95.0]


def _read_metric_range_bounds(metric_range: dict[str, object]) -> tuple[float | None, float | None]:
    min_value = metric_range.get("min")
    max_value = metric_range.get("max")
    return (
        float(min_value) if isinstance(min_value, (int, float)) else None,
        float(max_value) if isinstance(max_value, (int, float)) else None,
    )


def _metric_value_within_bounds(
    value: float,
    min_value: float | None,
    max_value: float | None,
) -> bool:
    if min_value is not None and value < min_value:
        return False
    if max_value is not None and value > max_value:
        return False
    return True


def _format_numeric_range_summary(
    min_value: float | None,
    max_value: float | None,
) -> str:
    if min_value is not None and max_value is not None:
        return f"{min_value:g} to {max_value:g}"
    if min_value is not None:
        return f">= {min_value:g}"
    if max_value is not None:
        return f"<= {max_value:g}"
    return "the configured limits"


def _read_group_mean_sd_summaries(text: str) -> list[dict[str, float | str]]:
    summaries: list[dict[str, float | str]] = []

    for match in GROUP_MEAN_SD_N_PATTERN.finditer(text):
        summaries.append(
            {
                "group": str(match.group("group")).strip(),
                "mean": float(match.group("mean")),
                "sd": float(match.group("sd")),
                "n": float(match.group("n")),
            }
        )

    return summaries


def _calculate_welch_t_value(
    first_group: dict[str, float | str],
    second_group: dict[str, float | str],
) -> float | None:
    mean_1 = float(first_group["mean"])
    mean_2 = float(second_group["mean"])
    sd_1 = float(first_group["sd"])
    sd_2 = float(second_group["sd"])
    n_1 = float(first_group["n"])
    n_2 = float(second_group["n"])

    if n_1 <= 0 or n_2 <= 0:
        return None

    denominator = math.sqrt((sd_1**2) / n_1 + (sd_2**2) / n_2)
    if denominator == 0:
        return None

    return abs((mean_1 - mean_2) / denominator)


def _chi_square_upper_tail_p(
    chi_square_value: float,
    degrees_of_freedom: float,
) -> float | None:
    if chi_square_value < 0 or degrees_of_freedom <= 0:
        return None

    return _regularized_gamma_q(degrees_of_freedom / 2.0, chi_square_value / 2.0)


def _student_t_two_tailed_p(t_value: float, degrees_of_freedom: float) -> float | None:
    if t_value < 0 or degrees_of_freedom <= 0:
        return None

    x = degrees_of_freedom / (degrees_of_freedom + t_value * t_value)
    return _regularized_incomplete_beta(degrees_of_freedom / 2.0, 0.5, x)


def _f_upper_tail_p(
    f_value: float,
    degrees_of_freedom_1: float,
    degrees_of_freedom_2: float,
) -> float | None:
    if f_value < 0 or degrees_of_freedom_1 <= 0 or degrees_of_freedom_2 <= 0:
        return None

    x = degrees_of_freedom_2 / (degrees_of_freedom_2 + degrees_of_freedom_1 * f_value)
    return _regularized_incomplete_beta(
        degrees_of_freedom_2 / 2.0,
        degrees_of_freedom_1 / 2.0,
        x,
    )


def _regularized_incomplete_beta(a: float, b: float, x: float) -> float | None:
    if a <= 0 or b <= 0 or x < 0 or x > 1:
        return None

    if x == 0:
        return 0.0
    if x == 1:
        return 1.0

    log_beta = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
    front = math.exp(log_beta + a * math.log(x) + b * math.log(1.0 - x))

    if x < (a + 1.0) / (a + b + 2.0):
        return front * _beta_continued_fraction(a, b, x) / a

    return 1.0 - front * _beta_continued_fraction(b, a, 1.0 - x) / b


def _beta_continued_fraction(a: float, b: float, x: float) -> float:
    max_iterations = 200
    epsilon = 3.0e-7
    fpmin = 1.0e-30

    qab = a + b
    qap = a + 1.0
    qam = a - 1.0

    c = 1.0
    d = 1.0 - qab * x / qap
    if abs(d) < fpmin:
        d = fpmin
    d = 1.0 / d
    h = d

    for iteration in range(1, max_iterations + 1):
        double_iteration = 2 * iteration

        aa = (
            iteration
            * (b - iteration)
            * x
            / ((qam + double_iteration) * (a + double_iteration))
        )
        d = 1.0 + aa * d
        if abs(d) < fpmin:
            d = fpmin
        c = 1.0 + aa / c
        if abs(c) < fpmin:
            c = fpmin
        d = 1.0 / d
        h *= d * c

        aa = (
            -(a + iteration)
            * (qab + iteration)
            * x
            / ((a + double_iteration) * (qap + double_iteration))
        )
        d = 1.0 + aa * d
        if abs(d) < fpmin:
            d = fpmin
        c = 1.0 + aa / c
        if abs(c) < fpmin:
            c = fpmin
        d = 1.0 / d
        delta = d * c
        h *= delta

        if abs(delta - 1.0) < epsilon:
            break

    return h


def _regularized_gamma_q(a: float, x: float) -> float | None:
    if a <= 0 or x < 0:
        return None
    if x == 0:
        return 1.0

    if x < a + 1.0:
        return 1.0 - _regularized_gamma_p_series(a, x)

    return _regularized_gamma_q_continued_fraction(a, x)


def _regularized_gamma_p_series(a: float, x: float) -> float:
    max_iterations = 200
    epsilon = 3.0e-7

    term = 1.0 / a
    total = term
    ap = a

    for _ in range(max_iterations):
        ap += 1.0
        term *= x / ap
        total += term
        if abs(term) < abs(total) * epsilon:
            break

    return total * math.exp(-x + a * math.log(x) - math.lgamma(a))


def _regularized_gamma_q_continued_fraction(a: float, x: float) -> float:
    max_iterations = 200
    epsilon = 3.0e-7
    fpmin = 1.0e-30

    b = x + 1.0 - a
    c = 1.0 / fpmin
    d = 1.0 / b
    h = d

    for iteration in range(1, max_iterations + 1):
        an = -iteration * (iteration - a)
        b += 2.0
        d = an * d + b
        if abs(d) < fpmin:
            d = fpmin
        c = b + an / c
        if abs(c) < fpmin:
            c = fpmin
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < epsilon:
            break

    return math.exp(-x + a * math.log(x) - math.lgamma(a)) * h


def _extract_numeric_expression(text: str) -> str | None:
    normalized = _normalize_numeric_text(text)
    mean_sd_match = MEAN_SD_PATTERN.search(normalized)
    if mean_sd_match:
        return f'{mean_sd_match.group("mean")} ± {mean_sd_match.group("sd")}'

    for match in DECIMAL_PATTERN.finditer(normalized):
        prefix = normalized[max(0, match.start() - 8) : match.start()].lower()
        if prefix.endswith("table "):
            continue
        if prefix.endswith("p ") or prefix.endswith("p=") or prefix.endswith("p>") or prefix.endswith("p<"):
            continue
        return match.group(0)

    return None


def _normalize_numeric_text(text: str) -> str:
    return " ".join(text.replace("¡À", "±").replace("+/-", "±").split())


def _collect_enrollment_claims(
    normalized: NormalizedDocument,
) -> list[dict[str, object]]:
    enrollment_claims: list[dict[str, object]] = []

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        match = ENROLLED_COUNT_PATTERN.search(sentence_text)
        if not match:
            continue
        enrollment_claims.append(
            {
                "count": match.group("count"),
                "text": sentence_text,
                "paragraph_index": sentence["paragraph_index"],
                "sentence_index": sentence["sentence_index"],
            }
        )

    return enrollment_claims


def _collect_follow_up_duration_claims(
    normalized: NormalizedDocument,
) -> list[dict[str, object]]:
    follow_up_claims: list[dict[str, object]] = []

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        for pattern in FOLLOW_UP_DURATION_PATTERNS:
            match = pattern.search(sentence_text)
            if not match:
                continue

            value = int(match.group("value"))
            unit = _normalize_duration_unit(match.group("unit"))
            display_unit = str(match.group("unit")).lower().strip()
            follow_up_claims.append(
                {
                    "value": value,
                    "unit": unit,
                    "display": f"{value:g} {display_unit}",
                    "text": sentence_text,
                    "paragraph_index": sentence["paragraph_index"],
                    "sentence_index": sentence["sentence_index"],
                }
            )
            break

    return follow_up_claims


def _collect_narrative_group_count_claims(
    normalized: NormalizedDocument,
) -> list[dict[str, object]]:
    group_count_claims: list[dict[str, object]] = []

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        for pattern in NARRATIVE_GROUP_COUNT_PATTERNS:
            match = pattern.search(sentence_text)
            if not match:
                continue

            group_label = str(match.group("group")).strip()
            group_count_claims.append(
                {
                    "group_key": _normalize_table_label(group_label),
                    "display_group": group_label,
                    "section": _read_section_label(sentence_text),
                    "count": match.group("count"),
                    "text": sentence_text,
                    "paragraph_index": sentence["paragraph_index"],
                    "sentence_index": sentence["sentence_index"],
                }
            )
            break

    return group_count_claims


def _collect_narrative_sex_count_pair(
    normalized: NormalizedDocument,
) -> dict[str, object] | None:
    detected_pair: dict[str, object] | None = None

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        for pattern in SEX_COUNT_PAIR_PATTERNS:
            match = pattern.search(sentence_text)
            if not match:
                continue

            current_pair = {
                "male": int(match.group("male")),
                "female": int(match.group("female")),
                "text": sentence_text,
                "paragraph_index": sentence["paragraph_index"],
                "sentence_index": sentence["sentence_index"],
            }
            if detected_pair is not None and (
                int(detected_pair["male"]) != int(current_pair["male"])
                or int(detected_pair["female"]) != int(current_pair["female"])
            ):
                return None

            detected_pair = current_pair
            break

    return detected_pair


def _collect_narrative_event_count_claim(
    normalized: NormalizedDocument,
) -> dict[str, object] | None:
    detected_claim: dict[str, object] | None = None

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        for pattern in EVENT_COUNT_PATTERNS:
            match = pattern.search(sentence_text)
            if not match:
                continue

            current_claim = {
                "count": int(match.group("count")),
                "event": match.group("event"),
                "text": sentence_text,
                "paragraph_index": sentence["paragraph_index"],
                "sentence_index": sentence["sentence_index"],
            }
            if detected_claim is not None and (
                int(detected_claim["count"]) != int(current_claim["count"])
                or str(detected_claim["event"]).lower()
                != str(current_claim["event"]).lower()
            ):
                return None

            detected_claim = current_claim
            break

    return detected_claim


def _collect_group_event_count_claims(
    normalized: NormalizedDocument,
) -> list[dict[str, object]]:
    group_event_claims: list[dict[str, object]] = []

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        event_match = GROUP_EVENT_NAME_PATTERN.search(sentence_text)
        if event_match:
            event_label = event_match.group("event")
            inline_matches = list(GROUP_EVENT_COUNT_INLINE_PATTERN.finditer(sentence_text))
            if inline_matches:
                for match in inline_matches:
                    group_label = str(match.group("group")).strip()
                    group_event_claims.append(
                        {
                            "group_key": _normalize_table_label(group_label),
                            "display_group": group_label,
                            "count": int(match.group("count")),
                            "event": event_label,
                            "event_key": str(event_label).lower(),
                            "section": _read_section_label(sentence_text),
                            "text": sentence_text,
                            "paragraph_index": sentence["paragraph_index"],
                            "sentence_index": sentence["sentence_index"],
                        }
                    )
                continue

        for pattern in GROUP_EVENT_COUNT_PATTERNS:
            match = pattern.search(sentence_text)
            if not match:
                continue

            group_label = str(match.group("group")).strip()
            group_event_claims.append(
                {
                    "group_key": _normalize_table_label(group_label),
                    "display_group": group_label,
                    "count": int(match.group("count")),
                    "event": match.group("event"),
                    "event_key": str(match.group("event")).lower(),
                    "section": _read_section_label(sentence_text),
                    "text": sentence_text,
                    "paragraph_index": sentence["paragraph_index"],
                    "sentence_index": sentence["sentence_index"],
                }
            )
            break

    return group_event_claims


def _collect_group_event_count_percent_claims(
    normalized: NormalizedDocument,
) -> list[dict[str, object]]:
    group_event_percent_claims: list[dict[str, object]] = []

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        event_match = GROUP_EVENT_NAME_PATTERN.search(sentence_text)
        if event_match:
            event_label = event_match.group("event")
            inline_matches = list(
                GROUP_EVENT_COUNT_PERCENT_INLINE_PATTERN.finditer(sentence_text)
            )
            if inline_matches:
                for match in inline_matches:
                    group_label = str(match.group("group")).strip()
                    group_event_percent_claims.append(
                        {
                            "group_key": _normalize_table_label(group_label),
                            "display_group": group_label,
                            "count": int(match.group("count")),
                            "percent": float(match.group("percent")),
                            "event": event_label,
                            "event_key": str(event_label).lower(),
                            "section": _read_section_label(sentence_text),
                            "text": sentence_text,
                            "paragraph_index": sentence["paragraph_index"],
                            "sentence_index": sentence["sentence_index"],
                        }
                    )
                continue

        for pattern in GROUP_EVENT_COUNT_PERCENT_PATTERNS:
            match = pattern.search(sentence_text)
            if not match:
                continue

            group_label = str(match.group("group")).strip()
            group_event_percent_claims.append(
                {
                    "group_key": _normalize_table_label(group_label),
                    "display_group": group_label,
                    "count": int(match.group("count")),
                    "percent": float(match.group("percent")),
                    "event": match.group("event"),
                    "event_key": str(match.group("event")).lower(),
                    "section": _read_section_label(sentence_text),
                    "text": sentence_text,
                    "paragraph_index": sentence["paragraph_index"],
                    "sentence_index": sentence["sentence_index"],
                }
            )
            break

    return group_event_percent_claims


def _collect_group_attrition_count_claims(
    normalized: NormalizedDocument,
) -> list[dict[str, object]]:
    group_attrition_claims: list[dict[str, object]] = []

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        for pattern in GROUP_ATTRITION_COUNT_PATTERNS:
            match = pattern.search(sentence_text)
            if not match:
                continue

            group_label = str(match.group("group")).strip()
            group_attrition_claims.append(
                {
                    "group_key": _normalize_table_label(group_label),
                    "display_group": group_label,
                    "count": int(match.group("count")),
                    "text": sentence_text,
                    "paragraph_index": sentence["paragraph_index"],
                    "sentence_index": sentence["sentence_index"],
                }
            )
            break

    return group_attrition_claims


def _collect_group_analyzed_count_claims(
    normalized: NormalizedDocument,
) -> list[dict[str, object]]:
    group_analyzed_claims: list[dict[str, object]] = []

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        for pattern in GROUP_ANALYZED_COUNT_PATTERNS:
            match = pattern.search(sentence_text)
            if not match:
                continue

            group_label = str(match.group("group")).strip()
            group_analyzed_claims.append(
                {
                    "group_key": _normalize_table_label(group_label),
                    "display_group": group_label,
                    "count": int(match.group("count")),
                    "text": sentence_text,
                    "paragraph_index": sentence["paragraph_index"],
                    "sentence_index": sentence["sentence_index"],
                }
            )
            break

    return group_analyzed_claims


def _collect_single_count_claim(
    normalized: NormalizedDocument,
    patterns: tuple[re.Pattern[str], ...],
) -> dict[str, object] | None:
    detected_claim: dict[str, object] | None = None

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        for pattern in patterns:
            match = pattern.search(sentence_text)
            if not match:
                continue

            current_claim = {
                "count": int(match.group("count")),
                "text": sentence_text,
                "paragraph_index": sentence["paragraph_index"],
                "sentence_index": sentence["sentence_index"],
            }
            if detected_claim is not None and int(detected_claim["count"]) != int(
                current_claim["count"]
            ):
                return None

            detected_claim = current_claim
            break

    return detected_claim


def _normalize_duration_unit(unit: str) -> str:
    normalized = unit.lower().strip()
    if normalized.endswith("s"):
        normalized = normalized[:-1]
    return normalized


def _extract_table_sample_size_summary(table: dict) -> dict[str, object] | None:
    group_counts, explicit_total = _extract_table_sample_size_components(table)

    if len(group_counts) < 2:
        return None

    return {
        "table_id": str(table.get("table_id", "table")),
        "group_counts": group_counts,
        "group_sum": sum(int(item["count"]) for item in group_counts),
        "explicit_total": explicit_total,
    }


def _extract_table_group_totals(table: dict) -> dict[str, int]:
    group_counts, _ = _extract_table_sample_size_components(table)
    return {
        _normalize_table_label(str(item["label"])): int(item["count"])
        for item in group_counts
    }


def _extract_pre_post_metric_values(
    table: dict,
    pre_post_template_pairs: list[tuple[str, str]],
) -> tuple[dict[str, dict[str, dict[str, float]]], dict[str, str]]:
    grouped_values: dict[str, dict[str, dict[str, float]]] = defaultdict(
        lambda: defaultdict(dict)
    )
    metric_display: dict[str, str] = {}

    for cell in table.get("data_cells", []):
        if not isinstance(cell, dict):
            continue

        row_key = str(cell.get("row_key", "")).strip()
        column_key = str(cell.get("column_key", "")).strip()
        cell_text = str(cell.get("text", "")).strip()
        if not row_key or not column_key or not cell_text:
            continue

        parsed = _read_pre_post_row_key(row_key, pre_post_template_pairs)
        if not parsed:
            continue

        metric_key, phase, display_metric = parsed
        value = _read_scalar_value(cell_text)
        if value is None:
            continue

        grouped_values[metric_key][column_key][phase] = value
        metric_display[metric_key] = display_metric

    return grouped_values, metric_display


def _extract_table_group_count_percent_values(
    table: dict,
) -> tuple[dict[str, dict[str, dict[str, float]]], dict[str, str]]:
    grouped_values: dict[str, dict[str, dict[str, float]]] = defaultdict(dict)
    metric_display: dict[str, str] = {}

    for cell in table.get("data_cells", []):
        if not isinstance(cell, dict):
            continue

        row_key = str(cell.get("row_key", "")).strip()
        column_key = str(cell.get("column_key", "")).strip()
        cell_text = str(cell.get("text", "")).strip()
        if not row_key or not column_key or not cell_text:
            continue

        count_percent = _read_count_percent_pair(cell_text)
        if not count_percent:
            continue
        if _is_p_value_column(row_key) or _is_p_value_column(column_key):
            continue
        if _is_sample_size_label(row_key) or _is_total_label(row_key):
            continue

        display_metric = _strip_count_percent_suffix(row_key)
        metric_key = _normalize_table_label(display_metric)
        if not metric_key:
            continue

        grouped_values[metric_key][column_key] = {
            "count": count_percent[0],
            "percent": count_percent[1],
        }
        metric_display[metric_key] = display_metric

    return grouped_values, metric_display


def _extract_table_sample_size_components(
    table: dict,
) -> tuple[list[dict[str, object]], int | None]:
    group_counts: list[dict[str, object]] = []
    explicit_total: int | None = None

    for cell in table.get("data_cells", []):
        if not isinstance(cell, dict):
            continue

        row_key = str(cell.get("row_key", "")).strip()
        column_key = str(cell.get("column_key", "")).strip()
        cell_text = str(cell.get("text", "")).strip()
        if not row_key or not column_key or not cell_text:
            continue

        cell_count = _extract_integer_count(cell_text)
        if cell_count is None:
            continue
        if _is_p_value_column(row_key) or _is_p_value_column(column_key):
            continue

        row_is_sample_size = _is_sample_size_label(row_key)
        column_is_sample_size = _is_sample_size_label(column_key)
        row_is_total = _is_total_label(row_key)
        column_is_total = _is_total_label(column_key)

        if row_is_sample_size and not column_is_sample_size:
            if column_is_total:
                explicit_total = cell_count
            else:
                group_counts.append({"label": column_key, "count": cell_count})
            continue

        if column_is_sample_size and not row_is_sample_size:
            if row_is_total:
                explicit_total = cell_count
            else:
                group_counts.append({"label": row_key, "count": cell_count})

    return group_counts, explicit_total


def _check_sentence_table_direction_claim(
    sentence: dict[str, object],
    sentence_text: str,
    lowered_sentence: str,
    table_id: str,
    grouped_values: dict[str, dict[str, dict[str, float]]],
    metric_display: dict[str, str],
    medical_assets: dict[str, object],
) -> QualityIssue | None:
    claimed_direction = _read_sentence_direction_claim(lowered_sentence)
    if not claimed_direction:
        return None

    for metric_key, columns in grouped_values.items():
        display_metric = metric_display.get(metric_key, metric_key)
        if not _sentence_mentions_label(lowered_sentence, display_metric):
            continue

        group_name = _find_first_mentioned_group(lowered_sentence, columns.keys())
        if not group_name:
            continue

        phase_values = columns.get(group_name, {})
        before_value = phase_values.get("before")
        after_value = phase_values.get("after")
        if before_value is None or after_value is None or before_value == after_value:
            continue

        actual_direction = "increased" if after_value > before_value else "decreased"
        if claimed_direction == actual_direction:
            continue

        policy = resolve_issue_policy("table_text_direction_conflict", medical_assets)
        return _build_issue(
            issue_type="table_text_consistency.narrative_table_direction_conflict",
            category="table_text_consistency",
            severity=policy["severity"],
            action=policy["action"],
            confidence=0.9,
            paragraph_index=_as_int(sentence.get("paragraph_index")),
            sentence_index=_as_int(sentence.get("sentence_index")),
            text_excerpt=sentence_text,
            normalized_excerpt=f"{table_id} {display_metric} {group_name}".strip(),
            explanation=(
                f'{display_metric} is described as {claimed_direction} in {group_name}, '
                f'but {table_id} shows a {actual_direction} from {before_value:g} to {after_value:g}.'
            ),
            source_kind="deterministic_rule",
            source_id="table-text/narrative-table-direction-conflict",
        )

    return None


def _check_sentence_table_group_comparison_claim(
    sentence: dict[str, object],
    sentence_text: str,
    lowered_sentence: str,
    table_id: str,
    grouped_values: dict[str, dict[str, dict[str, float]]],
    metric_display: dict[str, str],
    pre_post_template_pairs: list[tuple[str, str]],
) -> QualityIssue | None:
    sentence_phase = (
        _read_sentence_phase(lowered_sentence, pre_post_template_pairs) or "after"
    )

    for metric_key, columns in grouped_values.items():
        display_metric = metric_display.get(metric_key, metric_key)
        if not _sentence_mentions_label(lowered_sentence, display_metric):
            continue

        comparison_claim = _read_group_comparison_claim(lowered_sentence, columns.keys())
        if not comparison_claim:
            continue

        left_group, right_group, claimed_relation = comparison_claim
        left_value = columns.get(left_group, {}).get(sentence_phase)
        right_value = columns.get(right_group, {}).get(sentence_phase)
        if left_value is None or right_value is None or left_value == right_value:
            continue

        actual_relation = "higher" if left_value > right_value else "lower"
        if actual_relation == claimed_relation:
            continue

        return _build_issue(
            issue_type="table_text_consistency.narrative_table_group_comparison_conflict",
            category="table_text_consistency",
            severity="high",
            action="manual_review",
            confidence=0.9,
            paragraph_index=_as_int(sentence.get("paragraph_index")),
            sentence_index=_as_int(sentence.get("sentence_index")),
            text_excerpt=sentence_text,
            normalized_excerpt=f"{table_id} {display_metric} {left_group} {right_group}".strip(),
            explanation=(
                f'{display_metric} is described as {left_group} {claimed_relation} than {right_group}, '
                f'but {table_id} shows {left_group}={left_value:g} and {right_group}={right_value:g}.'
            ),
            source_kind="deterministic_rule",
            source_id="table-text/narrative-table-group-comparison-conflict",
        )

    return None


def _check_sentence_table_group_count_percent_comparison_claim(
    sentence: dict[str, object],
    sentence_text: str,
    lowered_sentence: str,
    table_id: str,
    grouped_values: dict[str, dict[str, dict[str, float]]],
    metric_display: dict[str, str],
) -> QualityIssue | None:
    for metric_key, columns in grouped_values.items():
        display_metric = metric_display.get(metric_key, metric_key)
        if not _sentence_mentions_label(lowered_sentence, display_metric):
            continue

        comparison_claim = _read_group_comparison_claim(lowered_sentence, columns.keys())
        if not comparison_claim:
            continue

        left_group, right_group, claimed_relation = comparison_claim
        left_values = columns.get(left_group)
        right_values = columns.get(right_group)
        if not left_values or not right_values:
            continue

        left_percent = left_values.get("percent")
        right_percent = right_values.get("percent")
        if left_percent is None or right_percent is None or left_percent == right_percent:
            continue

        actual_relation = "higher" if left_percent > right_percent else "lower"
        if actual_relation == claimed_relation:
            continue

        return _build_issue(
            issue_type="table_text_consistency.narrative_table_group_count_percent_comparison_conflict",
            category="table_text_consistency",
            severity="high",
            action="manual_review",
            confidence=0.9,
            paragraph_index=_as_int(sentence.get("paragraph_index")),
            sentence_index=_as_int(sentence.get("sentence_index")),
            text_excerpt=sentence_text,
            normalized_excerpt=f"{table_id} {display_metric} {left_group} {right_group}".strip(),
            explanation=(
                f'{display_metric} is described as {left_group} {claimed_relation} than '
                f'{right_group}, but {table_id} shows {left_group}={left_percent:g}% and '
                f'{right_group}={right_percent:g}%.'
            ),
            source_kind="deterministic_rule",
            source_id="table-text/narrative-table-group-count-percent-comparison-conflict",
        )

    return None


def _check_single_table_metric_unit_drift(
    table_id: str,
    table: dict,
) -> QualityIssue | None:
    sightings: dict[str, list[str]] = defaultdict(list)

    for cell in table.get("data_cells", []):
        if not isinstance(cell, dict):
            continue

        for label in (str(cell.get("row_key", "")).strip(), str(cell.get("column_key", "")).strip()):
            metric_unit = _read_metric_unit_from_label(label)
            if not metric_unit:
                continue

            metric, unit = metric_unit
            existing_units = sightings[metric]
            if unit not in existing_units:
                existing_units.append(unit)

    for metric, units in sightings.items():
        if len(units) < 2:
            continue

        return _build_issue(
            issue_type="medical_norms_and_magnitude.table_metric_unit_drift",
            category="medical_norms_and_magnitude",
            severity="high",
            action="manual_review",
            confidence=0.86,
            text_excerpt=table_id,
            normalized_excerpt=" / ".join(units),
            explanation=(
                f"Table {table_id} uses multiple units for metric {metric}: "
                + ", ".join(units)
                + "."
            ),
            source_kind="deterministic_rule",
            source_id="medical-norms/table-metric-unit-drift",
        )

    return None


def _check_single_table_percent_out_of_range(
    table_id: str,
    table: dict,
    medical_assets: dict[str, object],
) -> QualityIssue | None:
    percent_constraint = resolve_count_constraint("percent", medical_assets)
    max_percent = _resolve_max_percent(percent_constraint)

    for cell in table.get("data_cells", []):
        if not isinstance(cell, dict):
            continue

        row_key = str(cell.get("row_key", "")).strip()
        column_key = str(cell.get("column_key", "")).strip()
        cell_text = str(cell.get("text", "")).strip()
        if not cell_text:
            continue
        if not _has_percent_context(row_key, column_key, cell_text):
            continue

        value = _read_scalar_value(cell_text)
        if value is None or value <= max_percent:
            continue

        return _build_issue(
            issue_type="medical_norms_and_magnitude.table_percent_out_of_range",
            category="medical_norms_and_magnitude",
            severity="high",
            action="manual_review",
            confidence=0.9,
            text_excerpt=cell_text,
            normalized_excerpt=f"{table_id} {row_key} {column_key}".strip(),
            explanation=(
                f'Table {table_id} reports a percentage-like value above the governed maximum '
                f'for "{row_key}" / "{column_key}" ({value:g}% > {max_percent:g}%).'
            ),
            source_kind="deterministic_rule",
            source_id="medical-norms/table-percent-out-of-range",
        )

    return None


def _extract_integer_count(text: str) -> int | None:
    normalized = _normalize_numeric_text(text).replace(",", "")
    match = COUNT_CELL_PATTERN.fullmatch(normalized)
    if not match:
        return None

    value = float(match.group("count"))
    if not value.is_integer():
        return None
    return int(value)


def _read_metric_unit_from_label(label: str) -> tuple[str, str] | None:
    match = LABEL_UNIT_PATTERN.match(_normalize_numeric_text(label))
    if not match:
        return None

    metric = match.group("metric").strip()
    normalized_metric = _normalize_metric_label(metric)
    if not normalized_metric or normalized_metric in UNIT_DRIFT_EXCLUDED_METRICS:
        return None
    return metric, _normalize_unit(match.group("unit"))


def _has_percent_context(row_key: str, column_key: str, cell_text: str) -> bool:
    combined = " ".join((row_key, column_key, cell_text)).lower()
    return "%" in combined or "percent" in combined or "rate" in combined


def _read_scalar_value(text: str) -> float | None:
    normalized = _normalize_numeric_text(text).replace(",", "").replace("%", "")
    if not re.fullmatch(r"-?\d+(?:\.\d+)?", normalized):
        return None
    return float(normalized)


def _read_count_percent_pair(text: str) -> tuple[float, float] | None:
    normalized = _normalize_numeric_text(text).replace(",", "")
    match = COUNT_PERCENT_PATTERN.fullmatch(normalized)
    if not match:
        return None
    return float(match.group("count")), float(match.group("percent"))


def _strip_count_percent_suffix(label: str) -> str:
    stripped = COUNT_PERCENT_ROW_SUFFIX_PATTERN.sub("", _normalize_numeric_text(label))
    return " ".join(stripped.split())


def _read_pre_post_row_key(
    row_key: str,
    pre_post_template_pairs: list[tuple[str, str]],
) -> tuple[str, str, str] | None:
    normalized = _normalize_table_label(row_key)

    for before_marker, after_marker in pre_post_template_pairs:
        normalized_before_marker = _normalize_table_label(before_marker)
        if normalized_before_marker in normalized:
            metric = _strip_marker_from_label(row_key, before_marker)
            return _normalize_metric_label(metric), "before", metric.strip()

        normalized_after_marker = _normalize_table_label(after_marker)
        if normalized_after_marker in normalized:
            metric = _strip_marker_from_label(row_key, after_marker)
            return _normalize_metric_label(metric), "after", metric.strip()

    return None


def _read_sentence_direction_claim(text: str) -> str | None:
    if any(marker in text for marker in DECREASE_MARKERS):
        return "decreased"
    if any(marker in text for marker in INCREASE_MARKERS):
        return "increased"
    return None


def _read_sentence_phase(
    text: str,
    pre_post_template_pairs: list[tuple[str, str]],
) -> str | None:
    for before_marker, after_marker in pre_post_template_pairs:
        if _normalize_numeric_text(after_marker).lower() in text:
            return "after"
        if _normalize_numeric_text(before_marker).lower() in text:
            return "before"
    return None


def _read_section_label(text: str) -> str | None:
    match = SECTION_PREFIX_PATTERN.match(text)
    if not match:
        return None
    return match.group("section").title()


def _read_metric_tokens(text: str) -> list[str]:
    return list(dict.fromkeys(METRIC_TOKEN_PATTERN.findall(text)))


def _read_event_topic(text: str) -> tuple[str, str] | None:
    match = EVENT_TOPIC_PATTERN.search(_normalize_numeric_text(text))
    if not match:
        return None

    event = str(match.group("event")).strip()
    return event, event.lower()


def _find_first_mentioned_group(text: str, groups: object) -> str | None:
    candidates: list[tuple[int, str]] = []
    for group in groups:
        if not isinstance(group, str):
            continue
        position = text.find(group.lower())
        if position >= 0:
            candidates.append((position, group))

    if not candidates:
        return None

    candidates.sort(key=lambda item: item[0])
    return candidates[0][1]


def _read_group_comparison_claim(
    text: str,
    groups: object,
) -> tuple[str, str, str] | None:
    mentioned_groups: list[tuple[int, str]] = []
    for group in groups:
        if not isinstance(group, str):
            continue
        position = text.find(group.lower())
        if position >= 0:
            mentioned_groups.append((position, group))

    if len(mentioned_groups) < 2:
        return None

    mentioned_groups.sort(key=lambda item: item[0])
    left_group = mentioned_groups[0][1]
    right_group = mentioned_groups[1][1]

    left_position = mentioned_groups[0][0]
    right_position = mentioned_groups[1][0]
    between_text = text[left_position:right_position + len(right_group)]
    if any(marker in between_text for marker in HIGHER_THAN_MARKERS):
        return left_group, right_group, "higher"
    if any(marker in between_text for marker in LOWER_THAN_MARKERS):
        return left_group, right_group, "lower"
    return None


def _canonicalize_group_comparison_claim(
    left_group: str,
    right_group: str,
    relation: str,
) -> tuple[str, str, str] | None:
    if not left_group or not right_group or relation not in {"higher", "lower"}:
        return None

    canonical_left, canonical_right = sorted((left_group, right_group), key=str.lower)
    if canonical_left == left_group:
        canonical_relation = relation
    else:
        canonical_relation = "lower" if relation == "higher" else "higher"

    return canonical_left, canonical_right, canonical_relation


def _resolve_group_comparison_reference_groups(
    medical_assets: dict[str, object],
) -> tuple[str, ...]:
    resolved_groups = resolve_group_comparison_groups(medical_assets)
    if resolved_groups:
        return tuple(resolved_groups)

    return GROUP_COMPARISON_REFERENCE_GROUPS


def _display_group_label(label: str) -> str:
    if not label:
        return label
    return label[0].upper() + label[1:]


def _sentence_mentions_label(text: str, label: str) -> bool:
    return label.lower() in text


def _strip_marker_from_label(label: str, marker: str) -> str:
    pattern = re.compile(re.escape(marker), re.IGNORECASE)
    cleaned = pattern.sub("", _normalize_numeric_text(label))
    return " ".join(cleaned.replace("()", "").replace("[]", "").split())


def _normalize_table_label_legacy(value: str) -> str:
    return " ".join(
        value.lower()
        .replace("-", " ")
        .replace("_", " ")
        .replace("（", "(")
        .replace("）", ")")
        .split()
    )


def _normalize_table_label(value: str) -> str:
    return " ".join(value.lower().replace("-", " ").replace("_", " ").split())


def _is_sample_size_label(value: str) -> bool:
    normalized = _normalize_table_label(value)
    if not normalized:
        return False
    if re.fullmatch(r"n(?:\s*\(%\))?", normalized):
        return True
    return any(marker in normalized for marker in SAMPLE_SIZE_LABEL_MARKERS)


def _is_total_label(value: str) -> bool:
    normalized = _normalize_table_label(value)
    if not normalized:
        return False
    return any(marker in normalized for marker in TOTAL_LABEL_MARKERS)


def _summarize_group_counts(group_counts: list[dict[str, object]]) -> str:
    return ", ".join(
        f'{str(item["label"])}={int(item["count"])}' for item in group_counts
    )


def _is_p_value_column(value: str) -> bool:
    normalized = " ".join(value.lower().replace("-", " ").split())
    return normalized in {"p", "p value"}


def _normalize_metric_label(value: str) -> str:
    normalized = " ".join(value.lower().replace("-", " ").replace("/", " / ").split())
    return normalized.strip(" :;,.")


def _normalize_unit(value: str) -> str:
    return value.replace(" ", "")


def _find_unit_range_for_unit(
    unit_ranges: list[dict[str, object]],
    unit: str,
) -> dict[str, object] | None:
    for unit_range in unit_ranges:
        configured_unit = unit_range.get("unit")
        if isinstance(configured_unit, str) and _normalize_unit(configured_unit) == unit:
            return unit_range
    return None


def _value_matches_unit_range(
    value: float,
    min_value: object,
    max_value: object,
) -> bool:
    if isinstance(min_value, (int, float)) and value < float(min_value):
        return False
    if isinstance(max_value, (int, float)) and value > float(max_value):
        return False
    return True


def _format_unit_range_summary(unit: str, min_value: object, max_value: object) -> str:
    if isinstance(min_value, (int, float)) and isinstance(max_value, (int, float)):
        return f"{float(min_value):g} to {float(max_value):g} {unit}"
    if isinstance(min_value, (int, float)):
        return f">= {float(min_value):g} {unit}"
    if isinstance(max_value, (int, float)):
        return f"<= {float(max_value):g} {unit}"
    return f"for unit {unit}"


def _resolve_max_percent(percent_constraint: dict[str, object]) -> float:
    max_percent = percent_constraint.get("max_percent")
    if isinstance(max_percent, (int, float)):
        return float(max_percent)
    return 100.0


def _has_negative_significance_claim(text: str) -> bool:
    return any(marker in text for marker in SIGNIFICANT_NEGATIVE_MARKERS)


def _has_positive_significance_claim(text: str) -> bool:
    return (
        any(marker in text for marker in SIGNIFICANT_POSITIVE_MARKERS)
        and not _has_negative_significance_claim(text)
    )


def _normalize_long_form(value: str) -> str:
    return " ".join(value.lower().split())


def _as_int(value: object) -> int | None:
    return value if isinstance(value, int) else None


def _build_issue(
    *,
    issue_type: str,
    category: str,
    severity: str,
    action: str,
    confidence: float,
    text_excerpt: str,
    explanation: str,
    source_kind: str,
    paragraph_index: int | None = None,
    sentence_index: int | None = None,
    normalized_excerpt: str | None = None,
    source_id: str | None = None,
) -> QualityIssue:
    identity = (
        f"{issue_type}|{paragraph_index}|{sentence_index}|"
        f"{text_excerpt}|{normalized_excerpt or ''}"
    )
    issue_id = hashlib.sha1(identity.encode("utf-8")).hexdigest()[:12]

    issue: QualityIssue = {
        "issue_id": issue_id,
        "module_scope": MEDICAL_SPECIALIZED_SCOPE,
        "issue_type": issue_type,
        "category": category,
        "severity": severity,
        "action": action,
        "confidence": confidence,
        "source_kind": source_kind,
        "text_excerpt": text_excerpt,
        "explanation": explanation,
    }

    if paragraph_index is not None:
        issue["paragraph_index"] = paragraph_index
    if sentence_index is not None:
        issue["sentence_index"] = sentence_index
    if normalized_excerpt is not None:
        issue["normalized_excerpt"] = normalized_excerpt
    if source_id is not None:
        issue["source_id"] = source_id

    return issue
