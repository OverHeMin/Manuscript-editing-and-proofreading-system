from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from document_pipeline.parse_docx import extract_structure_from_paragraphs


def test_extract_headings_returns_ordered_sections():
    result = extract_structure_from_paragraphs(
        [
            {"text": "Title", "style": "Title"},
            {"text": "Abstract", "style": "Heading 1"},
            {"text": "Methods", "style": "Heading 1"},
            {"text": "Participants", "style": "Heading 2"},
        ]
    )

    assert result["status"] == "ready"
    assert result["parser"] == "python_docx"
    assert [section["heading"] for section in result["sections"]] == [
        "Title",
        "Abstract",
        "Methods",
        "Participants",
    ]
    assert result["sections"][3]["level"] == 2


def test_missing_headings_falls_back_to_manual_review():
    result = extract_structure_from_paragraphs(
        [
            {"text": "plain body copy", "style": "Normal"},
            {"text": "more plain copy", "style": "Body Text"},
        ]
    )

    assert result["status"] == "needs_manual_review"
    assert result["sections"] == []
    assert result["warnings"] == [
        "No title or heading styles were detected in the document."
    ]
