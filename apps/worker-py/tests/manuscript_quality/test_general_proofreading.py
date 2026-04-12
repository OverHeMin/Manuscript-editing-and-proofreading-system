from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from manuscript_quality.general_proofreading import run_general_proofreading


def test_general_proofreading_detects_punctuation_spacing_and_lexical_candidates():
    report = run_general_proofreading(
        [
            {"text": "摘要：研究Ａ组与B组，，结果提示安全性（良好。", "style": "Heading 1"},
            {"text": "患者的的症状明显缓解。", "style": "Normal"},
        ]
    )

    categories = {issue["category"] for issue in report["issues"]}

    assert "punctuation_and_pairs" in categories
    assert "full_half_width_and_spacing" in categories
    assert "typo_redundancy_and_omission" in categories

    punctuation_issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "punctuation.repeated_mark"
    )
    lexical_issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "lexical.duplicated_particle"
    )

    assert punctuation_issue["action"] == "auto_fix"
    assert punctuation_issue["module_scope"] == "general_proofreading"
    assert lexical_issue["action"] == "suggest_fix"
    assert lexical_issue["suggested_replacement"] == "患者的症状明显缓解。"


def test_general_proofreading_detects_consistency_compliance_and_logic_suspicions():
    report = run_general_proofreading(
        [
            {"text": "摘要：本研究共纳入120例患者。", "style": "Heading 1"},
            {"text": "结果：本研究共纳入118例患者。", "style": "Normal"},
            {"text": "结论：该方案绝对安全，可保证治愈。", "style": "Normal"},
            {"text": "结果：治疗后症状明显改善。", "style": "Normal"},
            {"text": "结论：该治疗无明显改善。", "style": "Normal"},
        ]
    )

    consistency_issue = next(
        issue for issue in report["issues"] if issue["category"] == "consistency"
    )
    compliance_issue = next(
        issue
        for issue in report["issues"]
        if issue["category"] == "sensitive_and_compliance"
    )
    logic_issue = next(
        issue for issue in report["issues"] if issue["category"] == "sentence_and_logic"
    )

    assert consistency_issue["action"] == "manual_review"
    assert "120" in consistency_issue["explanation"]
    assert "118" in consistency_issue["explanation"]
    assert compliance_issue["action"] == "manual_review"
    assert compliance_issue["source_kind"] == "lexicon"
    assert logic_issue["action"] == "manual_review"
    assert "改善" in logic_issue["explanation"]
