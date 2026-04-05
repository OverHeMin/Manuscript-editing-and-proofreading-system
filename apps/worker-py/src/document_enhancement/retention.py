from datetime import datetime, timezone
from pathlib import Path

from .artifacts import INDEX_FILE_NAME, default_audit_output_dir, read_index
from .contracts import RetentionAuditResult, RetentionCandidate


def evaluate_retention_audit(
    output_dir: Path | None = None,
    keep_last: int = 20,
    max_age_days: int | None = None,
    reference_time: str | None = None,
) -> RetentionAuditResult:
    target_dir = output_dir or default_audit_output_dir()
    index_path = target_dir / INDEX_FILE_NAME

    if not index_path.exists():
        return RetentionAuditResult(
            status="degraded",
            output_dir=target_dir,
            index_path=index_path,
            evaluated_item_count=0,
            keep_count=0,
            cleanup_review_count=0,
            candidates=[],
            notes=[
                "No local audit index is present yet. Run the advisory audit with --write-artifact to create one."
            ],
        )

    now = parse_iso_timestamp(reference_time) if reference_time else datetime.now(timezone.utc)
    payload = read_index(index_path)
    raw_items = payload["items"]
    candidates: list[RetentionCandidate] = []

    for index, item in enumerate(raw_items):
        if not isinstance(item, dict):
            continue

        created_at = str(item.get("created_at", ""))
        document_path = str(item.get("document_path", ""))
        artifact_path = str(item.get("artifact_path", ""))
        age_days = calculate_age_days(created_at, now)

        recommendation = "keep"
        reasons: list[str] = []

        if index >= max(keep_last, 0):
            recommendation = "review_for_cleanup"
            reasons.append(f"outside keep-last window ({keep_last})")

        if max_age_days is not None and age_days is not None and age_days > max_age_days:
            recommendation = "review_for_cleanup"
            reasons.append(f"older than {max_age_days} days")

        if artifact_path and not Path(artifact_path).exists():
            recommendation = "review_for_cleanup"
            reasons.append("artifact file is already missing locally")

        if not reasons:
            reasons.append("within current retention guardrails")

        candidates.append(
            RetentionCandidate(
                created_at=created_at,
                document_path=document_path,
                artifact_path=artifact_path,
                age_days=age_days,
                recommendation=recommendation,
                reason="; ".join(reasons),
            )
        )

    keep_count = sum(1 for candidate in candidates if candidate.recommendation == "keep")
    cleanup_review_count = sum(
        1 for candidate in candidates if candidate.recommendation == "review_for_cleanup"
    )

    return RetentionAuditResult(
        status="ready",
        output_dir=target_dir,
        index_path=index_path,
        evaluated_item_count=len(candidates),
        keep_count=keep_count,
        cleanup_review_count=cleanup_review_count,
        candidates=candidates,
        notes=["Retention audit is local-first, advisory-only, and non-destructive."],
    )


def calculate_age_days(created_at: str, now: datetime) -> int | None:
    try:
        created = parse_iso_timestamp(created_at)
    except ValueError:
        return None

    return max((now - created).days, 0)


def parse_iso_timestamp(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)
