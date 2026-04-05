from pathlib import Path

from .artifacts import INDEX_FILE_NAME, default_audit_output_dir, read_index
from .contracts import IndexConsistencyAuditResult, IndexConsistencyIssue


HELPER_DIRECTORY_NAMES = {"plans", "repair-handoffs", "operator-summaries"}


def evaluate_index_consistency(
    output_dir: Path | None = None,
) -> IndexConsistencyAuditResult:
    target_dir = output_dir or default_audit_output_dir()
    index_path = target_dir / INDEX_FILE_NAME

    if not index_path.exists():
        return IndexConsistencyAuditResult(
            status="degraded",
            output_dir=target_dir,
            index_path=index_path,
            evaluated_entry_count=0,
            issue_count=0,
            issues=[],
            notes=[
                "No local audit index is present yet. Run the advisory audit with --write-artifact to create one."
            ],
        )

    payload = read_index(index_path)
    raw_items = payload["items"]
    issues: list[IndexConsistencyIssue] = []
    seen_artifact_paths: dict[str, int] = {}
    indexed_artifact_paths: set[str] = set()

    for index_position, item in enumerate(raw_items):
        if not is_valid_index_entry(item):
            issues.append(
                IndexConsistencyIssue(
                    issue_type="invalid_index_entry",
                    artifact_path=None,
                    index_position=index_position,
                    detail="Index entry is missing the required artifact_path field.",
                    recommended_action="review_and_rebuild_entry_manually",
                )
            )
            continue

        artifact_path = str(item["artifact_path"])
        indexed_artifact_paths.add(artifact_path)

        if artifact_path in seen_artifact_paths:
            issues.append(
                IndexConsistencyIssue(
                    issue_type="duplicate_index_entry",
                    artifact_path=artifact_path,
                    index_position=index_position,
                    detail=(
                        "Index entry references an artifact path that already appeared earlier "
                        f"in the index at position {seen_artifact_paths[artifact_path]}."
                    ),
                    recommended_action="review_duplicates_before_manual_index_repair",
                )
            )
        else:
            seen_artifact_paths[artifact_path] = index_position

        if not Path(artifact_path).exists():
            issues.append(
                IndexConsistencyIssue(
                    issue_type="missing_artifact",
                    artifact_path=artifact_path,
                    index_position=index_position,
                    detail="Indexed artifact file is missing locally and may need index repair review.",
                    recommended_action="review_missing_artifact_before_manual_index_repair",
                )
            )

    issues.extend(find_orphan_artifact_issues(target_dir, indexed_artifact_paths))

    return IndexConsistencyAuditResult(
        status="ready",
        output_dir=target_dir,
        index_path=index_path,
        evaluated_entry_count=len(raw_items),
        issue_count=len(issues),
        issues=issues,
        notes=["Index consistency audit is local-first, read-only, and non-destructive."],
    )


def is_valid_index_entry(item) -> bool:
    return isinstance(item, dict) and bool(str(item.get("artifact_path", "")).strip())


def find_orphan_artifact_issues(
    output_dir: Path,
    indexed_artifact_paths: set[str],
) -> list[IndexConsistencyIssue]:
    if not output_dir.exists():
        return []

    issues: list[IndexConsistencyIssue] = []
    for artifact_path in output_dir.rglob("*.json"):
        if artifact_path.name == INDEX_FILE_NAME:
            continue

        relative_parts = artifact_path.relative_to(output_dir).parts[:-1]
        if any(part in HELPER_DIRECTORY_NAMES for part in relative_parts):
            continue

        artifact_path_text = str(artifact_path)
        if artifact_path_text in indexed_artifact_paths:
            continue

        issues.append(
            IndexConsistencyIssue(
                issue_type="orphan_artifact",
                artifact_path=artifact_path_text,
                index_position=None,
                detail="Local artifact JSON is present on disk but not referenced by audit-index.json.",
                recommended_action="review_whether_to_reindex_archive_or_delete_manually",
            )
        )

    return issues
