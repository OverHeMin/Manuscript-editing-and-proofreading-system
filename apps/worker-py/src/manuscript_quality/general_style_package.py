from __future__ import annotations

import hashlib
import re
from typing import Any

from manuscript_quality.contracts import GENERAL_PROOFREADING_SCOPE, NormalizedDocument, QualityIssue


SECTION_ALIASES = {
    "abstract": ("abstract", "摘要"),
    "results": ("results", "result", "结果"),
    "conclusion": ("conclusion", "conclusions", "结论"),
}
LABEL_ALIASES = {
    "objective": ("objective", "objectives", "目的"),
    "methods": ("methods", "method", "方法"),
    "results": ("results", "result", "结果"),
    "conclusion": ("conclusion", "conclusions", "结论"),
}
HEADING_PUNCTUATION = re.compile(r"[:：()\[\]\-—_]+")


def select_general_style_package(quality_packages: list[dict] | None) -> dict | None:
    if not quality_packages:
        return None

    for quality_package in quality_packages:
        if quality_package.get("package_kind") != "general_style_package":
            continue

        manifest = quality_package.get("manifest")
        parsed = parse_general_style_manifest(manifest)
        if parsed is not None:
            return parsed

    return None


def parse_general_style_manifest(manifest: Any) -> dict | None:
    if not isinstance(manifest, dict):
        return None

    section_expectations = manifest.get("section_expectations")
    tone_markers = manifest.get("tone_markers")
    posture_checks = manifest.get("posture_checks")
    issue_policy = manifest.get("issue_policy")
    if not isinstance(section_expectations, dict):
        return None
    if not isinstance(tone_markers, dict):
        return None
    if not isinstance(posture_checks, dict):
        return None
    if not isinstance(issue_policy, dict):
        return None

    normalized_section_expectations: dict[str, dict[str, list[str]]] = {}
    for section_name, raw_expectation in section_expectations.items():
        if not isinstance(section_name, str) or not isinstance(raw_expectation, dict):
            return None

        required_labels = raw_expectation.get("required_labels")
        if required_labels is not None:
            if not _is_string_list(required_labels):
                return None
            normalized_section_expectations[section_name.lower()] = {
                "required_labels": [label.lower() for label in required_labels],
            }
        else:
            normalized_section_expectations[section_name.lower()] = {}

    strong_claims = tone_markers.get("strong_claims")
    cautious_claims = tone_markers.get("cautious_claims")
    if not _is_string_list(strong_claims) or not _is_string_list(cautious_claims):
        return None

    normalized_posture_checks: dict[str, list[str]] = {}
    for posture_key in ("abstract", "results", "conclusion"):
        posture_values = posture_checks.get(posture_key)
        if not _is_string_list(posture_values):
            return None
        normalized_posture_checks[posture_key] = [
            value.lower() for value in posture_values
        ]

    normalized_issue_policy: dict[str, dict[str, str]] = {}
    for issue_key, raw_policy in issue_policy.items():
        if not isinstance(issue_key, str) or not isinstance(raw_policy, dict):
            return None

        severity = raw_policy.get("severity")
        action = raw_policy.get("action")
        if not isinstance(severity, str) or not isinstance(action, str):
            return None

        normalized_issue_policy[issue_key] = {
            "severity": severity,
            "action": action,
        }

    genre_wording_suspicions = manifest.get("genre_wording_suspicions")
    if genre_wording_suspicions is not None and not _is_string_list(
        genre_wording_suspicions
    ):
        return None

    return {
        "section_expectations": normalized_section_expectations,
        "tone_markers": {
            "strong_claims": [phrase.lower() for phrase in strong_claims],
            "cautious_claims": [phrase.lower() for phrase in cautious_claims],
        },
        "posture_checks": normalized_posture_checks,
        "genre_wording_suspicions": [
            phrase.lower() for phrase in (genre_wording_suspicions or [])
        ],
        "issue_policy": normalized_issue_policy,
    }


