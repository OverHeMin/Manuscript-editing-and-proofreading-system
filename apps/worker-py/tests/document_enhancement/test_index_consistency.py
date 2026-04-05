import json
from pathlib import Path

from src.document_enhancement.artifacts import INDEX_FILE_NAME, write_audit_artifact
from src.document_enhancement.contracts import (
    AcademicStructureAdvisoryResult,
    AdapterStatus,
    DocumentEnhancementAuditReport,
    PrivacyAdvisoryResult,
)
from src.document_enhancement.index_consistency import evaluate_index_consistency
from src.document_enhancement.index_consistency_cli import main


def test_index_consistency_degrades_when_index_is_missing(tmp_path):
    result = evaluate_index_consistency(output_dir=tmp_path)

    assert result.status == "degraded"
    assert result.issue_count == 0
    assert result.issues == []
    assert "No local audit index" in result.notes[0]


def test_index_consistency_reports_missing_artifact_issue(tmp_path):
    written = write_audit_artifact(
        build_report("fixtures/missing.pdf"),
        output_dir=tmp_path,
        created_at="2026-04-05T10:00:00Z",
    )
    assert written.artifact_path is not None
    written.artifact_path.unlink()

    result = evaluate_index_consistency(output_dir=tmp_path)

    assert result.status == "ready"
    assert result.issue_count == 1
    assert result.issues[0].issue_type == "missing_artifact"
    assert "missing locally" in result.issues[0].detail


def test_index_consistency_reports_duplicate_index_entries(tmp_path):
    written = write_audit_artifact(
        build_report("fixtures/sample.pdf"),
        output_dir=tmp_path,
        created_at="2026-04-05T10:00:00Z",
    )
    assert written.index_path is not None
    payload = json.loads(written.index_path.read_text(encoding="utf-8"))
    payload["items"].append(dict(payload["items"][0]))
    written.index_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    result = evaluate_index_consistency(output_dir=tmp_path)

    assert result.status == "ready"
    assert result.issue_count == 1
    assert result.issues[0].issue_type == "duplicate_index_entry"


def test_index_consistency_reports_invalid_index_entries(tmp_path):
    index_path = tmp_path / INDEX_FILE_NAME
    tmp_path.mkdir(parents=True, exist_ok=True)
    index_path.write_text(
        json.dumps(
            {
                "items": [
                    {
                        "created_at": "2026-04-05T10:00:00Z",
                        "document_path": "fixtures/sample.pdf",
                    }
                ]
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    result = evaluate_index_consistency(output_dir=tmp_path)

    assert result.status == "ready"
    assert result.issue_count == 1
    assert result.issues[0].issue_type == "invalid_index_entry"
    assert result.issues[0].index_position == 0


def test_index_consistency_reports_orphan_artifacts_and_skips_helper_paths(tmp_path):
    write_audit_artifact(
        build_report("fixtures/indexed.pdf"),
        output_dir=tmp_path,
        created_at="2026-04-05T10:00:00Z",
    )

    orphan_path = tmp_path / "20260405-110000Z-orphan.json"
    orphan_path.write_text(json.dumps({"status": "ready"}, indent=2), encoding="utf-8")

    helper_dir = tmp_path / "plans"
    helper_dir.mkdir()
    (helper_dir / "20260405-111500Z-cleanup-plan.json").write_text(
        json.dumps({"status": "ready"}, indent=2),
        encoding="utf-8",
    )

    result = evaluate_index_consistency(output_dir=tmp_path)

    assert result.status == "ready"
    assert result.issue_count == 1
    assert result.issues[0].issue_type == "orphan_artifact"
    assert result.issues[0].artifact_path == str(orphan_path)


def test_index_consistency_cli_emits_structured_json(tmp_path, capsys):
    written = write_audit_artifact(
        build_report("fixtures/missing.pdf"),
        output_dir=tmp_path,
        created_at="2026-04-05T10:00:00Z",
    )
    assert written.artifact_path is not None
    written.artifact_path.unlink()

    main(["--output-dir", str(tmp_path)])

    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "ready"
    assert payload["issue_count"] == 1
    assert payload["issues"][0]["issue_type"] == "missing_artifact"


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
