import json
from pathlib import Path

from src.document_enhancement.cli import main


def test_cli_emits_a_structured_json_report_for_local_inputs(tmp_path, capsys):
    text_file = tmp_path / "sample.txt"
    text_file.write_text(
        "Reach the author at test@example.com before publication.",
        encoding="utf-8",
    )

    main(
        [
            "--document-path",
            "fixtures/sample.pdf",
            "--text-file",
            str(text_file),
            "--text-layer",
            "missing",
        ]
    )

    payload = json.loads(capsys.readouterr().out)
    assert payload["privacy"]["status"] == "needs_review"
    assert payload["privacy"]["findings"][0]["category"] == "email"
    assert payload["academic_structure"]["document_kind"] == "pdf"
    assert payload["artifact"]["status"] == "skipped"


def test_cli_returns_a_degraded_privacy_section_without_text_and_without_adapters(
    capsys,
):
    main(
        [
            "--document-path",
            "fixtures/sample.pdf",
            "--text-layer",
            "unknown",
        ]
    )

    payload = json.loads(capsys.readouterr().out)
    assert payload["privacy"]["status"] == "degraded"
    assert payload["academic_structure"]["status"] == "degraded"
    assert payload["artifact"]["status"] == "skipped"
    assert payload["notes"][0].startswith("Local-first")


def test_cli_can_write_artifacts_into_a_local_directory(tmp_path, capsys):
    output_dir = tmp_path / "artifacts"

    main(
        [
            "--document-path",
            "fixtures/sample.pdf",
            "--text-layer",
            "missing",
            "--write-artifact",
            "--output-dir",
            str(output_dir),
        ]
    )

    payload = json.loads(capsys.readouterr().out)
    assert payload["artifact"]["status"] == "written"
    assert payload["artifact"]["artifact_path"].endswith(".json")
    assert Path(payload["artifact"]["artifact_path"]).exists()


def test_cli_degrades_when_explicit_artifact_output_path_cannot_be_written(
    tmp_path, capsys
):
    blocked_path = tmp_path / "blocked"
    blocked_path.write_text("occupied", encoding="utf-8")

    main(
        [
            "--document-path",
            "fixtures/sample.pdf",
            "--text-layer",
            "missing",
            "--write-artifact",
            "--output-dir",
            str(blocked_path),
        ]
    )

    payload = json.loads(capsys.readouterr().out)
    assert payload["artifact"]["status"] == "degraded"
    assert payload["privacy"]["status"] == "degraded"
