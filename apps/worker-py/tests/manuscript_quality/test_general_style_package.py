from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from manuscript_quality.general_style_package import (
    check_section_expectations,
    select_general_style_package,
)
from manuscript_quality.text_normalization import build_normalized_document


def build_style_package_record():
    return {
        "package_id": "quality-package-style-1",
        "package_name": "Medical Research Style",
        "package_kind": "general_style_package",
        "target_scopes": ["general_proofreading"],
        "version": 1,
        "manifest": {
            "section_expectations": {
                "abstract": {
                    "required_labels": [
                        "objective",
                        "methods",
                        "results",
                        "conclusion",
                    ]
                }
            },
            "tone_markers": {
                "strong_claims": ["prove", "guarantee", "definitive", "cure"],
                "cautious_claims": ["suggest", "may", "appears"],
            },
            "posture_checks": {
                "abstract": ["objective", "methods", "results", "conclusion"],
                "results": ["measured", "observed", "compared", "improved"],
                "conclusion": ["suggest", "may", "support", "indicate"],
            },
            "genre_wording_suspicions": ["news report", "experience sharing"],
            "issue_policy": {
                "section_expectation_missing": {
                    "severity": "medium",
                    "action": "suggest_fix",
                },
                "result_conclusion_jump": {
                    "severity": "high",
                    "action": "manual_review",
                },
                "tone_overclaim": {
                    "severity": "medium",
                    "action": "suggest_fix",
                },
                "genre_wording_suspicion": {
                    "severity": "medium",
                    "action": "suggest_fix",
                },
            },
        },
    }


def test_select_general_style_package_prefers_structured_style_manifest():
    style_package = select_general_style_package(
        [
            {
                "package_id": "quality-package-style-legacy",
                "package_name": "Legacy Style",
                "package_kind": "general_style_package",
                "target_scopes": ["general_proofreading"],
                "version": 1,
                "manifest": {
                    "style_family": "medical_research_article",
                },
            },
            build_style_package_record(),
        ]
    )

    assert style_package is not None
    assert style_package["section_expectations"]["abstract"]["required_labels"] == [
        "objective",
        "methods",
        "results",
        "conclusion",
    ]


def test_general_style_package_detects_missing_abstract_labels():
    normalized = build_normalized_document(
        [
            {
                "text": "Abstract",
                "style": "Heading 1",
            },
            {
                "text": "Methods: patients were grouped. Results: symptoms improved. Conclusion: treatment was safe.",
                "style": "Normal",
            },
        ]
    )

    style_package = select_general_style_package([build_style_package_record()])
    assert style_package is not None

    issues = check_section_expectations(normalized, style_package)
    issue = next(
        issue
        for issue in issues
        if issue["issue_type"] == "style.section_expectation_missing"
    )

    assert issue["issue_type"] == "style.section_expectation_missing"
    assert issue["category"] == "sentence_and_logic"
    assert issue["action"] == "suggest_fix"
    assert "objective" in issue["explanation"]
