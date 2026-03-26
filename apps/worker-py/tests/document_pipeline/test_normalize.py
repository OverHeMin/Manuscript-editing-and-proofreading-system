from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from document_pipeline.normalize import (
    build_normalization_job,
    run_libreoffice_conversion,
)


def test_doc_file_is_queued_for_docx_normalization():
    normalize_job = build_normalization_job(
        {
            "manuscript_id": "manuscript-1",
            "source_asset_id": "asset-original-1",
            "file_name": "submission.doc",
            "mime_type": "application/msword",
            "storage_key": "uploads/submission.doc",
        },
        tooling={"libreoffice_available": True},
    )

    assert normalize_job["source_type"] == "doc"
    assert normalize_job["target_type"] == "docx"
    assert normalize_job["derived_asset"]["asset_type"] == "normalized_docx"
    assert normalize_job["conversion"]["backend"] == "libreoffice"
    assert normalize_job["conversion"]["status"] == "queued"
    assert normalize_job["preview"]["status"] == "pending_normalization"


def test_docx_file_skips_conversion_and_generates_ready_preview_metadata():
    normalize_job = build_normalization_job(
        {
            "manuscript_id": "manuscript-2",
            "source_asset_id": "asset-original-2",
            "file_name": "submission.docx",
            "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "storage_key": "uploads/submission.docx",
        },
        tooling={"libreoffice_available": False},
    )

    assert normalize_job["source_type"] == "docx"
    assert normalize_job["target_type"] == "docx"
    assert normalize_job["derived_asset"]["asset_type"] == "normalized_docx"
    assert normalize_job["conversion"]["backend"] is None
    assert normalize_job["conversion"]["status"] == "not_required"
    assert normalize_job["preview"]["status"] == "ready"


def test_docx_extension_wins_over_legacy_msword_mime():
    normalize_job = build_normalization_job(
        {
            "manuscript_id": "manuscript-legacy",
            "source_asset_id": "asset-original-legacy",
            "file_name": "submission.docx",
            "mime_type": "application/msword",
            "storage_key": "uploads/submission.docx",
        },
        tooling={"libreoffice_available": False},
    )

    assert normalize_job["source_type"] == "docx"
    assert normalize_job["conversion"]["status"] == "not_required"
    assert normalize_job["preview"]["status"] == "ready"


def test_doc_file_without_libreoffice_stays_auditable_and_preview_pending():
    normalize_job = build_normalization_job(
        {
            "manuscript_id": "manuscript-3",
            "source_asset_id": "asset-original-3",
            "file_name": "submission.doc",
            "mime_type": "application/msword",
            "storage_key": "uploads/submission.doc",
        },
        tooling={"libreoffice_available": False},
    )

    assert normalize_job["target_type"] == "docx"
    assert normalize_job["conversion"]["status"] == "tool_unavailable"
    assert normalize_job["conversion"]["backend"] == "libreoffice"
    assert normalize_job["preview"]["status"] == "pending_normalization"
    assert normalize_job["warnings"] == [
        "LibreOffice unavailable; doc to docx normalization deferred."
    ]


def test_libreoffice_adapter_reports_tool_unavailable_without_binary():
    conversion_result = run_libreoffice_conversion(
        source_path="C:/tmp/submission.doc",
        output_dir="C:/tmp/output",
        tooling={"libreoffice_binary": None},
    )

    assert conversion_result["status"] == "tool_unavailable"
    assert conversion_result["backend"] == "libreoffice"
    assert conversion_result["output_path"] is None


def test_libreoffice_adapter_returns_converted_docx_path_when_runner_succeeds():
    observed_command = None

    def fake_runner(command, **kwargs):
        nonlocal observed_command
        observed_command = command

        class CompletedProcess:
            returncode = 0
            stdout = ""
            stderr = ""

        return CompletedProcess()

    conversion_result = run_libreoffice_conversion(
        source_path="C:/tmp/submission.doc",
        output_dir="C:/tmp/output",
        tooling={"libreoffice_binary": "soffice"},
        runner=fake_runner,
    )

    assert observed_command == [
        "soffice",
        "--headless",
        "--convert-to",
        "docx",
        "--outdir",
        "C:/tmp/output",
        "C:/tmp/submission.doc",
    ]
    assert conversion_result["status"] == "converted"
    assert conversion_result["backend"] == "libreoffice"
    assert conversion_result["output_path"] == "C:/tmp/output/submission.docx"


def test_normalized_storage_keys_include_source_asset_identity():
    first_job = build_normalization_job(
        {
            "manuscript_id": "manuscript-keys",
            "source_asset_id": "asset-original-1",
            "file_name": "submission.doc",
            "mime_type": "application/msword",
            "storage_key": "uploads/submission.doc",
        },
        tooling={"libreoffice_available": True},
    )
    second_job = build_normalization_job(
        {
            "manuscript_id": "manuscript-keys",
            "source_asset_id": "asset-original-2",
            "file_name": "submission.doc",
            "mime_type": "application/msword",
            "storage_key": "uploads/submission.doc",
        },
        tooling={"libreoffice_available": True},
    )

    assert (
        first_job["derived_asset"]["storage_key"]
        != second_job["derived_asset"]["storage_key"]
    )
