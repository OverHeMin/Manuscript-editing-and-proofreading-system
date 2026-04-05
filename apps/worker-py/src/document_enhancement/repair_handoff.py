import json
from dataclasses import replace
from pathlib import Path

from .artifacts import (
    build_artifact_file_name,
    default_audit_output_dir,
    serialize_jsonable,
    utc_now_isoformat,
)
from .cleanup_plan import build_cleanup_plan
from .contracts import RepairHandoffItem, RepairHandoffResult
from .index_consistency import evaluate_index_consistency


DEFAULT_HANDOFF_DIR_NAME = "repair-handoffs"
HANDOFF_PRIORITY = {
    "index_repair_review": 0,
    "orphan_artifact_review": 1,
    "archive_then_cleanup_review": 2,
}


def build_repair_handoff(
    output_dir: Path | None = None,
    keep_last: int = 20,
    max_age_days: int | None = None,
    write_handoff: bool = False,
    handoff_output_dir: Path | None = None,
    reference_time: str | None = None,
    generated_at: str | None = None,
) -> RepairHandoffResult:
    cleanup_result = build_cleanup_plan(
        output_dir=output_dir,
        keep_last=keep_last,
        max_age_days=max_age_days,
        write_plan=False,
        reference_time=reference_time,
    )
    consistency_result = evaluate_index_consistency(output_dir=output_dir)

    item_map: dict[str, RepairHandoffItem] = {}
    for action in cleanup_result.actions:
        if action.action == "keep":
            continue
        item = RepairHandoffItem(
            handoff_type=action.action,
            sources=["cleanup_plan"],
            document_path=action.document_path or None,
            artifact_path=action.artifact_path or None,
            summary=action.reason,
            manual_steps=list(action.manual_steps),
        )
        merge_handoff_item(item_map, build_item_key(item, fallback="cleanup"), item)

    for issue in consistency_result.issues:
        item = build_handoff_item_from_issue(issue)
        merge_handoff_item(item_map, build_item_key(item, fallback=f"issue:{issue.index_position}"), item)

    items = sorted(
        item_map.values(),
        key=lambda item: (
            HANDOFF_PRIORITY.get(item.handoff_type, 99),
            item.artifact_path or "",
            item.document_path or "",
            item.summary,
        ),
    )

    notes = merge_unique_texts([*cleanup_result.notes, *consistency_result.notes])
    status = "degraded" if "degraded" in {cleanup_result.status, consistency_result.status} else "ready"

    result = RepairHandoffResult(
        status=status,
        output_dir=cleanup_result.output_dir or consistency_result.output_dir,
        index_path=cleanup_result.index_path or consistency_result.index_path,
        handoff_path=None,
        cleanup_action_count=cleanup_result.planned_action_count,
        consistency_issue_count=consistency_result.issue_count,
        actionable_item_count=len(items),
        items=items,
        notes=notes,
    )

    if not write_handoff:
        return result

    target_handoff_dir = handoff_output_dir or default_repair_handoff_output_dir(output_dir)
    timestamp = generated_at or utc_now_isoformat()
    handoff_file_name = build_artifact_file_name("repair-handoff.json", timestamp)
    handoff_path = target_handoff_dir / handoff_file_name

    try:
        target_handoff_dir.mkdir(parents=True, exist_ok=True)
        payload = serialize_jsonable(replace(result, handoff_path=handoff_path))
        handoff_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except OSError as exc:
        return replace(
            result,
            status="degraded",
            notes=[
                *result.notes,
                (
                    "Unable to persist local repair handoff manifest: "
                    f"{exc}. Repair handoff remains available on stdout."
                ),
            ],
        )

    return replace(
        result,
        handoff_path=handoff_path,
        notes=[*result.notes, "Repair handoff manifest persisted locally."],
    )


def default_repair_handoff_output_dir(output_dir: Path | None = None) -> Path:
    base_output_dir = output_dir or default_audit_output_dir()
    return base_output_dir / DEFAULT_HANDOFF_DIR_NAME


def build_handoff_item_from_issue(issue) -> RepairHandoffItem:
    if issue.issue_type == "orphan_artifact":
        return RepairHandoffItem(
            handoff_type="orphan_artifact_review",
            sources=["index_consistency"],
            document_path=None,
            artifact_path=issue.artifact_path,
            summary=issue.detail,
            manual_steps=[
                "Review whether this orphan local artifact should be indexed, archived, or deleted during a future manual maintenance pass.",
                "Do not auto-modify local evidence from this advisory command.",
            ],
        )

    return RepairHandoffItem(
        handoff_type="index_repair_review",
        sources=["index_consistency"],
        document_path=None,
        artifact_path=issue.artifact_path,
        summary=issue.detail,
        manual_steps=[
            "Review whether audit-index.json needs a manual repair pass for this local target.",
            "Do not auto-delete or rewrite local metadata from this advisory command.",
        ],
    )


def build_item_key(item: RepairHandoffItem, fallback: str) -> str:
    if item.artifact_path:
        return f"artifact:{item.artifact_path}"
    if item.document_path:
        return f"document:{item.document_path}:{item.handoff_type}"
    return fallback


def merge_handoff_item(
    item_map: dict[str, RepairHandoffItem],
    key: str,
    item: RepairHandoffItem,
) -> None:
    existing = item_map.get(key)
    if existing is None:
        item_map[key] = item
        return

    handoff_type = choose_handoff_type(existing.handoff_type, item.handoff_type)
    sources = merge_unique_texts([*existing.sources, *item.sources])
    summary_parts = merge_unique_texts([existing.summary, item.summary])
    manual_steps = merge_unique_texts([*existing.manual_steps, *item.manual_steps])
    item_map[key] = RepairHandoffItem(
        handoff_type=handoff_type,
        sources=sources,
        document_path=existing.document_path or item.document_path,
        artifact_path=existing.artifact_path or item.artifact_path,
        summary="; ".join(summary_parts),
        manual_steps=manual_steps,
    )


def choose_handoff_type(left: str, right: str) -> str:
    if HANDOFF_PRIORITY.get(left, 99) <= HANDOFF_PRIORITY.get(right, 99):
        return left
    return right


def merge_unique_texts(values: list[str]) -> list[str]:
    merged: list[str] = []
    for value in values:
        if not value or value in merged:
            continue
        merged.append(value)
    return merged
