from __future__ import annotations

from typing import Any


DEFAULT_MEDICAL_ASSETS = {
    "indicator_dictionary": {
        "ALT": {
            "aliases": ["alanine aminotransferase", "谷丙转氨酶"],
            "default_unit": "U/L",
        },
        "AST": {
            "aliases": ["aspartate aminotransferase", "谷草转氨酶"],
            "default_unit": "U/L",
        },
    },
    "unit_ranges": {
        "ALT": [{"unit": "U/L", "min": 0, "max": 1000}],
        "percent": [{"unit": "%", "min": 0, "max": 100}],
    },
    "comparison_templates": {
        "pre_post": ["before treatment|after treatment", "baseline|follow-up"],
        "group_comparison": ["treatment group|control group"],
    },
    "count_constraints": {
        "percent": {"max_percent": 100},
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
    },
    "analyzer_toggles": {
        "table_text_consistency": True,
        "numeric_consistency": True,
        "medical_logic": True,
    },
}


def load_medical_assets(quality_packages: list[dict] | None) -> dict[str, Any]:
    selected = select_medical_analyzer_package(quality_packages)
    if selected is None:
        return _clone_assets(DEFAULT_MEDICAL_ASSETS)

    manifest = selected.get("manifest")
    if not isinstance(manifest, dict):
        return _clone_assets(DEFAULT_MEDICAL_ASSETS)

    assets = _clone_assets(DEFAULT_MEDICAL_ASSETS)
    for key in (
        "indicator_dictionary",
        "unit_ranges",
        "comparison_templates",
        "count_constraints",
        "issue_policy",
        "analyzer_toggles",
    ):
        value = manifest.get(key)
        if isinstance(value, dict):
            assets[key] = _clone_assets(value)

    return assets


def select_medical_analyzer_package(
    quality_packages: list[dict] | None,
) -> dict[str, Any] | None:
    if not quality_packages:
        return None

    for quality_package in quality_packages:
        if quality_package.get("package_kind") != "medical_analyzer_package":
            continue

        manifest = quality_package.get("manifest")
        if isinstance(manifest, dict) and _is_structured_medical_manifest(manifest):
            return quality_package

    return None


def resolve_indicator_definition(metric_key: str, assets: dict[str, Any]) -> dict[str, Any]:
    indicator_dictionary = assets.get("indicator_dictionary", {})
    if not isinstance(indicator_dictionary, dict):
        return {}

    indicator_key = resolve_indicator_key(metric_key, assets)
    if indicator_key is None:
        return {}

    definition = indicator_dictionary.get(indicator_key)
    return definition if isinstance(definition, dict) else {}


def resolve_indicator_key(metric_key: str, assets: dict[str, Any]) -> str | None:
    indicator_dictionary = assets.get("indicator_dictionary", {})
    if not isinstance(indicator_dictionary, dict) or not isinstance(metric_key, str):
        return None

    direct = indicator_dictionary.get(metric_key)
    if isinstance(direct, dict):
        return metric_key

    lowered_key = metric_key.lower()
    for indicator_name, definition in indicator_dictionary.items():
        if not isinstance(indicator_name, str) or not isinstance(definition, dict):
            continue

        if indicator_name.lower() == lowered_key:
            return indicator_name

        aliases = definition.get("aliases")
        if isinstance(aliases, list) and any(
            isinstance(alias, str) and alias.lower() == lowered_key for alias in aliases
        ):
            return indicator_name

    return None


def resolve_indicator_unit_ranges(metric_key: str, assets: dict[str, Any]) -> list[dict[str, Any]]:
    unit_ranges = assets.get("unit_ranges", {})
    if not isinstance(unit_ranges, dict):
        return []

    direct_ranges = unit_ranges.get(metric_key)
    if isinstance(direct_ranges, list):
        return [entry for entry in direct_ranges if isinstance(entry, dict)]

    indicator_key = resolve_indicator_key(metric_key, assets)
    if indicator_key is None:
        return []

    ranges = unit_ranges.get(indicator_key)
    if not isinstance(ranges, list):
        return []

    return [entry for entry in ranges if isinstance(entry, dict)]


def resolve_count_constraint(constraint_key: str, assets: dict[str, Any]) -> dict[str, Any]:
    count_constraints = assets.get("count_constraints", {})
    if not isinstance(count_constraints, dict):
        return {}

    constraint = count_constraints.get(constraint_key)
    return constraint if isinstance(constraint, dict) else {}


def resolve_comparison_template_pairs(
    template_key: str,
    assets: dict[str, Any],
) -> list[tuple[str, str]]:
    comparison_templates = assets.get("comparison_templates", {})
    if not isinstance(comparison_templates, dict):
        comparison_templates = {}

    pairs = _parse_template_pairs(comparison_templates.get(template_key))
    if pairs:
        return pairs

    default_templates = DEFAULT_MEDICAL_ASSETS.get("comparison_templates", {})
    if not isinstance(default_templates, dict):
        return []

    return _parse_template_pairs(default_templates.get(template_key))


def resolve_group_comparison_groups(assets: dict[str, Any]) -> list[str]:
    groups: list[str] = []
    seen: set[str] = set()

    for left_group, right_group in resolve_comparison_template_pairs(
        "group_comparison",
        assets,
    ):
        for group in (left_group, right_group):
            normalized_group = _normalize_template_token(group)
            if not normalized_group or normalized_group in seen:
                continue

            seen.add(normalized_group)
            groups.append(normalized_group)

    return groups


def resolve_issue_policy(issue_key: str, assets: dict[str, Any]) -> dict[str, str]:
    issue_policy = assets.get("issue_policy", {})
    if not isinstance(issue_policy, dict):
        return {"severity": "high", "action": "manual_review"}

    policy = issue_policy.get(issue_key)
    if isinstance(policy, dict):
        severity = policy.get("severity")
        action = policy.get("action")
        if isinstance(severity, str) and isinstance(action, str):
            return {
                "severity": severity,
                "action": action,
            }

    return {"severity": "high", "action": "manual_review"}


def is_analyzer_enabled(toggle_key: str, assets: dict[str, Any]) -> bool:
    toggles = assets.get("analyzer_toggles", {})
    if not isinstance(toggles, dict):
        return True

    value = toggles.get(toggle_key)
    return True if not isinstance(value, bool) else value


def _is_structured_medical_manifest(manifest: dict[str, Any]) -> bool:
    return all(
        key in manifest
        for key in (
            "indicator_dictionary",
            "unit_ranges",
            "comparison_templates",
            "count_constraints",
            "issue_policy",
            "analyzer_toggles",
        )
    )


def _clone_assets(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _clone_assets(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_clone_assets(item) for item in value]
    return value


def _parse_template_pairs(value: Any) -> list[tuple[str, str]]:
    if not isinstance(value, list):
        return []

    pairs: list[tuple[str, str]] = []
    for item in value:
        if not isinstance(item, str):
            continue

        left_raw, separator, right_raw = item.partition("|")
        if not separator:
            continue

        left = _normalize_template_token(left_raw)
        right = _normalize_template_token(right_raw)
        if not left or not right:
            continue

        pairs.append((left, right))

    return pairs


def _normalize_template_token(value: str) -> str:
    return " ".join(value.strip().split()).lower()
