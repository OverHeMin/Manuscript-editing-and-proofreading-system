from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from document_pipeline.parse_docx import (
    extract_structure_from_document_xml,
    extract_structure_from_paragraphs,
)


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


def test_document_xml_extracts_table_semantics_snapshot():
    document_xml = f"""
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:r><w:t>\u88681 \u4e0d\u540c\u6cbb\u7597\u7ec4\u57fa\u7ebf\u7279\u5f81\u6bd4\u8f83</w:t></w:r>
        </w:p>
        <w:tbl>
          <w:tr>
            <w:tc>
              <w:p><w:r><w:t>\u9879\u76ee</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:tcPr><w:gridSpan w:val="2"/></w:tcPr>
              <w:p><w:r><w:t>\u6cbb\u7597\u7ec4</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:tcPr><w:gridSpan w:val="2"/></w:tcPr>
              <w:p><w:r><w:t>\u5bf9\u7167\u7ec4</w:t></w:r></w:p>
            </w:tc>
          </w:tr>
          <w:tr>
            <w:tc>
              <w:p><w:r><w:t>\u5e74\u9f84</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:p><w:r><w:t>n (%)</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:p><w:r><w:t>\u5747\u503c\u00b1SD</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:p><w:r><w:t>n (%)</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:p><w:r><w:t>\u5747\u503c\u00b1SD</w:t></w:r></w:p>
            </w:tc>
          </w:tr>
          <w:tr>
            <w:tc>
              <w:p><w:r><w:t>\u7537\u6027</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:p><w:r><w:t>18 (60.0)</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:p><w:r><w:t>54.2\u00b110.3</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:p><w:r><w:t>16 (53.3)</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:p><w:r><w:t>51.1\u00b19.8</w:t></w:r></w:p>
            </w:tc>
          </w:tr>
        </w:tbl>
        <w:p>
          <w:r><w:t>*P&lt;0.05 vs control</w:t></w:r>
        </w:p>
      </w:body>
    </w:document>
    """

    result = extract_structure_from_document_xml(document_xml)

    assert result["status"] == "ready"
    assert len(result["tables"]) == 1
    semantic = result["tables"][0]["semantic"]
    assert semantic["profile"]["is_three_line_table"] is True
    assert semantic["profile"]["header_depth"] == 2
    assert semantic["profile"]["has_stub_column"] is True
    assert semantic["profile"]["has_statistical_footnotes"] is True
    assert semantic["header_cells"][1]["header_path"] == [
        "\u6cbb\u7597\u7ec4",
        "n (%)",
    ]
    assert semantic["footnote_items"][0]["note_kind"] == "statistical_significance"
