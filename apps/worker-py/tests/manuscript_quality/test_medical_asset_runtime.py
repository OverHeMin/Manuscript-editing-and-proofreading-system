from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from manuscript_quality.medical_asset_runtime import (
    load_medical_assets,
    resolve_comparison_template_pairs,
    resolve_count_constraint,
    resolve_group_comparison_groups,
    resolve_indicator_definition,
    resolve_indicator_unit_ranges,
    resolve_issue_policy,
)


def build_medical_package_record(
    default_unit: str = "U/L",
    max_value: int = 1000,
    percent_max: int = 100,
    issue_policy: dict | None = None,
):
    return {
        "package_id": "quality-package-medical-1",
        "package_name": "Medical Analyzer Default",
        "package_kind": "medical_analyzer_package",
        "target_scopes": ["medical_specialized"],
        "version": 1,
        "manifest": {
            "indicator_dictionary": {
                "ALT": {
                    "aliases": ["alanine aminotransferase", "谷丙转氨酶"],
                    "default_unit": default_unit,
                }
            },
            "unit_ranges": {
                "ALT": [
                    {
                        "unit": default_unit,
                        "min": 0,
                        "max": max_value,
                    }
                ]
            },
            "comparison_templates": {
                "pre_post": ["before treatment|after treatment"],
                "group_comparison": ["treatment group|control group"],
            },
            "count_constraints": {
                "percent": {
                    "max_percent": percent_max,
                }
            },
            "issue_policy": issue_policy
            or {
                "table_text_direction_conflict": {
                    "severity": "high",
                    "action": "manual_review",
                }
            },
            "analyzer_toggles": {
                "table_text_consistency": True,
                "numeric_consistency": True,
                "medical_logic": True,
            },
        },
    }


def test_medical_asset_runtime_loads_default_assets_for_current_baseline():
    assets = load_medical_assets(None)

    assert resolve_indicator_definition("ALT", assets)["default_unit"] == "U/L"
    assert assets["analyzer_toggles"]["table_text_consistency"] is True


def test_medical_asset_runtime_prefers_bound_medical_package_assets():
    assets = load_medical_assets([build_medical_package_record(default_unit="IU/L")])

    assert resolve_indicator_definition("ALT", assets)["default_unit"] == "IU/L"
    assert assets["comparison_templates"]["pre_post"][0] == "before treatment|after treatment"


def test_medical_asset_runtime_resolves_alias_ranges_and_issue_policy():
    assets = load_medical_assets(
        [
            build_medical_package_record(
                default_unit="IU/L",
                max_value=40,
                issue_policy={
                    "unit_range_conflict": {
                        "severity": "medium",
                        "action": "suggest_fix",
                    }
                },
            )
        ]
    )

    unit_ranges = resolve_indicator_unit_ranges("alanine aminotransferase", assets)
    policy = resolve_issue_policy("unit_range_conflict", assets)

    assert unit_ranges[0]["unit"] == "IU/L"
    assert unit_ranges[0]["max"] == 40
    assert policy == {
        "severity": "medium",
        "action": "suggest_fix",
    }


def test_medical_asset_runtime_resolves_governed_count_constraints():
    assets = load_medical_assets(
        [
            build_medical_package_record(
                percent_max=80,
            )
        ]
    )

    count_constraint = resolve_count_constraint("percent", assets)

    assert count_constraint == {
        "max_percent": 80,
    }


def test_medical_asset_runtime_resolves_governed_comparison_template_pairs():
    assets = load_medical_assets(
        [
            build_medical_package_record(
                issue_policy={
                    "table_text_direction_conflict": {
                        "severity": "high",
                        "action": "manual_review",
                    }
                }
            )
        ]
    )

    pairs = resolve_comparison_template_pairs("pre_post", assets)
    groups = resolve_group_comparison_groups(assets)

    assert ("before treatment", "after treatment") in pairs
    assert groups == ["treatment group", "control group"]


def test_medical_asset_runtime_prefers_custom_comparison_templates():
    custom_package = build_medical_package_record()
    custom_package["manifest"]["comparison_templates"] = {
        "pre_post": ["pre-intervention|post-intervention"],
        "group_comparison": ["observation group|comparison group"],
    }

    assets = load_medical_assets([custom_package])

    assert resolve_comparison_template_pairs("pre_post", assets) == [
        ("pre-intervention", "post-intervention")
    ]
    assert resolve_group_comparison_groups(assets) == [
        "observation group",
        "comparison group",
    ]