def check_section_expectations(
    normalized: NormalizedDocument,
    style_package: dict,
) -> list[QualityIssue]:
    issues: list[QualityIssue] = []
    sections = collect_sections(normalized)
    policy = _policy_for(style_package, "section_expectation_missing")

    for section_name, expectation in style_package["section_expectations"].items():
        section = sections.get(section_name)
        if not section:
            continue

        required_labels = expectation.get("required_labels", [])
        missing_labels = [
            label
            for label in required_labels
            if not _contains_label(section["content"], label)
        ]
        if not missing_labels:
            continue

        issues.append(
            _build_style_issue(
                issue_type="style.section_expectation_missing",
                severity=policy["severity"],
                action=policy["action"],
                paragraph_index=section["paragraph_index"],
                text_excerpt=section["content"],
                explanation=(
                    f"Section {section_name} is missing expected labels: "
                    + ", ".join(missing_labels)
                    + "."
                ),
                source_id="style/section-expectation-missing",
            )
        )

    return issues


def check_tone_consistency(
    normalized: NormalizedDocument,
    style_package: dict,
) -> list[QualityIssue]:
    issues: list[QualityIssue] = []
    sections = collect_sections(normalized)
    policy = _policy_for(style_package, "tone_overclaim")
    strong_claims = style_package["tone_markers"]["strong_claims"]
    cautious_claims = style_package["tone_markers"]["cautious_claims"]

    for section_name in ("abstract", "conclusion"):
        section = sections.get(section_name)
        if not section:
            continue

        lower_text = section["content"].lower()
        matched_claim = next(
            (phrase for phrase in strong_claims if phrase in lower_text),
            None,
        )
        if matched_claim is None:
            continue
        if any(marker in lower_text for marker in cautious_claims):
            continue

        issues.append(
            _build_style_issue(
                issue_type="style.tone_overclaim",
                severity=policy["severity"],
                action=policy["action"],
                paragraph_index=section["paragraph_index"],
                text_excerpt=section["content"],
                explanation=(
                    f"Section {section_name} contains a strong claim without cautious framing: "
                    f"{matched_claim}."
                ),
                source_id="style/tone-overclaim",
            )
        )

    return issues


def check_posture_suspicions(
    normalized: NormalizedDocument,
    style_package: dict,
) -> list[QualityIssue]:
    sections = collect_sections(normalized)
    results_section = sections.get("results")
    conclusion_section = sections.get("conclusion")
    if not results_section or not conclusion_section:
        return []

    conclusion_text = conclusion_section["content"].lower()
    results_text = results_section["content"].lower()
    strong_claims = style_package["tone_markers"]["strong_claims"]
    cautious_claims = style_package["tone_markers"]["cautious_claims"]
    result_markers = style_package["posture_checks"]["results"]
    conclusion_markers = style_package["posture_checks"]["conclusion"]
    matched_claim = next(
        (phrase for phrase in strong_claims if phrase in conclusion_text),
        None,
    )
    if matched_claim is None:
        return []

    results_have_support = any(marker in results_text for marker in result_markers)
    conclusion_has_caution = any(
        marker in conclusion_text
        for marker in [*cautious_claims, *conclusion_markers]
    )
    if results_have_support and conclusion_has_caution:
        return []

    policy = _policy_for(style_package, "result_conclusion_jump")
    return [
        _build_style_issue(
            issue_type="style.result_conclusion_jump",
            severity=policy["severity"],
            action=policy["action"],
            paragraph_index=conclusion_section["paragraph_index"],
            text_excerpt=conclusion_section["content"],
            explanation=(
                "Conclusion posture appears stronger than the results framing: "
                f"{matched_claim}."
            ),
            source_id="style/result-conclusion-jump",
        )
    ]


