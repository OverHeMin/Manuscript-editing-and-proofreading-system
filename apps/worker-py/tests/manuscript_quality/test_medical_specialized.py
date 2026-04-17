from copy import deepcopy
from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from manuscript_quality.medical_specialized import run_medical_specialized


def build_medical_package_record(*, manifest_overrides: dict | None = None) -> dict:
    manifest = {
        "indicator_dictionary": {
            "ALT": {
                "aliases": ["alanine aminotransferase"],
                "default_unit": "U/L",
            }
        },
        "unit_ranges": {
            "ALT": [
                {
                    "unit": "U/L",
                    "min": 0,
                    "max": 1000,
                }
            ]
        },
        "comparison_templates": {
            "pre_post": ["before treatment|after treatment"],
            "group_comparison": ["treatment group|control group"],
        },
        "count_constraints": {
            "percent": {
                "max_percent": 100,
            }
        },
        "diagnostic_metrics": {
            "metric_aliases": {
                "AUC": ["AUC", "area under the curve"],
                "sensitivity": ["sensitivity", "sens"],
                "specificity": ["specificity", "spec"],
            },
            "metric_ranges": {
                "AUC": {
                    "min": 0.5,
                    "max": 1,
                },
                "sensitivity": {
                    "min": 0,
                    "max": 1,
                },
                "specificity": {
                    "min": 0,
                    "max": 1,
                },
            },
            "confusion_matrix_aliases": {
                "tp": ["TP", "true positive"],
                "fp": ["FP", "false positive"],
                "fn": ["FN", "false negative"],
                "tn": ["TN", "true negative"],
            },
            "ci_confidence_levels": [95],
        },
        "regression_metrics": {
            "field_aliases": {
                "beta": ["beta", "β"],
                "SE": ["SE", "standard error"],
                "p_value": ["P", "P value"],
                "confidence_interval": ["95% CI", "confidence interval"],
            },
            "ci_confidence_levels": [95],
        },
        "issue_policy": {
            "table_text_direction_conflict": {
                "severity": "high",
                "action": "manual_review",
            },
            "significance_claim_conflict": {
                "severity": "high",
                "action": "manual_review",
            },
            "diagnostic_metric_out_of_range": {
                "severity": "medium",
                "action": "manual_review",
            },
            "diagnostic_metric_mismatch": {
                "severity": "high",
                "action": "manual_review",
            },
            "auc_confidence_interval_conflict": {
                "severity": "high",
                "action": "manual_review",
            },
            "regression_coefficient_conflict": {
                "severity": "high",
                "action": "manual_review",
            },
            "test_statistic_conflict": {
                "severity": "high",
                "action": "manual_review",
            }
        },
        "analyzer_toggles": {
            "table_text_consistency": True,
            "numeric_consistency": True,
            "medical_logic": True,
            "diagnostic_metric_consistency": True,
            "regression_consistency": True,
            "statistical_recheck": True,
            "inferential_statistic_consistency": True,
        },
    }
    if manifest_overrides:
        for key, value in manifest_overrides.items():
            manifest[key] = deepcopy(value)

    return {
        "package_id": "quality-package-medical-1",
        "package_name": "Medical Analyzer Default",
        "package_kind": "medical_analyzer_package",
        "target_scopes": ["medical_specialized"],
        "version": 1,
        "manifest": manifest,
    }


def test_medical_specialized_detects_terminology_drift_and_numeric_conflicts():
    report = run_medical_specialized(
        [
            {
                "text": "Methods: alanine aminotransferase (ALT) was measured at baseline.",
                "style": "Heading 1",
            },
            {
                "text": "Results: aspartate aminotransferase (ALT) improved after treatment.",
                "style": "Normal",
            },
            {
                "text": "Abstract: 120 participants were enrolled in the trial.",
                "style": "Normal",
            },
            {
                "text": "Results: 118 participants were enrolled in the trial.",
                "style": "Normal",
            },
        ]
    )

    terminology_issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "medical_terminology.abbreviation_drift"
    )
    numeric_issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "medical_data_consistency.sample_size_conflict"
    )

    assert terminology_issue["module_scope"] == "medical_specialized"
    assert terminology_issue["action"] == "manual_review"
    assert "ALT" in terminology_issue["explanation"]
    assert terminology_issue["category"] == "medical_logic"

    assert numeric_issue["module_scope"] == "medical_specialized"
    assert numeric_issue["action"] == "manual_review"
    assert "120" in numeric_issue["explanation"]
    assert "118" in numeric_issue["explanation"]
    assert numeric_issue["category"] == "medical_calculation_and_parsing"


def test_medical_specialized_detects_statistics_evidence_and_privacy_risks():
    report = run_medical_specialized(
        [
            {
                "text": (
                    "Results: p = 0.07, yet the manuscript claims a statistically "
                    "significant improvement."
                ),
                "style": "Normal",
            },
            {
                "text": (
                    "Conclusion: this observational study proves the treatment cures "
                    "every patient."
                ),
                "style": "Normal",
            },
            {
                "text": "Contact patient@example.com for the identified case follow-up.",
                "style": "Normal",
            },
        ]
    )

    statistical_issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "statistical_expression.significance_mismatch"
    )
    evidence_issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "evidence_alignment.overstated_conclusion"
    )
    privacy_issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "ethics_privacy.direct_identifier"
    )

    assert statistical_issue["module_scope"] == "medical_specialized"
    assert statistical_issue["action"] == "manual_review"
    assert statistical_issue["category"] == "medical_calculation_and_parsing"

    assert evidence_issue["module_scope"] == "medical_specialized"
    assert evidence_issue["action"] == "manual_review"
    assert evidence_issue["category"] == "medical_logic"

    assert privacy_issue["module_scope"] == "medical_specialized"
    assert privacy_issue["action"] == "block"
    assert privacy_issue["severity"] == "critical"
    assert privacy_issue["category"] == "medical_logic"


