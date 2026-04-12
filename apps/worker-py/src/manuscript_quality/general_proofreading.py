from __future__ import annotations

import json
import hashlib
import re
import sys

from manuscript_quality.contracts import (
    GENERAL_PROOFREADING_SCOPE,
    NormalizedDocument,
    QualityIssue,
    QualityPackageRecord,
)
from manuscript_quality.general_style_package import (
    check_genre_wording_suspicions,
    check_posture_suspicions,
    check_section_expectations,
    check_tone_consistency,
    select_general_style_package,
)
from manuscript_quality.text_normalization import build_normalized_document


REPEATED_PUNCTUATION_PATTERN = re.compile(r"([，。！？；、,.!?;])\1+")
FULLWIDTH_ASCII_PATTERN = re.compile(r"[\uff10-\uff19\uff21-\uff3a\uff41-\uff5a]")
SAMPLE_SIZE_PATTERN = re.compile(r"(?:共)?纳入(?P<count>\d+)例(?:患者|受试者)?")
POSITIVE_LOGIC_MARKERS = (
    "明显改善",
    "改善",
    "提高",
    "增加",
    "有效",
    "缓解",
    "优于",
)
NEGATIVE_LOGIC_MARKERS = (
    "无明显改善",
    "无改善",
    "未改善",
    "无明显提高",
    "未提高",
    "无效",
    "劣于",
)
LOGIC_CONCEPTS = ("改善", "提高", "增加", "有效", "安全")
PAIR_SYMBOLS = (("（", "）"), ("(", ")"), ("“", "”"), ("《", "》"), ("【", "】"))
LEXICAL_REPLACEMENTS = {
    "的的": "的",
    "了了": "了",
    "和和": "和",
    "与与": "与",
    "及及": "及",
}
BLOCK_COMPLIANCE_PATTERNS = ("颠覆国家政权", "分裂国家")
MANUAL_REVIEW_COMPLIANCE_PATTERNS = (
    "绝对安全",
    "保证治愈",
    "百分之百有效",
    "唯一疗法",
)


def run_general_proofreading(
    blocks: list[dict],
    *,
    quality_packages: list[QualityPackageRecord] | None = None,
) -> dict:
    normalized = build_normalized_document(blocks)
    issues: list[QualityIssue] = []
    issues.extend(check_punctuation_layout(normalized))
    issues.extend(check_lexical_candidates(normalized))
    issues.extend(check_basic_consistency(normalized))
    issues.extend(check_compliance_markers(normalized))
    issues.extend(check_logic_suspicions(normalized))
    style_package = select_general_style_package(quality_packages)
    if style_package is not None:
        issues.extend(check_section_expectations(normalized, style_package))
        issues.extend(check_tone_consistency(normalized, style_package))
        issues.extend(check_posture_suspicions(normalized, style_package))
        issues.extend(check_genre_wording_suspicions(normalized, style_package))

    return {
        "module_scope": GENERAL_PROOFREADING_SCOPE,
        **normalized,
        "issues": issues,
    }


