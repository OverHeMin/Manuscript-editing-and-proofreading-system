import json
from pathlib import Path

from src.document_enhancement.artifacts import write_audit_artifact
from src.document_enhancement.contracts import (
    AcademicStructureAdvisoryResult,
    AdapterStatus,
    DocumentEnhancementAuditReport,
    PrivacyAdvisoryResult,
)
from src.document_enhancement.retention import evaluate_retention_audit
from src.document_enhancement.retention_cli import main


def test_retention_audit_degrades_when_index_is_missing(tmp_path):
    result = evaluate_retention_audit(output_dir=tmp_path)

    assert result.status == "degraded"
    assert result.candidates == []
    assert "No local audit index" in result.notes[0]


def test_retention_audit_marks_entries_outside_keep_window_for_cleanup_review(tmp_path):
    write_audit_artifact(
        build_report("fixtures/older.pdf"),
        output_dir=tmp_path,
        created_at="2026-04-01T10:00:00Z",
    )
    write_audit_artifact(
        build_report("fixtures/latest.pdf"),
        output_dir=tmp_path,
        created_at="2026-04-05T10:00:00Z",
    )

    result = evaluate_retention_audit(output_dir=tmp_path, keep_last=1)

    assert result.status == "ready"
    assert result.cleanup_review_count == 1
    assert result.candidates[0].document_path == "fixtures/latest.pdf"
    assert result.candidates[0].recommendation == "keep"
    assert result.candidates[1].document_path == "fixtures/older.pdf"
    assert result.candidates[1].recommendation == "review_for_cleanup"


def test_retention_audit_marks_older_entries_when_max_age_days_is_exceeded(tmp_path):
    write_audit_artifact(
        build_report("fixtures/old.pdf"),
        output_dir=tmp_path,
        created_at="2026-04-01T10:00:00Z",
    )

    result = evaluate_retention_audit(
        output_dir=tmp_path,
        keep_last=5,
        max_age_days=1,
        reference_time="2026-04-05T10:00:00Z",
    )

    assert result.status == "ready"
    assert result.cleanup_review_count == 1
    assert "older than 1 days" in result.candidates[0].reason


def test_retention_audit_surfaces_missing_artifact_files_as_advisory_reasons(tmp_path):
    written = write_audit_artifact(
        build_report("fixtures/missing.pdf"),
        output_dir=tmp_path,
        created_at="2026-04-01T10:00:00Z",
    )
    assert written.artifact_path is not None
    written.artifact_path.unlink()

    result = evaluate_retention_audit(
        output_dir=tmp_path,
        keep_last=0,
        reference_time="2026-04-05T10:00:00Z",
    )

    assert result.status == "ready"
    assert "artifact file is already missing" in result.candidates[0].reason


def test_retention_cli_emits_structured_json(tmp_path, capsys):
    write_audit_artifact(
        build_report("fixtures/sample.pdf"),
        output_dir=tmp_path,
        created_at="2026-04-01T10:00:00Z",
    )
    write_audit_artifact(
        build_report("fixtures/latest.pdf"),
        output_dir=tmp_path,
        created_at="2026-04-05T10:00:00Z",
    )

    main(["--output-dir", str(tmp_path), "--keep-last", "1"])

    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "ready"
    assert payload["cleanup_review_count"] == 1
    assert payload["candidates"][0]["document_path"] == "fixtures/latest.pdf"


def build_report(document_path: str) -> DocumentEnhancementAuditReport:
    return DocumentEnhancementAuditReport(
        document_path=document_path,
        privacy=PrivacyAdvisoryResult(
            status="degraded",
            findings=[],
            notes=["privacy note"],
            adapters=[AdapterStatus(name="presidio_analyzer", status="not_configured")],
        ),
        academic_structure=AcademicStructureAdvisoryResult(
            status="degraded",
            document_kind="pdf",
            recommended_path=["ocrmypdf_local", "grobid_local"],
            notes=["academic note"],
            adapters=[AdapterStatus(name="grobid_local", status="not_configured")],
        ),
        artifact=None,
        notes=["top-level note"],
    )
