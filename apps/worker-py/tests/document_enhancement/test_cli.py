import json

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
    assert payload["notes"][0].startswith("Local-first")