def check_punctuation_layout(normalized: NormalizedDocument) -> list[QualityIssue]:
    issues: list[QualityIssue] = []

    for paragraph in normalized["paragraph_blocks"]:
        raw_text = paragraph.get("text", "")
        normalized_text = paragraph["normalized_text"]

        if FULLWIDTH_ASCII_PATTERN.search(raw_text):
            issues.append(
                _build_issue(
                    issue_type="layout.fullwidth_ascii",
                    category="full_half_width_and_spacing",
                    severity="low",
                    action="auto_fix",
                    confidence=0.99,
                    paragraph_index=paragraph["paragraph_index"],
                    text_excerpt=raw_text,
                    normalized_excerpt=normalized_text,
                    suggested_replacement=normalized_text,
                    explanation="Full-width latin letters or digits were normalized to half-width text.",
                    source_kind="deterministic_rule",
                    source_id="layout/fullwidth-ascii",
                )
            )

        repeated_match = REPEATED_PUNCTUATION_PATTERN.search(normalized_text)
        if repeated_match:
            replacement = repeated_match.group(1)
            issues.append(
                _build_issue(
                    issue_type="punctuation.repeated_mark",
                    category="punctuation_and_pairs",
                    severity="low",
                    action="auto_fix",
                    confidence=0.99,
                    paragraph_index=paragraph["paragraph_index"],
                    text_excerpt=repeated_match.group(0),
                    normalized_excerpt=repeated_match.group(0),
                    suggested_replacement=replacement,
                    explanation="Repeated punctuation marks are a low-risk mechanical issue.",
                    source_kind="deterministic_rule",
                    source_id="punctuation/repeated-mark",
                )
            )

        for open_symbol, close_symbol in PAIR_SYMBOLS:
            if normalized_text.count(open_symbol) != normalized_text.count(close_symbol):
                suggested_replacement = None
                if normalized_text.count(open_symbol) > normalized_text.count(close_symbol):
                    suggested_replacement = normalized_text + close_symbol

                issues.append(
                    _build_issue(
                        issue_type="punctuation.unbalanced_pair",
                        category="punctuation_and_pairs",
                        severity="low",
                        action="auto_fix",
                        confidence=0.97,
                        paragraph_index=paragraph["paragraph_index"],
                        text_excerpt=normalized_text,
                        normalized_excerpt=normalized_text,
                        suggested_replacement=suggested_replacement,
                        explanation=(
                            f"Detected an unmatched {open_symbol}{close_symbol} pair."
                        ),
                        source_kind="deterministic_rule",
                        source_id=f"punctuation/unbalanced-{open_symbol}",
                    )
                )
                break

    return issues


def check_lexical_candidates(normalized: NormalizedDocument) -> list[QualityIssue]:
    issues: list[QualityIssue] = []

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]
        for repeated_text, replacement in LEXICAL_REPLACEMENTS.items():
            if repeated_text not in sentence_text:
                continue

            issues.append(
                _build_issue(
                    issue_type="lexical.duplicated_particle",
                    category="typo_redundancy_and_omission",
                    severity="medium",
                    action="suggest_fix",
                    confidence=0.78,
                    paragraph_index=sentence["paragraph_index"],
                    sentence_index=sentence["sentence_index"],
                    text_excerpt=sentence_text,
                    normalized_excerpt=sentence_text,
                    suggested_replacement=sentence_text.replace(
                        repeated_text, replacement
                    ),
                    explanation=(
                        f"Detected a duplicated function word candidate: {repeated_text}."
                    ),
                    source_kind="deterministic_rule",
                    source_id="lexical/duplicated-particle",
                )
            )

    return issues


def check_basic_consistency(normalized: NormalizedDocument) -> list[QualityIssue]:
    issues: list[QualityIssue] = []
    sample_size_claims: list[dict] = []

    for sentence in normalized["sentence_blocks"]:
        match = SAMPLE_SIZE_PATTERN.search(sentence["normalized_text"])
        if not match:
            continue

        sample_size_claims.append(
            {
                "count": match.group("count"),
                "text": sentence["normalized_text"],
                "paragraph_index": sentence["paragraph_index"],
                "sentence_index": sentence["sentence_index"],
            }
        )

    distinct_counts = sorted({claim["count"] for claim in sample_size_claims})
    if len(distinct_counts) > 1:
        anchor = sample_size_claims[0]
        issues.append(
            _build_issue(
                issue_type="consistency.sample_size_conflict",
                category="consistency",
                severity="high",
                action="manual_review",
                confidence=0.9,
                paragraph_index=anchor["paragraph_index"],
                sentence_index=anchor["sentence_index"],
                text_excerpt=" / ".join(claim["text"] for claim in sample_size_claims),
                normalized_excerpt=" / ".join(
                    claim["text"] for claim in sample_size_claims
                ),
                explanation=(
                    "Detected conflicting sample-size claims across the document: "
                    + ", ".join(distinct_counts)
                    + "."
                ),
                source_kind="deterministic_rule",
                source_id="consistency/sample-size",
            )
        )

    return issues


