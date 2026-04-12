from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from manuscript_quality.general_proofreading import run_general_proofreading


def test_general_proofreading_emits_style_findings_only_when_a_style_package_is_bound():
    blocks = [
        {"text": "Abstract", "style": "Heading 1"},
        {
            "text": "Methods: patients were grouped. Results: symptoms improved. Conclusion: treatment was safe.",
            "style": "Normal",
        },
    ]
    quality_packages = [
        {
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
                },
            },
        }
    ]

    report_without_style = run_general_proofreading(blocks)
    report_with_style = run_general_proofreading(
        blocks,
        quality_packages=quality_packages,
    )

    assert not any(
        issue["issue_type"].startswith("style.")
        for issue in report_without_style["issues"]
    )
    style_issue = next(
        issue
        for issue in report_with_style["issues"]
        if issue["issue_type"] == "style.section_expectation_missing"
    )

    assert style_issue["issue_type"] == "style.section_expectation_missing"
    assert style_issue["category"] == "sentence_and_logic"
    assert style_issue["action"] == "suggest_fix"
