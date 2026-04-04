import json
from pathlib import Path

from src.document_enhancement.artifacts import (
    default_audit_output_dir,
    write_audit_artifact,
)
from src.document_enhancement.contracts import (
    AcademicStructureAdvisoryResult,
    AdapterStatus,
    DocumentEnhancementAuditReport,
    PrivacyAdvisoryResult,
)


def test_default_audit_output_dir_points_at_repo_local_data_manual_directory():
    output_dir = default_audit_output_dir()

    assert output_dir.as_posix().endswith(".local-data/document-enhancement-audits/manual")


def test_write_audit_artifact_persists_json_and_updates_newest_first_index(tmp_path):
    first = write_audit_artifact(
        build_report("fixtures/first.pdf", privacy_status="advisory_only"),
        output_dir=tmp_path,
        created_at="2026-04-05T10:00:00Z",
    )
    second = write_audit_artifact(
        build_report("fixtures/second.pdf", privacy_status="needs_review"),
        output_dir=tmp_path,
        created_at="2026-04-05T11:00:00Z",
    )

    assert first.status == "written"
    assert second.status == "written"
    assert second.index_path is not None
    assert second.index_path.name == "audit-index.json"

    artifact_payload = json.loads(Path(second.artifact_path).read_text(encoding="utf-8"))
    assert artifact_payload["document_path"] == "fixtures/second.pdf"

    index_payload = json.loads(second.index_path.read_text(encoding="utf-8"))
    assert [entry["document_path"] for entry in index_payload["items"]] == [
        "fixtures/second.pdf",
        "fixtures/first.pdf",
    ]


def test_write_audit_artifact_degrades_when_output_path_cannot_be_written(tmp_path):
    blocked_path = tmp_path / "blocked"
    blocked_path.write_text("occupied", encoding="utf-8")

    result = write_audit_artifact(
        build_report("fixtures/failure.pdf"),
        output_dir=blocked_path,
        created_at="2026-04-05T12:00:00Z",
    )

    assert result.status == "degraded"
    assert result.artifact_path is None
    assert "Unable to persist" in result.notes[0]


def build_report(
    document_path: str,
    privacy_status: str = "degraded",
    academic_status: str = "degraded",
) -> DocumentEnhancementAuditReport:
    return DocumentEnhancementAuditReport(
        document_path=document_path,
        privacy=PrivacyAdvisoryResult(
            status=privacy_status,
            findings=[],
            notes=["privacy note"],
            adapters=[AdapterStatus(name="presidio_analyzer", status="not_configured")],
        ),
        academic_structure=AcademicStructureAdvisoryResult(
            status=academic_status,
            document_kind="pdf",
            recommended_path=["ocrmypdf_local", "grobid_local"],
            notes=["academic note"],
            adapters=[AdapterStatus(name="grobid_local", status="not_configured")],
        ),
        artifact=None,
        notes=["top-level note"],
    )