def check_compliance_markers(normalized: NormalizedDocument) -> list[QualityIssue]:
    issues: list[QualityIssue] = []

    for sentence in normalized["sentence_blocks"]:
        sentence_text = sentence["normalized_text"]

        for phrase in BLOCK_COMPLIANCE_PATTERNS:
            if phrase not in sentence_text:
                continue

            issues.append(
                _build_issue(
                    issue_type="compliance.blocked_phrase",
                    category="sensitive_and_compliance",
                    severity="critical",
                    action="block",
                    confidence=0.98,
                    paragraph_index=sentence["paragraph_index"],
                    sentence_index=sentence["sentence_index"],
                    text_excerpt=sentence_text,
                    normalized_excerpt=sentence_text,
                    explanation=f"Detected a blocked compliance phrase: {phrase}.",
                    source_kind="lexicon",
                    source_id=f"compliance/{phrase}",
                )
            )

        for phrase in MANUAL_REVIEW_COMPLIANCE_PATTERNS:
            if phrase not in sentence_text:
                continue

            issues.append(
                _build_issue(
                    issue_type="compliance.risky_claim",
                    category="sensitive_and_compliance",
                    severity="high",
                    action="manual_review",
                    confidence=0.94,
                    paragraph_index=sentence["paragraph_index"],
                    sentence_index=sentence["sentence_index"],
                    text_excerpt=sentence_text,
                    normalized_excerpt=sentence_text,
                    explanation=(
                        f"Detected a risky absolute or promotional claim: {phrase}."
                    ),
                    source_kind="lexicon",
                    source_id=f"compliance/{phrase}",
                )
            )

    return issues


def check_logic_suspicions(normalized: NormalizedDocument) -> list[QualityIssue]:
    issues: list[QualityIssue] = []
    result_sentences = [
        sentence
        for sentence in normalized["sentence_blocks"]
        if "结果" in sentence["normalized_text"]
    ]
    conclusion_sentences = [
        sentence
        for sentence in normalized["sentence_blocks"]
        if "结论" in sentence["normalized_text"]
    ]

    for result_sentence in result_sentences:
        result_polarity = _sentence_polarity(result_sentence["normalized_text"])
        if result_polarity == 0:
            continue

        for conclusion_sentence in conclusion_sentences:
            conclusion_polarity = _sentence_polarity(
                conclusion_sentence["normalized_text"]
            )
            if conclusion_polarity == 0 or conclusion_polarity == result_polarity:
                continue

            shared_concepts = [
                concept
                for concept in LOGIC_CONCEPTS
                if concept in result_sentence["normalized_text"]
                and concept in conclusion_sentence["normalized_text"]
            ]
            if not shared_concepts:
                continue

            issues.append(
                _build_issue(
                    issue_type="logic.result_conclusion_conflict",
                    category="sentence_and_logic",
                    severity="high",
                    action="manual_review",
                    confidence=0.83,
                    paragraph_index=conclusion_sentence["paragraph_index"],
                    sentence_index=conclusion_sentence["sentence_index"],
                    text_excerpt=conclusion_sentence["normalized_text"],
                    normalized_excerpt=conclusion_sentence["normalized_text"],
                    explanation=(
                        "Detected a potential result/conclusion contradiction around "
                        + ", ".join(shared_concepts)
                        + "."
                    ),
                    source_kind="deterministic_rule",
                    source_id="logic/result-conclusion-conflict",
                )
            )
            return issues

    return issues


def _sentence_polarity(text: str) -> int:
    for marker in NEGATIVE_LOGIC_MARKERS:
        if marker in text:
            return -1

    for marker in POSITIVE_LOGIC_MARKERS:
        if marker in text:
            return 1

    return 0


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
    suggested_replacement: str | None = None,
    source_id: str | None = None,
) -> QualityIssue:
    identity = f"{issue_type}|{paragraph_index}|{sentence_index}|{text_excerpt}"
    issue_id = hashlib.sha1(identity.encode("utf-8")).hexdigest()[:12]

    issue: QualityIssue = {
        "issue_id": issue_id,
        "module_scope": GENERAL_PROOFREADING_SCOPE,
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
    if suggested_replacement is not None:
        issue["suggested_replacement"] = suggested_replacement
    if source_id is not None:
        issue["source_id"] = source_id

    return issue


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError as error:
        sys.stderr.write(f"Invalid JSON payload: {error}\n")
        return 1

    if not isinstance(payload, dict) or not isinstance(payload.get("blocks"), list):
        sys.stderr.write("Expected a JSON object with a blocks array.\n")
        return 1

    raw_quality_packages = payload.get("quality_packages")
    quality_packages = raw_quality_packages if isinstance(raw_quality_packages, list) else None
    result = run_general_proofreading(
        payload["blocks"],
        quality_packages=quality_packages,
    )
    sys.stdout.write(json.dumps(result, ensure_ascii=False))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
