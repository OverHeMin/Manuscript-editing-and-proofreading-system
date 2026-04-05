import json
from dataclasses import replace
from pathlib import Path

from .artifacts import (
    build_artifact_file_name,
    default_audit_output_dir,
    serialize_jsonable,
    utc_now_isoformat,
)
from .contracts import CleanupPlanAction, CleanupPlanResult
from .retention import evaluate_retention_audit


DEFAULT_PLAN_DIR_NAME = "plans"


def build_cleanup_plan(
    output_dir: Path | None = None,
    keep_last: int = 20,
    max_age_days: int | None = None,
    write_plan: bool = False,
    plan_output_dir: Path | None = None,
    reference_time: str | None = None,
    generated_at: str | None = None,
) -> CleanupPlanResult:
    retention_result = evaluate_retention_audit(
        output_dir=output_dir,
        keep_last=keep_last,
        max_age_days=max_age_days,
        reference_time=reference_time,
    )
    actions = [build_cleanup_action(candidate) for candidate in retention_result.candidates]
    planned_action_count = sum(1 for action in actions if action.action != "keep")

    result = CleanupPlanResult(
        status=retention_result.status,
        output_dir=retention_result.output_dir,
        index_path=retention_result.index_path,
        plan_path=None,
        evaluated_item_count=len(actions),
        planned_action_count=planned_action_count,
        actions=actions,
        notes=list(retention_result.notes),
    )

    if not write_plan:
        return result

    target_plan_dir = plan_output_dir or default_cleanup_plan_output_dir(output_dir)
    timestamp = generated_at or utc_now_isoformat()
    plan_file_name = build_artifact_file_name("cleanup-plan.json", timestamp)
    plan_path = target_plan_dir / plan_file_name

    try:
        target_plan_dir.mkdir(parents=True, exist_ok=True)
        manifest_payload = serialize_jsonable(replace(result, plan_path=plan_path))
        plan_path.write_text(json.dumps(manifest_payload, indent=2), encoding="utf-8")
    except OSError as exc:
        return replace(
            result,
            status="degraded",
            notes=[
                *result.notes,
                (
                    "Unable to persist local cleanup plan manifest: "
                    f"{exc}. Cleanup plan remains available on stdout."
                ),
            ],
        )

    return replace(
        result,
        plan_path=plan_path,
        notes=[*result.notes, "Cleanup plan manifest persisted locally."],
    )


def default_cleanup_plan_output_dir(output_dir: Path | None = None) -> Path:
    base_output_dir = output_dir or default_audit_output_dir()
    return base_output_dir / DEFAULT_PLAN_DIR_NAME


def build_cleanup_action(candidate) -> CleanupPlanAction:
    if "artifact file is already missing locally" in candidate.reason:
        return CleanupPlanAction(
            created_at=candidate.created_at,
            document_path=candidate.document_path,
            artifact_path=candidate.artifact_path,
            age_days=candidate.age_days,
            action="index_repair_review",
            reason=candidate.reason,
            manual_steps=[
                "Review whether this missing local artifact should be removed from audit-index.json during a future manual maintenance pass.",
                "Do not auto-delete or rewrite any local evidence from this command.",
            ],
        )

    if candidate.recommendation == "review_for_cleanup":
        return CleanupPlanAction(
            created_at=candidate.created_at,
            document_path=candidate.document_path,
            artifact_path=candidate.artifact_path,
            age_days=candidate.age_days,
            action="archive_then_cleanup_review",
            reason=candidate.reason,
            manual_steps=[
                "Review whether this local artifact should be archived before any manual cleanup.",
                "If the artifact is no longer needed, perform deletion and index maintenance manually outside this advisory command.",
            ],
        )

    return CleanupPlanAction(
        created_at=candidate.created_at,
        document_path=candidate.document_path,
        artifact_path=candidate.artifact_path,
        age_days=candidate.age_days,
        action="keep",
        reason=candidate.reason,
        manual_steps=["Keep this local artifact available for now."],
    )