def check_genre_wording_suspicions(
    normalized: NormalizedDocument,
    style_package: dict,
) -> list[QualityIssue]:
    issues: list[QualityIssue] = []
    policy = _policy_for(style_package, "genre_wording_suspicion")

    for paragraph in normalized["paragraph_blocks"]:
        lower_text = paragraph["normalized_text"].lower()
        matched_phrase = next(
            (
                phrase
                for phrase in style_package.get("genre_wording_suspicions", [])
                if phrase in lower_text
            ),
            None,
        )
        if matched_phrase is None:
            continue

        issues.append(
            _build_style_issue(
                issue_type="style.genre_wording_suspicion",
                severity=policy["severity"],
                action=policy["action"],
                paragraph_index=paragraph["paragraph_index"],
                text_excerpt=paragraph["normalized_text"],
                explanation=(
                    f"Detected wording that may not fit a medical research article: {matched_phrase}."
                ),
                source_id="style/genre-wording-suspicion",
            )
        )

    return issues


def collect_sections(normalized: NormalizedDocument) -> dict[str, dict]:
    sections: dict[str, dict] = {}
    current_section: dict | None = None

    for paragraph in normalized["paragraph_blocks"]:
        heading_name = _canonical_section_name(paragraph["normalized_text"])
        if paragraph["block_kind"] == "heading" and heading_name is not None:
            current_section = {
                "name": heading_name,
                "paragraph_index": paragraph["paragraph_index"],
                "content": "",
            }
            sections[heading_name] = current_section
            continue

        inline_heading_name = _canonical_section_name_from_prefix(
            paragraph["normalized_text"]
        )
        if inline_heading_name is not None:
            current_section = sections.get(inline_heading_name)
            if current_section is None:
                current_section = {
                    "name": inline_heading_name,
                    "paragraph_index": paragraph["paragraph_index"],
                    "content": "",
                }
                sections[inline_heading_name] = current_section

        if current_section is None:
            continue

        content = paragraph["normalized_text"]
        if current_section["content"]:
            current_section["content"] += " "
        current_section["content"] += content

    return sections


def _canonical_section_name(text: str) -> str | None:
    lowered = HEADING_PUNCTUATION.sub(" ", text.lower()).strip()

    for section_name, aliases in SECTION_ALIASES.items():
        if any(alias.lower() == lowered for alias in aliases):
            return section_name

    return None


def _canonical_section_name_from_prefix(text: str) -> str | None:
    prefix = text.split(":", 1)[0].split("：", 1)[0]
    prefix = HEADING_PUNCTUATION.sub(" ", prefix.lower()).strip()

    for section_name, aliases in SECTION_ALIASES.items():
        if any(alias.lower() == prefix for alias in aliases):
            return section_name

    return None


def _contains_label(text: str, label: str) -> bool:
    lowered = text.lower()
    aliases = LABEL_ALIASES.get(label.lower(), (label.lower(),))
    return any(alias.lower() in lowered for alias in aliases)


def _policy_for(style_package: dict, key: str) -> dict[str, str]:
    policy = style_package.get("issue_policy", {}).get(key)
    if isinstance(policy, dict):
        severity = policy.get("severity")
        action = policy.get("action")
        if isinstance(severity, str) and isinstance(action, str):
            return {
                "severity": severity,
                "action": action,
            }

    return {
        "severity": "medium",
        "action": "suggest_fix",
    }


def _build_style_issue(
    *,
    issue_type: str,
    severity: str,
    action: str,
    paragraph_index: int,
    text_excerpt: str,
    explanation: str,
    source_id: str,
) -> QualityIssue:
    identity = f"{issue_type}|{paragraph_index}|{text_excerpt}"
    issue_id = hashlib.sha1(identity.encode("utf-8")).hexdigest()[:12]

    return {
        "issue_id": issue_id,
        "module_scope": GENERAL_PROOFREADING_SCOPE,
        "issue_type": issue_type,
        "category": "sentence_and_logic",
        "severity": severity,
        "action": action,
        "confidence": 0.78,
        "source_kind": "deterministic_rule",
        "source_id": source_id,
        "paragraph_index": paragraph_index,
        "text_excerpt": text_excerpt,
        "normalized_excerpt": text_excerpt,
        "explanation": explanation,
    }


def _is_string_list(value: Any) -> bool:
    return isinstance(value, list) and all(isinstance(entry, str) for entry in value)