def test_medical_specialized_detects_narrative_group_sum_conflict():
    report = run_medical_specialized(
        [
            {
                "text": "Methods: 120 participants were enrolled in the trial.",
                "style": "Normal",
            },
            {
                "text": "Results: 60 patients were assigned to the Treatment group.",
                "style": "Normal",
            },
            {
                "text": "Results: 50 patients were assigned to the Control group.",
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "medical_data_consistency.narrative_group_sum_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "120" in issue["explanation"]
    assert "110" in issue["explanation"]
    assert "Treatment group" in issue["explanation"]
    assert "Control group" in issue["explanation"]


def test_medical_specialized_detects_sex_count_sum_conflict():
    report = run_medical_specialized(
        [
            {
                "text": "Methods: 120 participants were enrolled in the trial.",
                "style": "Normal",
            },
            {
                "text": "Results: The cohort included 70 male and 40 female participants.",
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "medical_data_consistency.sex_count_sum_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "120" in issue["explanation"]
    assert "110" in issue["explanation"]
    assert "male" in issue["explanation"]
    assert "female" in issue["explanation"]


def test_medical_specialized_detects_event_count_exceeds_sample_size():
    report = run_medical_specialized(
        [
            {
                "text": "Methods: 120 participants were enrolled in the trial.",
                "style": "Normal",
            },
            {
                "text": "Results: 130 patients experienced adverse events during follow-up.",
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "medical_data_consistency.event_count_exceeds_sample_size"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "120" in issue["explanation"]
    assert "130" in issue["explanation"]
    assert "adverse events" in issue["explanation"]


def test_medical_specialized_detects_attrition_analysis_count_conflict():
    report = run_medical_specialized(
        [
            {
                "text": "Methods: 120 participants were enrolled in the trial.",
                "style": "Normal",
            },
            {
                "text": "Results: 15 participants were lost to follow-up.",
                "style": "Normal",
            },
            {
                "text": "Results: 110 participants were analyzed.",
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "medical_data_consistency.attrition_analysis_count_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "120" in issue["explanation"]
    assert "15" in issue["explanation"]
    assert "110" in issue["explanation"]
    assert "105" in issue["explanation"]


def test_medical_specialized_detects_follow_up_duration_conflict():
    report = run_medical_specialized(
        [
            {
                "text": "Methods: The follow-up period was 12 weeks.",
                "style": "Normal",
            },
            {
                "text": "Results: Patients were followed for 8 weeks.",
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "medical_data_consistency.follow_up_duration_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "12 weeks" in issue["explanation"]
    assert "8 weeks" in issue["explanation"]


def test_medical_specialized_detects_cross_section_group_count_conflict():
    report = run_medical_specialized(
        [
            {
                "text": "Abstract: 60 patients were assigned to the Treatment group.",
                "style": "Normal",
            },
            {
                "text": "Results: 58 patients were assigned to the Treatment group.",
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "medical_data_consistency.cross_section_group_count_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "Treatment group" in issue["explanation"]
    assert "60" in issue["explanation"]
    assert "58" in issue["explanation"]
    assert "Abstract" in issue["explanation"]
    assert "Results" in issue["explanation"]


def test_medical_specialized_detects_group_event_count_exceeds_group_size():
    report = run_medical_specialized(
        [
            {
                "text": "Methods: 60 patients were assigned to the Treatment group.",
                "style": "Normal",
            },
            {
                "text": (
                    "Results: 70 patients in the Treatment group experienced adverse "
                    "events during follow-up."
                ),
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "medical_data_consistency.group_event_count_exceeds_group_size"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "Treatment group" in issue["explanation"]
    assert "60" in issue["explanation"]
    assert "70" in issue["explanation"]
    assert "adverse events" in issue["explanation"]


def test_medical_specialized_detects_group_attrition_analysis_count_conflict():
    report = run_medical_specialized(
        [
            {
                "text": "Methods: 60 patients were assigned to the Treatment group.",
                "style": "Normal",
            },
            {
                "text": (
                    "Results: 10 patients in the Treatment group were lost to follow-up."
                ),
                "style": "Normal",
            },
            {
                "text": "Results: 55 patients in the Treatment group were analyzed.",
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "medical_data_consistency.group_attrition_analysis_count_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "Treatment group" in issue["explanation"]
    assert "60" in issue["explanation"]
    assert "10" in issue["explanation"]
    assert "55" in issue["explanation"]
    assert "50" in issue["explanation"]


def test_medical_specialized_detects_group_analyzed_count_exceeds_group_size():
    report = run_medical_specialized(
        [
            {
                "text": "Methods: 60 patients were assigned to the Treatment group.",
                "style": "Normal",
            },
            {
                "text": "Results: 70 patients in the Treatment group were analyzed.",
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "medical_data_consistency.group_analyzed_count_exceeds_group_size"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "Treatment group" in issue["explanation"]
    assert "60" in issue["explanation"]
    assert "70" in issue["explanation"]


def test_medical_specialized_detects_group_attrition_count_exceeds_group_size():
    report = run_medical_specialized(
        [
            {
                "text": "Methods: 60 patients were assigned to the Treatment group.",
                "style": "Normal",
            },
            {
                "text": (
                    "Results: 70 patients in the Treatment group were lost to follow-up."
                ),
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "medical_data_consistency.group_attrition_count_exceeds_group_size"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "Treatment group" in issue["explanation"]
    assert "60" in issue["explanation"]
    assert "70" in issue["explanation"]


def test_medical_specialized_detects_group_event_count_percent_mismatch():
    report = run_medical_specialized(
        [
            {
                "text": "Methods: 60 patients were assigned to the Treatment group.",
                "style": "Normal",
            },
            {
                "text": (
                    "Results: 30 (60%) patients in the Treatment group experienced "
                    "adverse events during follow-up."
                ),
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "medical_data_consistency.group_event_count_percent_mismatch"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "Treatment group" in issue["explanation"]
    assert "30" in issue["explanation"]
    assert "60%" in issue["explanation"]
    assert "50" in issue["explanation"]


def test_medical_specialized_detects_dual_group_event_count_percent_mismatch():
    report = run_medical_specialized(
        [
            {
                "text": "Methods: 60 patients were assigned to the Treatment group.",
                "style": "Normal",
            },
            {
                "text": "Methods: 40 patients were assigned to the Control group.",
                "style": "Normal",
            },
            {
                "text": (
                    "Results: 30 (40%) patients in the Treatment group and 20 (50%) "
                    "patients in the Control group experienced adverse events during "
                    "follow-up."
                ),
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "medical_data_consistency.group_event_count_percent_mismatch"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "Treatment group" in issue["explanation"]
    assert "30" in issue["explanation"]
    assert "40%" in issue["explanation"]
    assert "50" in issue["explanation"]


def test_medical_specialized_detects_group_comparison_event_percent_conflict():
    report = run_medical_specialized(
        [
            {
                "text": (
                    "Results: The adverse event rate in the Treatment group was lower "
                    "than the Control group; 30 (50%) patients in the Treatment group "
                    "and 10 (25%) patients in the Control group experienced adverse events."
                ),
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "medical_data_consistency.group_comparison_event_percent_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "Treatment group" in issue["explanation"]
    assert "Control group" in issue["explanation"]
    assert "lower" in issue["explanation"]
    assert "50%" in issue["explanation"]
    assert "25%" in issue["explanation"]


def test_medical_specialized_detects_group_comparison_event_count_conflict():
    report = run_medical_specialized(
        [
            {
                "text": (
                    "Results: The adverse event count in the Treatment group was lower "
                    "than the Control group; 30 patients in the Treatment group and 10 "
                    "patients in the Control group experienced adverse events during "
                    "follow-up."
                ),
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "medical_data_consistency.group_comparison_event_count_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "Treatment group" in issue["explanation"]
    assert "Control group" in issue["explanation"]
    assert "lower" in issue["explanation"]
    assert "30" in issue["explanation"]
    assert "10" in issue["explanation"]


def test_medical_specialized_detects_cross_section_group_event_comparison_conflict():
    report = run_medical_specialized(
        [
            {
                "text": (
                    "Abstract: The adverse event rate in the Treatment group was lower "
                    "than the Control group."
                ),
                "style": "Normal",
            },
            {
                "text": (
                    "Results: The adverse event rate in the Treatment group was higher "
                    "than the Control group."
                ),
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "medical_logic.cross_section_group_event_comparison_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_logic"
    assert "Treatment group" in issue["explanation"]
    assert "Control group" in issue["explanation"]
    assert "lower" in issue["explanation"]
    assert "higher" in issue["explanation"]
    assert "Abstract" in issue["explanation"]
    assert "Results" in issue["explanation"]


def test_medical_specialized_detects_cross_section_group_event_count_percent_conflict():
    report = run_medical_specialized(
        [
            {
                "text": (
                    "Abstract: 30 (50%) patients in the Treatment group experienced "
                    "adverse events during follow-up."
                ),
                "style": "Normal",
            },
            {
                "text": (
                    "Results: 30 (60%) patients in the Treatment group experienced "
                    "adverse events during follow-up."
                ),
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "medical_data_consistency.cross_section_group_event_count_percent_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "Treatment group" in issue["explanation"]
    assert "adverse events" in issue["explanation"]
    assert "50%" in issue["explanation"]
    assert "60%" in issue["explanation"]
    assert "Abstract" in issue["explanation"]
    assert "Results" in issue["explanation"]


def test_medical_specialized_detects_cross_section_group_event_count_conflict():
    report = run_medical_specialized(
        [
            {
                "text": (
                    "Abstract: 30 patients in the Treatment group experienced "
                    "adverse events during follow-up."
                ),
                "style": "Normal",
            },
            {
                "text": (
                    "Results: 28 patients in the Treatment group experienced "
                    "adverse events during follow-up."
                ),
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "medical_data_consistency.cross_section_group_event_count_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "Treatment group" in issue["explanation"]
    assert "adverse events" in issue["explanation"]
    assert "30" in issue["explanation"]
    assert "28" in issue["explanation"]
    assert "Abstract" in issue["explanation"]
    assert "Results" in issue["explanation"]


def test_medical_specialized_detects_table_text_numeric_conflicts_with_spaced_mean_values():
    report = run_medical_specialized(
        [
            {
                "text": "Results: ALT in the treatment group was 15.2 ± 1.3 according to Table 1.",
                "style": "Normal",
            },
        ],
        table_snapshots=[
            {
                "table_id": "Table 1",
                "profile": {
                    "is_three_line_table": True,
                    "header_depth": 1,
                    "has_stub_column": True,
                    "has_statistical_footnotes": False,
                    "has_unit_markers": False,
                },
                "header_cells": [],
                "data_cells": [
                    {
                        "id": "cell-1",
                        "text": "18.2 ± 1.3",
                        "row_index": 0,
                        "column_index": 0,
                        "row_key": "ALT",
                        "column_key": "treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT",
                            "column_key": "treatment group",
                        },
                    }
                ],
                "footnote_items": [],
            }
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "table_text_consistency.narrative_table_value_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "table_text_consistency"
    assert "15.2 ± 1.3" in issue["explanation"]
    assert "18.2 ± 1.3" in issue["explanation"]


def test_medical_specialized_detects_table_p_value_conflicts_against_narrative_claims():
    report = run_medical_specialized(
        [
            {
                "text": "Results: ALT showed no statistically significant difference in Table 1 (P > 0.05).",
                "style": "Normal",
            },
        ],
        table_snapshots=[
            {
                "table_id": "Table 1",
                "profile": {
                    "is_three_line_table": True,
                    "header_depth": 1,
                    "has_stub_column": True,
                    "has_statistical_footnotes": False,
                    "has_unit_markers": False,
                },
                "header_cells": [],
                "data_cells": [
                    {
                        "id": "cell-p-1",
                        "text": "0.03",
                        "row_index": 0,
                        "column_index": 1,
                        "row_key": "ALT",
                        "column_key": "P",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT",
                            "column_key": "P",
                        },
                    }
                ],
                "footnote_items": [],
            }
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "statistical_expression.table_p_value_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "table_text_consistency"
    assert "P > 0.05" in issue["explanation"]
    assert "0.03" in issue["explanation"]


def test_medical_specialized_detects_narrative_total_conflict_against_table_group_sum():
    report = run_medical_specialized(
        [
            {
                "text": "Abstract: 120 participants were enrolled in the trial.",
                "style": "Normal",
            },
        ],
        table_snapshots=[
            {
                "table_id": "Table 1",
                "profile": {
                    "is_three_line_table": True,
                    "header_depth": 1,
                    "has_stub_column": True,
                    "has_statistical_footnotes": False,
                    "has_unit_markers": False,
                },
                "header_cells": [],
                "data_cells": [
                    {
                        "id": "cell-n-1",
                        "text": "60",
                        "row_index": 0,
                        "column_index": 0,
                        "row_key": "n",
                        "column_key": "treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "n",
                            "column_key": "treatment group",
                        },
                    },
                    {
                        "id": "cell-n-2",
                        "text": "50",
                        "row_index": 0,
                        "column_index": 1,
                        "row_key": "n",
                        "column_key": "control group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "n",
                            "column_key": "control group",
                        },
                    },
                ],
                "footnote_items": [],
            }
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "medical_data_consistency.narrative_table_group_sum_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "120" in issue["explanation"]
    assert "110" in issue["explanation"]


def test_medical_specialized_detects_table_total_row_conflict_against_group_sum():
    report = run_medical_specialized(
        [
            {
                "text": "Results: baseline characteristics are shown in Table 1.",
                "style": "Normal",
            },
        ],
        table_snapshots=[
            {
                "table_id": "Table 1",
                "profile": {
                    "is_three_line_table": True,
                    "header_depth": 1,
                    "has_stub_column": True,
                    "has_statistical_footnotes": False,
                    "has_unit_markers": False,
                },
                "header_cells": [],
                "data_cells": [
                    {
                        "id": "cell-group-1",
                        "text": "60",
                        "row_index": 0,
                        "column_index": 0,
                        "row_key": "n",
                        "column_key": "treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "n",
                            "column_key": "treatment group",
                        },
                    },
                    {
                        "id": "cell-group-2",
                        "text": "50",
                        "row_index": 0,
                        "column_index": 1,
                        "row_key": "n",
                        "column_key": "control group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "n",
                            "column_key": "control group",
                        },
                    },
                    {
                        "id": "cell-total-1",
                        "text": "120",
                        "row_index": 1,
                        "column_index": 2,
                        "row_key": "total",
                        "column_key": "n",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "total",
                            "column_key": "n",
                        },
                    },
                ],
                "footnote_items": [],
            }
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "medical_data_consistency.table_group_total_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "120" in issue["explanation"]
    assert "110" in issue["explanation"]


def test_medical_specialized_detects_metric_unit_drift():
    report = run_medical_specialized(
        [
            {
                "text": "Methods: ALT was 35 U/L at baseline.",
                "style": "Normal",
            },
            {
                "text": "Results: ALT was 36 mmol/L after treatment.",
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "medical_norms_and_magnitude.metric_unit_drift"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_norms_and_magnitude"
    assert "ALT" in issue["explanation"]
    assert "U/L" in issue["explanation"]
    assert "mmol/L" in issue["explanation"]


def test_medical_specialized_detects_implausible_age_range():
    report = run_medical_specialized(
        [
            {
                "text": "Methods: participants were aged 18 to 180 years.",
                "style": "Normal",
            }
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "medical_norms_and_magnitude.age_range_anomaly"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_norms_and_magnitude"
    assert "18" in issue["explanation"]
    assert "180" in issue["explanation"]


def test_medical_specialized_detects_out_of_range_p_value():
    report = run_medical_specialized(
        [
            {
                "text": "Results: ALT improved significantly (P = 1.20).",
                "style": "Normal",
            }
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "statistical_expression.p_value_out_of_range"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "1.2" in issue["explanation"]


def test_medical_specialized_detects_inverted_confidence_interval():
    report = run_medical_specialized(
        [
            {
                "text": "Results: OR = 1.50 with 95% CI 2.10-1.20.",
                "style": "Normal",
            }
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "statistical_expression.confidence_interval_inversion"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "2.1" in issue["explanation"]
    assert "1.2" in issue["explanation"]


def test_medical_specialized_detects_auc_confidence_interval_conflict():
    report = run_medical_specialized(
        [
            {
                "text": "Results: AUC = 1.12 with 95% CI 0.91-1.05.",
                "style": "Normal",
            }
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "statistical_expression.auc_confidence_interval_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "AUC" in issue["explanation"]
    assert "1.12" in issue["explanation"]
    assert "1.05" in issue["explanation"]


def test_medical_specialized_recalculates_sensitivity_from_confusion_matrix():
    report = run_medical_specialized(
        [
            {
                "text": (
                    "Results: TP = 80, FN = 20, TN = 90, FP = 10; "
                    "sensitivity = 0.70 and specificity = 0.90."
                ),
                "style": "Normal",
            }
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "statistical_expression.diagnostic_metric_mismatch"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "sensitivity" in issue["explanation"].lower()
    assert "0.7" in issue["explanation"]
    assert "0.8" in issue["explanation"]


def test_medical_specialized_detects_beta_se_confidence_interval_conflict():
    report = run_medical_specialized(
        [
            {
                "text": "Results: beta = 0.50, SE = 0.10, 95% CI 0.10-0.30.",
                "style": "Normal",
            }
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "statistical_expression.regression_coefficient_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "beta" in issue["explanation"].lower()
    assert "SE" in issue["explanation"]
    assert "0.5" in issue["explanation"]


def test_medical_specialized_detects_chi_square_p_value_conflict():
    report = run_medical_specialized(
        [
            {
                "text": "Results: χ²(1) = 10.83, P = 0.10.",
                "style": "Normal",
            }
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "statistical_expression.test_statistic_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "chi-square" in issue["explanation"].lower()
    assert "10.83" in issue["explanation"]


def test_medical_specialized_recalculates_t_value_from_mean_sd_groups():
    report = run_medical_specialized(
        [
            {
                "text": (
                    "Results: Treatment group 10.0 +/- 2.0 (n=30), "
                    "Control group 8.0 +/- 2.5 (n=30), t(58) = 0.50, P = 0.001."
                ),
                "style": "Normal",
            }
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "statistical_expression.test_statistic_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "t value" in issue["explanation"].lower()
    assert "0.5" in issue["explanation"]


def test_medical_specialized_detects_f_value_p_value_conflict():
    report = run_medical_specialized(
        [
            {
                "text": "Results: F(2, 57) = 5.60, P = 0.40.",
                "style": "Normal",
            }
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "statistical_expression.test_statistic_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "F=5.6" in issue["explanation"]
    assert "0.40" in issue["explanation"] or "0.4" in issue["explanation"]


def test_medical_specialized_detects_out_of_range_table_p_value():
    report = run_medical_specialized(
        [
            {
                "text": "Results are summarized in Table 1.",
                "style": "Normal",
            }
        ],
        table_snapshots=[
            {
                "table_id": "Table 1",
                "profile": {
                    "is_three_line_table": True,
                    "header_depth": 1,
                    "has_stub_column": True,
                    "has_statistical_footnotes": False,
                    "has_unit_markers": False,
                },
                "header_cells": [],
                "data_cells": [
                    {
                        "id": "cell-p-oor",
                        "text": "1.20",
                        "row_index": 0,
                        "column_index": 1,
                        "row_key": "ALT",
                        "column_key": "P",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT",
                            "column_key": "P",
                        },
                    }
                ],
                "footnote_items": [],
            }
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "statistical_expression.table_p_value_out_of_range"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "1.2" in issue["explanation"]


def test_medical_specialized_detects_inverted_table_confidence_interval():
    report = run_medical_specialized(
        [
            {
                "text": "Results are summarized in Table 1.",
                "style": "Normal",
            }
        ],
        table_snapshots=[
            {
                "table_id": "Table 1",
                "profile": {
                    "is_three_line_table": True,
                    "header_depth": 1,
                    "has_stub_column": True,
                    "has_statistical_footnotes": False,
                    "has_unit_markers": False,
                },
                "header_cells": [],
                "data_cells": [
                    {
                        "id": "cell-ci-1",
                        "text": "2.10-1.20",
                        "row_index": 0,
                        "column_index": 1,
                        "row_key": "OR (95% CI)",
                        "column_key": "Treatment effect",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "OR (95% CI)",
                            "column_key": "Treatment effect",
                        },
                    }
                ],
                "footnote_items": [],
            }
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "statistical_expression.table_confidence_interval_inversion"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "2.1" in issue["explanation"]
    assert "1.2" in issue["explanation"]


def test_medical_specialized_detects_table_metric_unit_drift():
    report = run_medical_specialized(
        [
            {
                "text": "Results are summarized in Table 1.",
                "style": "Normal",
            }
        ],
        table_snapshots=[
            {
                "table_id": "Table 1",
                "profile": {
                    "is_three_line_table": True,
                    "header_depth": 1,
                    "has_stub_column": True,
                    "has_statistical_footnotes": False,
                    "has_unit_markers": True,
                },
                "header_cells": [],
                "data_cells": [
                    {
                        "id": "cell-unit-1",
                        "text": "35",
                        "row_index": 0,
                        "column_index": 0,
                        "row_key": "ALT (U/L)",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT (U/L)",
                            "column_key": "Treatment group",
                        },
                    },
                    {
                        "id": "cell-unit-2",
                        "text": "36",
                        "row_index": 1,
                        "column_index": 0,
                        "row_key": "ALT (mmol/L)",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT (mmol/L)",
                            "column_key": "Treatment group",
                        },
                    },
                ],
                "footnote_items": [],
            }
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "medical_norms_and_magnitude.table_metric_unit_drift"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_norms_and_magnitude"
    assert "ALT" in issue["explanation"]
    assert "U/L" in issue["explanation"]
    assert "mmol/L" in issue["explanation"]


def test_medical_specialized_detects_table_percent_out_of_range():
    report = run_medical_specialized(
        [
            {
                "text": "Results are summarized in Table 1.",
                "style": "Normal",
            }
        ],
        table_snapshots=[
            {
                "table_id": "Table 1",
                "profile": {
                    "is_three_line_table": True,
                    "header_depth": 1,
                    "has_stub_column": True,
                    "has_statistical_footnotes": False,
                    "has_unit_markers": True,
                },
                "header_cells": [],
                "data_cells": [
                    {
                        "id": "cell-percent-1",
                        "text": "120",
                        "row_index": 0,
                        "column_index": 0,
                        "row_key": "Response rate (%)",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "Response rate (%)",
                            "column_key": "Treatment group",
                        },
                    }
                ],
                "footnote_items": [],
            }
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "medical_norms_and_magnitude.table_percent_out_of_range"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_norms_and_magnitude"
    assert "120" in issue["explanation"]


def test_medical_specialized_detects_table_count_percent_mismatch():
    report = run_medical_specialized(
        [
            {
                "text": "Results are summarized in Table 1.",
                "style": "Normal",
            }
        ],
        table_snapshots=[
            {
                "table_id": "Table 1",
                "profile": {
                    "is_three_line_table": True,
                    "header_depth": 1,
                    "has_stub_column": True,
                    "has_statistical_footnotes": False,
                    "has_unit_markers": True,
                },
                "header_cells": [],
                "data_cells": [
                    {
                        "id": "cell-n-1",
                        "text": "60",
                        "row_index": 0,
                        "column_index": 0,
                        "row_key": "n",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "n",
                            "column_key": "Treatment group",
                        },
                    },
                    {
                        "id": "cell-count-percent-1",
                        "text": "30 (40.0)",
                        "row_index": 1,
                        "column_index": 0,
                        "row_key": "Responders [n(%)]",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "Responders [n(%)]",
                            "column_key": "Treatment group",
                        },
                    },
                ],
                "footnote_items": [],
            }
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "medical_calculation_and_parsing.table_count_percent_mismatch"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_calculation_and_parsing"
    assert "30" in issue["explanation"]
    assert "40" in issue["explanation"]
    assert "50" in issue["explanation"]


def test_medical_specialized_detects_table_pre_post_direction_divergence():
    report = run_medical_specialized(
        [
            {
                "text": "Results are summarized in Table 1.",
                "style": "Normal",
            }
        ],
        table_snapshots=[
            {
                "table_id": "Table 1",
                "profile": {
                    "is_three_line_table": True,
                    "header_depth": 1,
                    "has_stub_column": True,
                    "has_statistical_footnotes": False,
                    "has_unit_markers": False,
                },
                "header_cells": [],
                "data_cells": [
                    {
                        "id": "cell-dir-1",
                        "text": "50",
                        "row_index": 0,
                        "column_index": 0,
                        "row_key": "ALT before treatment",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT before treatment",
                            "column_key": "Treatment group",
                        },
                    },
                    {
                        "id": "cell-dir-2",
                        "text": "40",
                        "row_index": 1,
                        "column_index": 0,
                        "row_key": "ALT after treatment",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT after treatment",
                            "column_key": "Treatment group",
                        },
                    },
                    {
                        "id": "cell-dir-3",
                        "text": "48",
                        "row_index": 0,
                        "column_index": 1,
                        "row_key": "ALT before treatment",
                        "column_key": "Control group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT before treatment",
                            "column_key": "Control group",
                        },
                    },
                    {
                        "id": "cell-dir-4",
                        "text": "55",
                        "row_index": 1,
                        "column_index": 1,
                        "row_key": "ALT after treatment",
                        "column_key": "Control group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT after treatment",
                            "column_key": "Control group",
                        },
                    },
                ],
                "footnote_items": [],
            }
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "medical_logic.table_pre_post_direction_divergence"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_logic"
    assert "ALT" in issue["explanation"]
    assert "Treatment group" in issue["explanation"]
    assert "Control group" in issue["explanation"]


def test_medical_specialized_detects_narrative_table_direction_conflict():
    report = run_medical_specialized(
        [
            {
                "text": "Results: ALT decreased in the Treatment group according to Table 1.",
                "style": "Normal",
            }
        ],
        table_snapshots=[
            {
                "table_id": "Table 1",
                "profile": {
                    "is_three_line_table": True,
                    "header_depth": 1,
                    "has_stub_column": True,
                    "has_statistical_footnotes": False,
                    "has_unit_markers": False,
                },
                "header_cells": [],
                "data_cells": [
                    {
                        "id": "cell-ntd-1",
                        "text": "40",
                        "row_index": 0,
                        "column_index": 0,
                        "row_key": "ALT before treatment",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT before treatment",
                            "column_key": "Treatment group",
                        },
                    },
                    {
                        "id": "cell-ntd-2",
                        "text": "55",
                        "row_index": 1,
                        "column_index": 0,
                        "row_key": "ALT after treatment",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT after treatment",
                            "column_key": "Treatment group",
                        },
                    },
                ],
                "footnote_items": [],
            }
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "table_text_consistency.narrative_table_direction_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "table_text_consistency"
    assert "ALT" in issue["explanation"]
    assert "decreased" in issue["explanation"]
    assert "increase" in issue["explanation"]


def test_medical_specialized_detects_narrative_table_group_comparison_conflict():
    report = run_medical_specialized(
        [
            {
                "text": (
                    "Results: After treatment, ALT in the Treatment group was lower "
                    "than the Control group in Table 1."
                ),
                "style": "Normal",
            }
        ],
        table_snapshots=[
            {
                "table_id": "Table 1",
                "profile": {
                    "is_three_line_table": True,
                    "header_depth": 1,
                    "has_stub_column": True,
                    "has_statistical_footnotes": False,
                    "has_unit_markers": False,
                },
                "header_cells": [],
                "data_cells": [
                    {
                        "id": "cell-ntc-1",
                        "text": "60",
                        "row_index": 0,
                        "column_index": 0,
                        "row_key": "ALT after treatment",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT after treatment",
                            "column_key": "Treatment group",
                        },
                    },
                    {
                        "id": "cell-ntc-2",
                        "text": "50",
                        "row_index": 0,
                        "column_index": 1,
                        "row_key": "ALT after treatment",
                        "column_key": "Control group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT after treatment",
                            "column_key": "Control group",
                        },
                    },
                ],
                "footnote_items": [],
            }
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "table_text_consistency.narrative_table_group_comparison_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "table_text_consistency"
    assert "Treatment group" in issue["explanation"]
    assert "Control group" in issue["explanation"]
    assert "lower" in issue["explanation"]


def test_medical_specialized_detects_narrative_table_group_count_percent_comparison_conflict():
    report = run_medical_specialized(
        [
            {
                "text": (
                    "Results: Adverse events in the Treatment group were lower than the "
                    "Control group in Table 1."
                ),
                "style": "Normal",
            }
        ],
        table_snapshots=[
            {
                "table_id": "Table 1",
                "profile": {
                    "is_three_line_table": True,
                    "header_depth": 1,
                    "has_stub_column": True,
                    "has_statistical_footnotes": False,
                    "has_unit_markers": False,
                },
                "header_cells": [],
                "data_cells": [
                    {
                        "id": "cell-ntcp-0",
                        "text": "60",
                        "row_index": 0,
                        "column_index": 0,
                        "row_key": "n",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "n",
                            "column_key": "Treatment group",
                        },
                    },
                    {
                        "id": "cell-ntcp-1",
                        "text": "40",
                        "row_index": 0,
                        "column_index": 1,
                        "row_key": "n",
                        "column_key": "Control group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "n",
                            "column_key": "Control group",
                        },
                    },
                    {
                        "id": "cell-ntcp-2",
                        "text": "30 (50%)",
                        "row_index": 1,
                        "column_index": 0,
                        "row_key": "Adverse events [n(%)]",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "Adverse events [n(%)]",
                            "column_key": "Treatment group",
                        },
                    },
                    {
                        "id": "cell-ntcp-3",
                        "text": "10 (25%)",
                        "row_index": 1,
                        "column_index": 1,
                        "row_key": "Adverse events [n(%)]",
                        "column_key": "Control group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "Adverse events [n(%)]",
                            "column_key": "Control group",
                        },
                    },
                ],
                "footnote_items": [],
            }
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "table_text_consistency.narrative_table_group_count_percent_comparison_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "table_text_consistency"
    assert "Treatment group" in issue["explanation"]
    assert "Control group" in issue["explanation"]
    assert "50%" in issue["explanation"]
    assert "25%" in issue["explanation"]


def test_medical_specialized_detects_cross_section_direction_conflict():
    report = run_medical_specialized(
        [
            {
                "text": "Abstract: ALT decreased after treatment.",
                "style": "Normal",
            },
            {
                "text": "Results: ALT increased after treatment.",
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "medical_logic.cross_section_direction_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_logic"
    assert "ALT" in issue["explanation"]
    assert "Abstract" in issue["explanation"]
    assert "Results" in issue["explanation"]


def test_medical_specialized_detects_cross_section_group_comparison_conflict():
    report = run_medical_specialized(
        [
            {
                "text": (
                    "Abstract: After treatment, ALT in the Treatment group was lower "
                    "than the Control group."
                ),
                "style": "Normal",
            },
            {
                "text": (
                    "Results: After treatment, ALT in the Treatment group was higher "
                    "than the Control group."
                ),
                "style": "Normal",
            },
        ]
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "medical_logic.cross_section_group_comparison_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_logic"
    assert "ALT" in issue["explanation"]
    assert "Treatment group" in issue["explanation"]
    assert "Control group" in issue["explanation"]
    assert "Abstract" in issue["explanation"]
    assert "Results" in issue["explanation"]


def test_medical_specialized_uses_governed_group_comparison_templates():
    report = run_medical_specialized(
        [
            {
                "text": (
                    "Abstract: After treatment, ALT in the Observation group was lower "
                    "than the Comparison group."
                ),
                "style": "Normal",
            },
            {
                "text": (
                    "Results: After treatment, ALT in the Observation group was higher "
                    "than the Comparison group."
                ),
                "style": "Normal",
            },
        ],
        quality_packages=[
            build_medical_package_record(
                manifest_overrides={
                    "comparison_templates": {
                        "pre_post": ["before treatment|after treatment"],
                        "group_comparison": [
                            "observation group|comparison group"
                        ],
                    }
                }
            )
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "medical_logic.cross_section_group_comparison_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_logic"
    assert "ALT" in issue["explanation"]
    assert "Observation group" in issue["explanation"]
    assert "Comparison group" in issue["explanation"]


def test_medical_specialized_respects_governed_toggle_for_table_text_consistency():
    report = run_medical_specialized(
        [
            {
                "text": "Results: ALT decreased in the Treatment group according to Table 1.",
                "style": "Normal",
            }
        ],
        table_snapshots=[
            {
                "table_id": "Table 1",
                "profile": {
                    "is_three_line_table": True,
                    "header_depth": 1,
                    "has_stub_column": True,
                    "has_statistical_footnotes": False,
                    "has_unit_markers": False,
                },
                "header_cells": [],
                "data_cells": [
                    {
                        "id": "cell-governed-1",
                        "text": "40",
                        "row_index": 0,
                        "column_index": 0,
                        "row_key": "ALT before treatment",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT before treatment",
                            "column_key": "Treatment group",
                        },
                    },
                    {
                        "id": "cell-governed-2",
                        "text": "55",
                        "row_index": 1,
                        "column_index": 0,
                        "row_key": "ALT after treatment",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT after treatment",
                            "column_key": "Treatment group",
                        },
                    },
                ],
                "footnote_items": [],
            }
        ],
        quality_packages=[
            {
                "package_id": "quality-package-medical-1",
                "package_name": "Medical Analyzer Default",
                "package_kind": "medical_analyzer_package",
                "target_scopes": ["medical_specialized"],
                "version": 1,
                "manifest": {
                    "indicator_dictionary": {
                        "ALT": {
                            "aliases": ["alanine aminotransferase", "谷丙转氨酶"],
                            "default_unit": "U/L",
                        }
                    },
                    "unit_ranges": {
                        "ALT": [
                            {
                                "unit": "U/L",
                                "min": 0,
                                "max": 1000,
                            }
                        ]
                    },
                    "comparison_templates": {
                        "pre_post": ["before treatment|after treatment"],
                        "group_comparison": ["treatment group|control group"],
                    },
                    "count_constraints": {
                        "percent": {
                            "max_percent": 100,
                        }
                    },
                    "issue_policy": {
                        "table_text_direction_conflict": {
                            "severity": "high",
                            "action": "manual_review",
                        }
                    },
                    "analyzer_toggles": {
                        "table_text_consistency": False,
                        "numeric_consistency": True,
                        "medical_logic": True,
                    },
                },
            }
        ],
    )

    assert not any(
        issue["category"] == "table_text_consistency" for issue in report["issues"]
    )


def test_medical_specialized_applies_governed_policy_to_unit_range_conflict():
    report = run_medical_specialized(
        [
            {
                "text": "Results: ALT was 55 U/L after treatment.",
                "style": "Normal",
            }
        ],
        quality_packages=[
            build_medical_package_record(
                manifest_overrides={
                    "unit_ranges": {
                        "ALT": [
                            {
                                "unit": "U/L",
                                "min": 0,
                                "max": 40,
                            }
                        ]
                    },
                    "issue_policy": {
                        "unit_range_conflict": {
                            "severity": "medium",
                            "action": "suggest_fix",
                        }
                    },
                }
            )
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "medical_norms_and_magnitude.unit_range_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "suggest_fix"
    assert issue["severity"] == "medium"
    assert issue["category"] == "medical_norms_and_magnitude"
    assert "ALT" in issue["explanation"]
    assert "55" in issue["explanation"]
    assert "40" in issue["explanation"]


def test_medical_specialized_applies_governed_policy_to_table_text_direction_conflict():
    report = run_medical_specialized(
        [
            {
                "text": "Results: ALT decreased in the Treatment group according to Table 1.",
                "style": "Normal",
            }
        ],
        table_snapshots=[
            {
                "table_id": "Table 1",
                "profile": {
                    "is_three_line_table": True,
                    "header_depth": 1,
                    "has_stub_column": True,
                    "has_statistical_footnotes": False,
                    "has_unit_markers": False,
                },
                "header_cells": [],
                "data_cells": [
                    {
                        "id": "cell-governed-policy-1",
                        "text": "40",
                        "row_index": 0,
                        "column_index": 0,
                        "row_key": "ALT before treatment",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT before treatment",
                            "column_key": "Treatment group",
                        },
                    },
                    {
                        "id": "cell-governed-policy-2",
                        "text": "55",
                        "row_index": 1,
                        "column_index": 0,
                        "row_key": "ALT after treatment",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT after treatment",
                            "column_key": "Treatment group",
                        },
                    },
                ],
                "footnote_items": [],
            }
        ],
        quality_packages=[
            build_medical_package_record(
                manifest_overrides={
                    "issue_policy": {
                        "table_text_direction_conflict": {
                            "severity": "medium",
                            "action": "suggest_fix",
                        }
                    }
                }
            )
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "table_text_consistency.narrative_table_direction_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "suggest_fix"
    assert issue["severity"] == "medium"
    assert issue["category"] == "table_text_consistency"


def test_medical_specialized_uses_governed_pre_post_templates_for_table_narrative_checks():
    report = run_medical_specialized(
        [
            {
                "text": (
                    "Results: Post-intervention, ALT in the Treatment group was lower "
                    "than the Control group according to Table 1."
                ),
                "style": "Normal",
            }
        ],
        table_snapshots=[
            {
                "table_id": "Table 1",
                "profile": {
                    "is_three_line_table": True,
                    "header_depth": 1,
                    "has_stub_column": True,
                    "has_statistical_footnotes": False,
                    "has_unit_markers": False,
                },
                "header_cells": [],
                "data_cells": [
                    {
                        "id": "cell-pre-post-1",
                        "text": "40",
                        "row_index": 0,
                        "column_index": 0,
                        "row_key": "ALT pre-intervention",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT pre-intervention",
                            "column_key": "Treatment group",
                        },
                    },
                    {
                        "id": "cell-pre-post-2",
                        "text": "55",
                        "row_index": 1,
                        "column_index": 0,
                        "row_key": "ALT post-intervention",
                        "column_key": "Treatment group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT post-intervention",
                            "column_key": "Treatment group",
                        },
                    },
                    {
                        "id": "cell-pre-post-3",
                        "text": "42",
                        "row_index": 0,
                        "column_index": 1,
                        "row_key": "ALT pre-intervention",
                        "column_key": "Control group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT pre-intervention",
                            "column_key": "Control group",
                        },
                    },
                    {
                        "id": "cell-pre-post-4",
                        "text": "40",
                        "row_index": 1,
                        "column_index": 1,
                        "row_key": "ALT post-intervention",
                        "column_key": "Control group",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT post-intervention",
                            "column_key": "Control group",
                        },
                    },
                ],
                "footnote_items": [],
            }
        ],
        quality_packages=[
            build_medical_package_record(
                manifest_overrides={
                    "comparison_templates": {
                        "pre_post": ["pre-intervention|post-intervention"],
                        "group_comparison": ["treatment group|control group"],
                    }
                }
            )
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"]
        == "table_text_consistency.narrative_table_group_comparison_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "table_text_consistency"
    assert "ALT" in issue["explanation"]
    assert "Treatment group=55" in issue["explanation"]
    assert "Control group=40" in issue["explanation"]


def test_medical_specialized_applies_governed_policy_to_significance_mismatch():
    report = run_medical_specialized(
        [
            {
                "text": (
                    "Results: p = 0.07, yet the manuscript claims a statistically "
                    "significant improvement."
                ),
                "style": "Normal",
            }
        ],
        quality_packages=[
            build_medical_package_record(
                manifest_overrides={
                    "issue_policy": {
                        "significance_claim_conflict": {
                            "severity": "medium",
                            "action": "suggest_fix",
                        }
                    }
                }
            )
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "statistical_expression.significance_mismatch"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "suggest_fix"
    assert issue["severity"] == "medium"
    assert issue["category"] == "medical_calculation_and_parsing"


def test_medical_specialized_respects_governed_percent_max_for_narrative_percentages():
    report = run_medical_specialized(
        [
            {
                "text": "Results: the adverse event rate was 85% after treatment.",
                "style": "Normal",
            }
        ],
        quality_packages=[
            build_medical_package_record(
                manifest_overrides={
                    "count_constraints": {
                        "percent": {
                            "max_percent": 80,
                        }
                    }
                }
            )
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "medical_data_consistency.percent_out_of_range"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "manual_review"
    assert issue["category"] == "medical_norms_and_magnitude"
    assert "85" in issue["explanation"]
    assert "80" in issue["explanation"]


def test_medical_specialized_applies_governed_policy_to_table_p_value_conflicts():
    report = run_medical_specialized(
        [
            {
                "text": "Results: ALT showed no statistically significant difference in Table 1 (P > 0.05).",
                "style": "Normal",
            },
        ],
        table_snapshots=[
            {
                "table_id": "Table 1",
                "profile": {
                    "is_three_line_table": True,
                    "header_depth": 1,
                    "has_stub_column": True,
                    "has_statistical_footnotes": False,
                    "has_unit_markers": False,
                },
                "header_cells": [],
                "data_cells": [
                    {
                        "id": "cell-gov-table-p-1",
                        "text": "0.03",
                        "row_index": 0,
                        "column_index": 1,
                        "row_key": "ALT",
                        "column_key": "P",
                        "coordinate": {
                            "table_id": "Table 1",
                            "target": "data_cell",
                            "row_key": "ALT",
                            "column_key": "P",
                        },
                    },
                ],
                "footnote_items": [],
            }
        ],
        quality_packages=[
            build_medical_package_record(
                manifest_overrides={
                    "issue_policy": {
                        "significance_claim_conflict": {
                            "severity": "medium",
                            "action": "suggest_fix",
                        }
                    }
                }
            )
        ],
    )

    issue = next(
        issue
        for issue in report["issues"]
        if issue["issue_type"] == "statistical_expression.table_p_value_conflict"
    )

    assert issue["module_scope"] == "medical_specialized"
    assert issue["action"] == "suggest_fix"
    assert issue["severity"] == "medium"
    assert issue["category"] == "table_text_consistency"
