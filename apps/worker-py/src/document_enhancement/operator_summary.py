import json
from dataclasses import replace
from pathlib import Path

from .artifacts import (
    INDEX_FILE_NAME,
    build_artifact_file_name,
    default_audit_output_dir,
    read_index,
    serialize_jsonable,
    utc_now_isoformat,
)
from .contracts import OperatorSummaryResult
from .history import list_audit_history
from .repair_handoff import build_repair_handoff
from .retention import evaluate_retention_audit


DEFAULT_SUMMARY_DIR_NAME = "operator-summaries"


def build_operator_summary(
    output_dir: Path | None = None,
    keep_last: int = 20,
    max_age_days: int | None = None,
    history_limit: int = 5,
    attention_limit: int = 5,
    write_summary: bool = False,
    summary_output_dir: Path | None = None,
    reference_time: str | None = None,
    generated_at: str | None = None,
) -> OperatorSummaryResult:
    target_dir = output_dir or default_audit_output_dir()
    index_path = target_dir / INDEX_FILE_NAME

    history_result = list_audit_history(output_dir=target_dir, limit=history_limit)
    retention_result = evaluate_retention_audit(
        output_dir=target_dir,
        keep_last=keep_last,
        max_age_days=max_age_days,
        reference_time=reference_time,
    )
    repair_result = build_repair_handoff(
        output_dir=target_dir,
        keep_last=keep_last,
        max_age_days=max_age_days,
        write_handoff=False,
        reference_time=reference_time,
    )

    raw_items = read_index(index_path)["items"] if index_path.exists() else []
    indexed_artifact_count = sum(1 for item in raw_items if isinstance(item, dict))
    attention_items = repair_result.items[: max(attention_limit, 0)]
    notes = merge_unique_texts(
        [*history_result.notes, *retention_result.notes, *repair_result.notes]
    )
    next_steps = build_next_steps(
        indexed_artifact_count=indexed_artifact_count,
        retention_review_count=retention_result.cleanup_review_count,
        attention_item_count=repair_result.actionable_item_count,
    )
    status = (
        "degraded"
        if "degraded"
        in {history_result.status, retention_result.status, repair_result.status}
        else "ready"
    )

    result = OperatorSummaryResult(
        status=status,
        output_dir=target_dir,
        index_path=index_path,
        summary_path=None,
        indexed_artifact_count=indexed_artifact_count,
        recent_history=history_result.items,
        privacy_status_counts=count_statuses(raw_items, "privacy_status"),
        academic_structure_status_counts=count_statuses(
            raw_items, "academic_structure_status"
        ),
        retention_review_count=retention_result.cleanup_review_count,
        cleanup_action_count=repair_result.cleanup_action_count,
        consistency_issue_count=repair_result.consistency_issue_count,
        attention_item_count=repair_result.actionable_item_count,
        attention_items=attention_items,
        next_steps=next_steps,
        notes=notes,
    )

    if not write_summary:
        return result

    target_summary_dir = summary_output_dir or default_operator_summary_output_dir(
        output_dir
    )
    timestamp = generated_at or utc_now_isoformat()
    summary_file_name = build_artifact_file_name("operator-summary.json", timestamp)
    summary_path = target_summary_dir / summary_file_name

    try:
        target_summary_dir.mkdir(parents=True, exist_ok=True)
        payload = serialize_jsonable(replace(result, summary_path=summary_path))
        summary_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except OSError as exc:
        return replace(
            result,
            status="degraded",
            notes=[
                *result.notes,
                (
                    "Unable to persist local operator summary snapshot: "
                    f"{exc}. Summary remains available on stdout."
                ),
            ],
        )

    return replace(
        result,
        summary_path=summary_path,
        notes=[*result.notes, "Operator summary snapshot persisted locally."],
    )


def default_operator_summary_output_dir(output_dir: Path | None = None) -> Path:
    base_output_dir = output_dir or default_audit_output_dir()
    return base_output_dir / DEFAULT_SUMMARY_DIR_NAME


def count_statuses(raw_items, field_name: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        status = str(item.get(field_name, "")).strip() or "unknown"
        counts[status] = counts.get(status, 0) + 1

    return dict(sorted(counts.items()))


def build_next_steps(
    indexed_artifact_count: int,
    retention_review_count: int,
    attention_item_count: int,
) -> list[str]:
    if indexed_artifact_count == 0:
        return [
            "Run the advisory audit with --write-artifact to create a local evidence baseline."
        ]

    next_steps: list[str] = []
    if attention_item_count > 0:
        next_steps.append(
            "Review the bounded repair attention items before any manual cleanup or index edits."
        )
    if retention_review_count > 0:
        next_steps.append(
            "Use the cleanup-plan or repair-handoff outputs to stage archive-before-cleanup review for older local artifacts."
        )
    next_steps.append(
        "Replay a recent artifact from local history when you need the full advisory evidence for one document."
    )

    return next_steps[:3]


def merge_unique_texts(values: list[str]) -> list[str]:
    merged: list[str] = []
    for value in values:
        if not value or value in merged:
            continue
        merged.append(value)
    return merged
