from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from manuscript_quality.adapter_registry import AdapterRegistry, ADVISORY_ACTION_MAP, build_adapter_registry
from manuscript_quality.contracts import (
    GENERAL_PROOFREADING_SCOPE,
    MEDICAL_SPECIALIZED_SCOPE,
    QualityPackageRecord,
)
from manuscript_quality.general_proofreading import run_general_proofreading
from manuscript_quality.medical_specialized import run_medical_specialized


ALLOWED_SEVERITIES = {"low", "medium", "high", "critical"}
ALLOWED_CATEGORIES = {
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
}


def run_quality_checks(
    blocks: list[dict],
    *,
    scope: str = GENERAL_PROOFREADING_SCOPE,
    table_snapshots: list[dict] | None = None,
    quality_packages: list[QualityPackageRecord] | None = None,
    registry: AdapterRegistry | None = None,
) -> dict:
    if scope == MEDICAL_SPECIALIZED_SCOPE:
        return run_medical_specialized(
            blocks,
            table_snapshots=table_snapshots,
            quality_packages=quality_packages,
        )

    report = run_general_proofreading(blocks, quality_packages=quality_packages)
    adapter_registry = registry or build_adapter_registry()
    adapter_issues: list[dict] = []

    for adapter in adapter_registry.enabled_adapters():
        raw_issues = adapter.runner(
            {
                "blocks": [dict(block) for block in blocks],
                "general_report": report,
            }
        )
        for raw_issue in raw_issues:
            normalized_issue = normalize_adapter_issue(adapter.adapter_id, raw_issue)
            if normalized_issue is not None:
                adapter_issues.append(normalized_issue)

    return {
        **report,
        "issues": [*report["issues"], *adapter_issues],
        "adapters": adapter_registry.list_adapters(),
    }


def normalize_adapter_issue(adapter_id: str, raw_issue: dict) -> dict | None:
    if not isinstance(raw_issue, dict):
        return None

    issue_type = raw_issue.get("issue_type")
    if not isinstance(issue_type, str) or not issue_type:
        return None

    text_excerpt = raw_issue.get("text_excerpt")
    if not isinstance(text_excerpt, str) or not text_excerpt:
        text_excerpt = adapter_id

    explanation = raw_issue.get("explanation")
    if not isinstance(explanation, str) or not explanation:
        explanation = f"External adapter {adapter_id} produced an advisory candidate."

    raw_action = raw_issue.get("action")
    action = ADVISORY_ACTION_MAP.get(
        raw_action if isinstance(raw_action, str) else "suggest_fix",
        "suggest_fix",
    )

    raw_severity = raw_issue.get("severity")
    severity = (
        raw_severity
        if isinstance(raw_severity, str) and raw_severity in ALLOWED_SEVERITIES
        else "medium"
    )
    raw_category = raw_issue.get("category")
    category = (
        raw_category
        if isinstance(raw_category, str) and raw_category in ALLOWED_CATEGORIES
        else "sentence_and_logic"
    )
    raw_confidence = raw_issue.get("confidence")
    confidence = raw_confidence if isinstance(raw_confidence, (int, float)) else 0.5
    normalized_confidence = min(max(float(confidence), 0.0), 1.0)

    identity = f"{adapter_id}|{issue_type}|{text_excerpt}"
    issue = {
        "issue_id": hashlib.sha1(identity.encode("utf-8")).hexdigest()[:12],
        "module_scope": GENERAL_PROOFREADING_SCOPE,
        "issue_type": issue_type,
        "category": category,
        "severity": severity,
        "action": action,
        "confidence": normalized_confidence,
        "source_kind": "third_party_adapter",
        "source_id": f"third_party/{adapter_id}",
        "text_excerpt": text_excerpt,
        "explanation": explanation,
    }

    normalized_excerpt = raw_issue.get("normalized_excerpt")
    if isinstance(normalized_excerpt, str):
        issue["normalized_excerpt"] = normalized_excerpt

    suggested_replacement = raw_issue.get("suggested_replacement")
    if isinstance(suggested_replacement, str):
        issue["suggested_replacement"] = suggested_replacement

    paragraph_index = raw_issue.get("paragraph_index")
    if isinstance(paragraph_index, int):
        issue["paragraph_index"] = paragraph_index

    sentence_index = raw_issue.get("sentence_index")
    if isinstance(sentence_index, int):
        issue["sentence_index"] = sentence_index

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

    raw_scope = payload.get("scope")
    scope = (
        raw_scope
        if isinstance(raw_scope, str) and raw_scope in {GENERAL_PROOFREADING_SCOPE, MEDICAL_SPECIALIZED_SCOPE}
        else GENERAL_PROOFREADING_SCOPE
    )
    raw_table_snapshots = payload.get("tableSnapshots")
    table_snapshots = raw_table_snapshots if isinstance(raw_table_snapshots, list) else None
    raw_quality_packages = payload.get("quality_packages")
    quality_packages = raw_quality_packages if isinstance(raw_quality_packages, list) else None
    result = run_quality_checks(
        payload["blocks"],
        scope=scope,
        table_snapshots=table_snapshots,
        quality_packages=quality_packages,
    )
    sys.stdout.write(json.dumps(result, ensure_ascii=False))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
