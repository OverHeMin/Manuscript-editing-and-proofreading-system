import json
from pathlib import Path

from .artifacts import INDEX_FILE_NAME, default_audit_output_dir, read_index
from .contracts import (
    AuditHistoryEntry,
    AuditHistoryListingResult,
    AuditReplayResult,
)


def list_audit_history(
    output_dir: Path | None = None,
    limit: int = 10,
) -> AuditHistoryListingResult:
    target_dir = output_dir or default_audit_output_dir()
    index_path = target_dir / INDEX_FILE_NAME

    if not index_path.exists():
        return AuditHistoryListingResult(
            status="degraded",
            output_dir=target_dir,
            index_path=index_path,
            items=[],
            notes=[
                "No local audit index is present yet. Run the advisory audit with --write-artifact to create one."
            ],
        )

    payload = read_index(index_path)
    raw_items = payload["items"]
    bounded_items = raw_items[: max(limit, 0)]
    items = [
        AuditHistoryEntry(
            created_at=str(item.get("created_at", "")),
            document_path=str(item.get("document_path", "")),
            artifact_file=str(item.get("artifact_file", "")),
            artifact_path=str(item.get("artifact_path", "")),
            privacy_status=str(item.get("privacy_status", "")),
            academic_structure_status=str(item.get("academic_structure_status", "")),
        )
        for item in bounded_items
        if isinstance(item, dict)
    ]

    return AuditHistoryListingResult(
        status="ready",
        output_dir=target_dir,
        index_path=index_path,
        items=items,
        notes=["History listing is local-first and read-only."],
    )


def replay_audit_artifact(artifact_path: Path | None) -> AuditReplayResult:
    if artifact_path is None or not artifact_path.exists():
        return AuditReplayResult(
            status="degraded",
            artifact_path=artifact_path,
            report=None,
            notes=[
                f"Artifact file {artifact_path} is missing or unavailable for replay."
            ],
        )

    try:
        payload = json.loads(artifact_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return AuditReplayResult(
            status="degraded",
            artifact_path=artifact_path,
            report=None,
            notes=[f"Artifact replay failed for {artifact_path}: {exc}"],
        )

    return AuditReplayResult(
        status="ready",
        artifact_path=artifact_path,
        report=payload,
        notes=["Artifact replay loaded from the local filesystem."],
    )
