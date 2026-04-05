import json
from pathlib import Path

from src.document_enhancement.artifacts import write_audit_artifact
from src.document_enhancement.contracts import (
    AcademicStructureAdvisoryResult,
    AdapterStatus,
    DocumentEnhancementAuditReport,
    PrivacyAdvisoryResult,
)
from src.document_enhancement.repair_handoff import build_repair_handoff
from src.document_enhancement.repair_handoff_cli import main


def test_repair_handoff_degrades_when_index_is_missing(tmp_path):
    result = build_repair_handoff(output_dir=tmp_path)

    assert result.status == "degraded"
    assert result.actionable_item_count == 0
    assert result.items == []
    assert result.handoff_path is None
    assert "No local audit index" in result.notes[0]


def test_repair_handoff_merges_cleanup_and_consistency_signals_for_same_target(tmp_path):
    written = write_audit_artifact(
        build_report("fixtures/missing.pdf"),
        output_dir=tmp_path,
        created_at="2026-04-05T10:00:00Z",
    )
    assert written.artifact_path is not None
    written.artifact_path.unlink()

    result = build_repair_handoff(output_dir=tmp_path, keep_last=10)

    assert result.status == "ready"
    assert result.cleanup_action_count == 1
    assert result.consistency_issue_count == 1
    assert result.actionable_item_count == 1
    assert result.items[0].handoff_type == "index_repair_review"
    assert result.items[0].sources == ["cleanup_plan", "index_consistency"]
    assert result.items[0].artifact_path == str(written.artifact_path)


def test_repair_handoff_includes_archive_and_orphan_follow_up(tmp_path):
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
    orphan_path = tmp_path / "20260405-110000Z-orphan.json"
    orphan_path.write_text(json.dumps({"status": "ready"}, indent=2), encoding="utf-8")

    result = build_repair_handoff(output_dir=tmp_path, keep_last=1)

    assert result.status == "ready"
    assert result.actionable_item_count == 2
    handoff_types = {item.handoff_type for item in result.items}
    assert handoff_types == {"archive_then_cleanup_review", "orphan_artifact_review"}


def test_repair_handoff_can_write_a_local_manifest(tmp_path):
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

    result = build_repair_handoff(
        output_dir=tmp_path,
        keep_last=1,
        write_handoff=True,
        generated_at="2026-04-05T11:00:00Z",
    )

    assert result.status == "ready"
    assert result.handoff_path is not None
    assert result.handoff_path.exists()
    assert result.handoff_path.parent == tmp_path / "repair-handoffs"

    payload = json.loads(result.handoff_path.read_text(encoding="utf-8"))
    assert payload["actionable_item_count"] == 1
    assert payload["items"][0]["handoff_type"] == "archive_then_cleanup_review"


def test_repair_handoff_degrades_when_manifest_cannot_be_written(tmp_path):
    blocked_path = tmp_path / "not-a-directory"
    blocked_path.write_text("blocked", encoding="utf-8")
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

    result = build_repair_handoff(
        output_dir=tmp_path,
        keep_last=1,
        write_handoff=True,
        handoff_output_dir=blocked_path,
    )

    assert result.status == "degraded"
    assert result.handoff_path is None
    assert result.actionable_item_count == 1
    assert "Unable to persist local repair handoff manifest" in result.notes[-1]


def test_repair_handoff_cli_emits_structured_json_and_can_write_manifest(
    tmp_path, capsys
):
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

    main(["--output-dir", str(tmp_path), "--keep-last", "1", "--write-handoff"])

    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "ready"
    assert payload["actionable_item_count"] == 1
    assert payload["handoff_path"] is not None
    assert payload["items"][0]["handoff_type"] == "archive_then_cleanup_review"


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
