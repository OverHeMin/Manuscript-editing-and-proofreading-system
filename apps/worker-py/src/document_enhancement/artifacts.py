import json
import re
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from .contracts import ArtifactWriteResult, DocumentEnhancementAuditReport


REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_OUTPUT_DIR = REPO_ROOT / ".local-data" / "document-enhancement-audits" / "manual"
INDEX_FILE_NAME = "audit-index.json"


def default_audit_output_dir() -> Path:
    return DEFAULT_OUTPUT_DIR


def skipped_artifact_result(output_dir: Path | None = None) -> ArtifactWriteResult:
    return ArtifactWriteResult(
        status="skipped",
        output_dir=output_dir,
        artifact_path=None,
        index_path=None,
        notes=["Artifact persistence was not requested."],
    )


def write_audit_artifact(
    report: DocumentEnhancementAuditReport,
    output_dir: Path | None = None,
    created_at: str | None = None,
) -> ArtifactWriteResult:
    target_dir = output_dir or default_audit_output_dir()
    timestamp = created_at or utc_now_isoformat()
    artifact_name = build_artifact_file_name(report.document_path, timestamp)
    artifact_path = target_dir / artifact_name
    index_path = target_dir / INDEX_FILE_NAME

    try:
        target_dir.mkdir(parents=True, exist_ok=True)
        artifact_payload = serialize_jsonable(report)
        artifact_payload["artifact"] = {
            "status": "written",
            "output_dir": str(target_dir),
            "artifact_path": str(artifact_path),
            "index_path": str(index_path),
            "notes": ["Artifact persisted locally."],
        }
        artifact_path.write_text(
            json.dumps(artifact_payload, indent=2),
            encoding="utf-8",
        )

        index_payload = read_index(index_path)
        entry = {
            "created_at": timestamp,
            "document_path": report.document_path,
            "artifact_file": artifact_path.name,
            "artifact_path": str(artifact_path),
            "privacy_status": report.privacy.status,
            "academic_structure_status": report.academic_structure.status,
        }
        items = [entry, *index_payload["items"]]
        index_path.write_text(
            json.dumps({"items": items}, indent=2),
            encoding="utf-8",
        )
    except OSError as exc:
        return ArtifactWriteResult(
            status="degraded",
            output_dir=target_dir,
            artifact_path=None,
            index_path=None,
            notes=[
                f"Unable to persist local audit artifacts: {exc}. Advisory report remains available on stdout."
            ],
        )

    return ArtifactWriteResult(
        status="written",
        output_dir=target_dir,
        artifact_path=artifact_path,
        index_path=index_path,
        notes=["Artifact persisted locally."],
    )


def read_index(index_path: Path) -> dict[str, list[dict[str, str]]]:
    if not index_path.exists():
        return {"items": []}

    try:
        payload = json.loads(index_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"items": []}

    items = payload.get("items")
    if isinstance(items, list):
        return {"items": items}

    return {"items": []}


def build_artifact_file_name(document_path: str, created_at: str) -> str:
    stem = Path(document_path).stem or "document"
    safe_stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-") or "document"
    compact_timestamp = (
        created_at.replace("-", "")
        .replace(":", "")
        .replace("+00:00", "Z")
        .replace("T", "-")
    )
    return f"{compact_timestamp}-{safe_stem}.json"


def utc_now_isoformat() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def serialize_jsonable(value):
    if isinstance(value, Path):
        return str(value)

    if isinstance(value, dict):
        return {key: serialize_jsonable(item) for key, item in value.items()}

    if isinstance(value, list):
        return [serialize_jsonable(item) for item in value]

    if isinstance(value, tuple):
        return [serialize_jsonable(item) for item in value]

    if hasattr(value, "__dataclass_fields__"):
        return serialize_jsonable(asdict(value))

    return value
