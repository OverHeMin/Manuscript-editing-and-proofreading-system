from src.document_enhancement.academic_structure import (
    build_academic_structure_advisory,
)


def test_scanned_pdf_degrades_when_no_local_ocr_or_structure_adapters_are_available():
    result = build_academic_structure_advisory(
        document_path="fixtures/scanned-manuscript.pdf",
        text_layer="missing",
        environment={},
    )

    assert result.status == "degraded"
    assert result.document_kind == "pdf"
    assert result.recommended_path == [
        "ocrmypdf_local",
        "paddleocr_local",
        "grobid_local",
    ]


def test_pdf_with_text_layer_and_configured_grobid_reports_a_bounded_ready_path():
    result = build_academic_structure_advisory(
        document_path="fixtures/structured-manuscript.pdf",
        text_layer="present",
        environment={"GROBID_URL": "http://127.0.0.1:8070"},
    )

    assert result.status == "ready"
    assert result.document_kind == "pdf"
    assert result.recommended_path == ["grobid_local"]
    assert [(adapter.name, adapter.status) for adapter in result.adapters] == [
        ("ocrmypdf_local", "not_configured"),
        ("paddleocr_local", "not_configured"),
        ("grobid_local", "configured"),
    ]


def test_docx_inputs_remain_non_blocking_and_do_not_claim_ocr_is_required():
    result = build_academic_structure_advisory(
        document_path="fixtures/reviewed-manuscript.docx",
        text_layer="unknown",
        environment={},
    )

    assert result.status == "not_required"
    assert result.document_kind == "docx"
    assert result.recommended_path == []
