import json
from pathlib import Path

from src.document_enhancement.artifacts import write_audit_artifact
from src.document_enhancement.contracts import (
    AcademicStructureAdvisoryResult,
    AdapterStatus,
    DocumentEnhancementAuditReport,
    PrivacyAdvisoryResult,
)
from src.document_enhancement.history import (
    list_audit_history,
    replay_audit_artifact,
)
from src.document_enhancement.history_cli import main


def test_list_audit_history_returns_newest_first_entries_and_respects_limit(tmp_path):
    write_audit_artifact(
        build_report("fixtures/older.pdf", privacy_status="advisory_only"),
        output_dir=tmp_path,
        created_at="2026-04-05T10:00:00Z",
    )
    write_audit_artifact(
        build_report("fixtures/latest.pdf", privacy_status="needs_review"),
        output_dir=tmp_path,
        created_at="2026-04-05T11:00:00Z",
    )

    result = list_audit_history(output_dir=tmp_path, limit=1)

    assert result.status == "ready"
    assert len(result.items) == 1
    assert result.items[0].document_path == "fixtures/latest.pdf"


def test_list_audit_history_degrades_when_index_is_missing(tmp_path):
    result = list_audit_history(output_dir=tmp_path)

    assert result.status == "degraded"
    assert result.items == []
    assert "No local audit index" in result.notes[0]


def test_replay_audit_artifact_degrades_when_artifact_is_missing(tmp_path):
    result = replay_audit_artifact(tmp_path / "missing.json")

    assert result.status == "degraded"
    assert result.report is None
    assert "Artifact file" in result.notes[0]


def test_replay_audit_artifact_returns_the_stored_advisory_report(tmp_path):
    written = write_audit_artifact(
        build_report("fixtures/replay.pdf", privacy_status="needs_review"),
        output_dir=tmp_path,
        created_at="2026-04-05T12:00:00Z",
    )

    result = replay_audit_artifact(written.artifact_path)

    assert result.status == "ready"
    assert result.report is not None
    assert result.report["document_path"] == "fixtures/replay.pdf"
    assert result.report["privacy"]["status"] == "needs_review"


def test_history_cli_lists_local_artifacts_as_json(tmp_path, capsys):
    write_audit_artifact(
        build_report("fixtures/latest.pdf", privacy_status="needs_review"),
        output_dir=tmp_path,
        created_at="2026-04-05T11:00:00Z",
    )

    main(["--list", "--output-dir", str(tmp_path), "--limit", "5"])

    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "ready"
    assert payload["items"][0]["document_path"] == "fixtures/latest.pdf"


def test_history_cli_replays_one_artifact_as_json(tmp_path, capsys):
    written = write_audit_artifact(
        build_report("fixtures/replay-cli.pdf", privacy_status="needs_review"),
        output_dir=tmp_path,
        created_at="2026-04-05T13:00:00Z",
    )

    main(["--artifact-path", str(written.artifact_path)])

    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "ready"
    assert payload["report"]["document_path"] == "fixtures/replay-cli.pdf"


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
