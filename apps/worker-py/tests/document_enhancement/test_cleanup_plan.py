import json
from pathlib import Path

from src.document_enhancement.artifacts import write_audit_artifact
from src.document_enhancement.cleanup_plan import build_cleanup_plan
from src.document_enhancement.cleanup_plan_cli import main
from src.document_enhancement.contracts import (
    AcademicStructureAdvisoryResult,
    AdapterStatus,
    DocumentEnhancementAuditReport,
    PrivacyAdvisoryResult,
)


def test_cleanup_plan_degrades_when_index_is_missing(tmp_path):
    result = build_cleanup_plan(output_dir=tmp_path)

    assert result.status == "degraded"
    assert result.actions == []
    assert result.plan_path is None
    assert "No local audit index" in result.notes[0]


def test_cleanup_plan_maps_review_candidates_into_manual_actions(tmp_path):
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

    result = build_cleanup_plan(output_dir=tmp_path, keep_last=1)

    assert result.status == "ready"
    assert result.planned_action_count == 1
    assert result.actions[0].document_path == "fixtures/latest.pdf"
    assert result.actions[0].action == "keep"
    assert result.actions[1].document_path == "fixtures/older.pdf"
    assert result.actions[1].action == "archive_then_cleanup_review"
    assert "archive" in result.actions[1].manual_steps[0]


def test_cleanup_plan_marks_missing_artifacts_for_index_repair_review(tmp_path):
    written = write_audit_artifact(
        build_report("fixtures/missing.pdf"),
        output_dir=tmp_path,
        created_at="2026-04-01T10:00:00Z",
    )
    assert written.artifact_path is not None
    written.artifact_path.unlink()

    result = build_cleanup_plan(output_dir=tmp_path, keep_last=10)

    assert result.status == "ready"
    assert result.planned_action_count == 1
    assert result.actions[0].action == "index_repair_review"
    assert "missing locally" in result.actions[0].reason


def test_cleanup_plan_can_write_a_local_manifest(tmp_path):
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

    result = build_cleanup_plan(
        output_dir=tmp_path,
        keep_last=1,
        write_plan=True,
        generated_at="2026-04-05T11:00:00Z",
    )

    assert result.status == "ready"
    assert result.plan_path is not None
    assert result.plan_path.exists()
    assert result.plan_path.parent == tmp_path / "plans"

    payload = json.loads(result.plan_path.read_text(encoding="utf-8"))
    assert payload["planned_action_count"] == 1
    assert payload["actions"][1]["action"] == "archive_then_cleanup_review"


def test_cleanup_plan_degrades_when_manifest_cannot_be_written(tmp_path):
    blocked_path = tmp_path / "not-a-directory"
    blocked_path.write_text("blocked", encoding="utf-8")
    write_audit_artifact(
        build_report("fixtures/sample.pdf"),
        output_dir=tmp_path,
        created_at="2026-04-05T10:00:00Z",
    )

    result = build_cleanup_plan(
        output_dir=tmp_path,
        keep_last=0,
        write_plan=True,
        plan_output_dir=blocked_path,
    )

    assert result.status == "degraded"
    assert result.plan_path is None
    assert result.actions[0].action == "archive_then_cleanup_review"
    assert "Unable to persist local cleanup plan manifest" in result.notes[-1]


def test_cleanup_plan_cli_degrades_when_index_is_missing(tmp_path, capsys):
    main(["--output-dir", str(tmp_path)])

    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "degraded"
    assert payload["actions"] == []
    assert payload["plan_path"] is None


def test_cleanup_plan_cli_emits_structured_json(tmp_path, capsys):
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

    main(["--output-dir", str(tmp_path), "--keep-last", "1"])

    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "ready"
    assert payload["planned_action_count"] == 1
    assert payload["actions"][1]["action"] == "archive_then_cleanup_review"
    assert payload["plan_path"] is None


def test_cleanup_plan_cli_can_write_manifest_with_default_or_override_directory(
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

    main(["--output-dir", str(tmp_path), "--keep-last", "1", "--write-plan"])
    default_payload = json.loads(capsys.readouterr().out)
    assert default_payload["plan_path"] is not None
    assert (
        Path(default_payload["plan_path"]).parent
        == tmp_path / "plans"
    )

    custom_plan_dir = tmp_path / "custom-plans"
    main(
        [
            "--output-dir",
            str(tmp_path),
            "--keep-last",
            "1",
            "--write-plan",
            "--plan-output-dir",
            str(custom_plan_dir),
        ]
    )
    override_payload = json.loads(capsys.readouterr().out)
    assert override_payload["plan_path"] is not None
    assert Path(override_payload["plan_path"]).parent == custom_plan_dir


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
