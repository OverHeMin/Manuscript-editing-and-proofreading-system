import json

from src.document_enhancement.artifacts import write_audit_artifact
from src.document_enhancement.contracts import (
    AcademicStructureAdvisoryResult,
    AdapterStatus,
    DocumentEnhancementAuditReport,
    PrivacyAdvisoryResult,
)
from src.document_enhancement.operator_summary import build_operator_summary
from src.document_enhancement.operator_summary_cli import main


def test_operator_summary_degrades_when_index_is_missing(tmp_path):
    result = build_operator_summary(output_dir=tmp_path)

    assert result.status == "degraded"
    assert result.indexed_artifact_count == 0
    assert result.recent_history == []
    assert result.attention_item_count == 0
    assert result.attention_items == []
    assert result.summary_path is None
    assert result.next_steps == [
        "Run the advisory audit with --write-artifact to create a local evidence baseline."
    ]
    assert "No local audit index" in result.notes[0]


def test_operator_summary_aggregates_recent_history_status_breakdowns_and_attention(
    tmp_path,
):
    write_audit_artifact(
        build_report(
            "fixtures/oldest.pdf",
            privacy_status="advisory_only",
            academic_status="ready",
        ),
        output_dir=tmp_path,
        created_at="2026-04-01T10:00:00Z",
    )
    write_audit_artifact(
        build_report(
            "fixtures/middle.pdf",
            privacy_status="needs_review",
            academic_status="degraded",
        ),
        output_dir=tmp_path,
        created_at="2026-04-04T10:00:00Z",
    )
    write_audit_artifact(
        build_report(
            "fixtures/latest.pdf",
            privacy_status="needs_review",
            academic_status="ready",
        ),
        output_dir=tmp_path,
        created_at="2026-04-05T10:00:00Z",
    )

    result = build_operator_summary(
        output_dir=tmp_path,
        keep_last=1,
        history_limit=2,
        attention_limit=1,
    )

    assert result.status == "ready"
    assert result.indexed_artifact_count == 3
    assert len(result.recent_history) == 2
    assert result.recent_history[0].document_path == "fixtures/latest.pdf"
    assert result.privacy_status_counts == {"advisory_only": 1, "needs_review": 2}
    assert result.academic_structure_status_counts == {"degraded": 1, "ready": 2}
    assert result.retention_review_count == 2
    assert result.cleanup_action_count == 2
    assert result.consistency_issue_count == 0
    assert result.attention_item_count == 2
    assert len(result.attention_items) == 1
    assert result.attention_items[0].handoff_type == "archive_then_cleanup_review"
    assert result.next_steps[0].startswith(
        "Review the bounded repair attention items"
    )


def test_operator_summary_can_write_a_local_snapshot(tmp_path):
    write_audit_artifact(
        build_report("fixtures/older.pdf"),
        output_dir=tmp_path,
        created_at="2026-04-01T10:00:00Z",
    )
    write_audit_artifact(
        build_report("fixtures/latest.pdf", privacy_status="needs_review"),
        output_dir=tmp_path,
        created_at="2026-04-05T10:00:00Z",
    )

    result = build_operator_summary(
        output_dir=tmp_path,
        keep_last=1,
        write_summary=True,
        generated_at="2026-04-05T11:00:00Z",
    )

    assert result.status == "ready"
    assert result.summary_path is not None
    assert result.summary_path.exists()
    assert result.summary_path.parent == tmp_path / "operator-summaries"

    payload = json.loads(result.summary_path.read_text(encoding="utf-8"))
    assert payload["indexed_artifact_count"] == 2
    assert payload["attention_items"][0]["handoff_type"] == "archive_then_cleanup_review"


def test_operator_summary_degrades_when_snapshot_cannot_be_written(tmp_path):
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

    result = build_operator_summary(
        output_dir=tmp_path,
        keep_last=1,
        write_summary=True,
        summary_output_dir=blocked_path,
    )

    assert result.status == "degraded"
    assert result.summary_path is None
    assert result.attention_item_count == 1
    assert "Unable to persist local operator summary snapshot" in result.notes[-1]


def test_operator_summary_cli_emits_structured_json_and_can_write_snapshot(
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

    main(
        [
            "--output-dir",
            str(tmp_path),
            "--keep-last",
            "1",
            "--write-summary",
        ]
    )

    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "ready"
    assert payload["summary_path"] is not None
    assert payload["attention_items"][0]["handoff_type"] == "archive_then_cleanup_review"


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
