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
          <w:tblPr>
            <w:tblBorders>
              <w:top w:val="single"/>
              <w:bottom w:val="single"/>
              <w:insideV w:val="nil"/>
            </w:tblBorders>
          </w:tblPr>
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
              <w:tcPr><w:tcBorders><w:bottom w:val="single"/></w:tcBorders></w:tcPr>
              <w:p><w:r><w:t>\u5e74\u9f84</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:tcPr><w:tcBorders><w:bottom w:val="single"/></w:tcBorders></w:tcPr>
              <w:p><w:r><w:t>n (%)</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:tcPr><w:tcBorders><w:bottom w:val="single"/></w:tcBorders></w:tcPr>
              <w:p><w:r><w:t>\u5747\u503c\u00b1SD</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:tcPr><w:tcBorders><w:bottom w:val="single"/></w:tcBorders></w:tcPr>
              <w:p><w:r><w:t>n (%)</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:tcPr><w:tcBorders><w:bottom w:val="single"/></w:tcBorders></w:tcPr>
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
    assert semantic["table_label"]["text"] == "\u88681"
    assert semantic["table_title"]["text"] == "\u4e0d\u540c\u6cbb\u7597\u7ec4\u57fa\u7ebf\u7279\u5f81\u6bd4\u8f83"
    assert semantic["caption_fields"]["text"] == "\u88681 \u4e0d\u540c\u6cbb\u7597\u7ec4\u57fa\u7ebf\u7279\u5f81\u6bd4\u8f83"
    assert semantic["note_zone"]["text"] == "*P<0.05 vs control"
    assert semantic["note_zone"]["coordinate"]["target"] == "note_zone"
    assert semantic["style_profile"]["has_top_rule"] is True
    assert semantic["style_profile"]["has_header_rule"] is True
    assert semantic["style_profile"]["has_bottom_rule"] is True
    assert semantic["style_profile"]["has_vertical_rules"] is False
    assert semantic["style_profile"]["coordinate"]["target"] == "style_profile"
    assert semantic["header_cells"][1]["header_path"] == [
        "\u6cbb\u7597\u7ec4",
        "n (%)",
    ]
    assert semantic["footnote_items"][0]["note_kind"] == "statistical_significance"


def test_document_xml_extracts_rich_table_style_evidence():
    document_xml = """
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:pPr><w:jc w:val="center"/></w:pPr>
          <w:r>
            <w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/></w:rPr>
            <w:t>Table 2 Alpha summary</w:t>
          </w:r>
        </w:p>
        <w:tbl>
          <w:tr>
            <w:tc>
              <w:tcPr><w:vAlign w:val="center"/></w:tcPr>
              <w:p>
                <w:pPr>
                  <w:jc w:val="right"/>
                  <w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>
                </w:pPr>
                <w:r>
                  <w:rPr><w:rFonts w:ascii="Symbol"/><w:sz w:val="21"/></w:rPr>
                  <w:sym w:font="Symbol" w:char="03B1"/>
                </w:r>
                <w:r>
                  <w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="21"/><w:i/></w:rPr>
                  <w:t>=0.05</w:t>
                </w:r>
              </w:p>
            </w:tc>
          </w:tr>
        </w:tbl>
        <w:p>
          <w:r>
            <w:rPr><w:i/></w:rPr>
            <w:t>Note: α retained as symbol</w:t>
          </w:r>
        </w:p>
      </w:body>
    </w:document>
    """

    result = extract_structure_from_document_xml(document_xml)

    semantic = result["tables"][0]["semantic"]
    assert semantic["row_count"] == 1
    assert semantic["column_count"] == 1
    assert semantic["caption_fields"]["paragraphs"][0]["style"]["alignment"]["value"] == "center"
    assert semantic["caption_fields"]["paragraphs"][0]["fragments"][0]["style"]["bold"]["value"] is True
    assert semantic["note_zone"]["paragraphs"][0]["fragments"][0]["style"]["italic"]["value"] is True
    assert semantic["grid_cells"][0]["style_evidence"]["alignment"]["value"] == "right"
    assert semantic["grid_cells"][0]["style_evidence"]["vertical_alignment"]["value"] == "center"
    assert semantic["grid_cells"][0]["paragraphs"][0]["fragments"][0]["kind"] == "symbol"
    assert semantic["grid_cells"][0]["paragraphs"][0]["fragments"][0]["text"] == "α"
    assert semantic["grid_cells"][0]["paragraphs"][0]["fragments"][1]["style"]["italic"]["value"] is True


def test_document_xml_recovers_sections_from_numbered_plain_paragraphs():
    document_xml = """
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:r><w:t>第一作者：张三</w:t></w:r>
        </w:p>
        <w:p>
          <w:r><w:t>1 资料与方法</w:t></w:r>
        </w:p>
        <w:p>
          <w:r><w:t>1.1 一般资料</w:t></w:r>
        </w:p>
        <w:p>
          <w:r><w:t>2 结果</w:t></w:r>
        </w:p>
      </w:body>
    </w:document>
    """

    result = extract_structure_from_document_xml(document_xml)

    assert result["status"] == "ready"
    assert [section["heading"] for section in result["sections"]] == [
        "1 资料与方法",
        "1.1 一般资料",
        "2 结果",
    ]
    assert [section["level"] for section in result["sections"]] == [1, 2, 1]


def test_document_xml_extracts_object_evidence_for_image_substituted_symbols():
    document_xml = """
    <w:document
      xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
      xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
      xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
      xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
      xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <w:body>
        <w:p>
          <w:r><w:t>2 结果</w:t></w:r>
        </w:p>
        <w:p>
          <w:r>
            <w:drawing>
              <wp:inline>
                <wp:docPr id="1" name="chi-square image" descr="卡方检验符号图片"/>
                <a:graphic>
                  <a:graphicData>
                    <pic:pic>
                      <pic:blipFill>
                        <a:blip r:embed="rId5"/>
                      </pic:blipFill>
                    </pic:pic>
                  </a:graphicData>
                </a:graphic>
              </wp:inline>
            </w:drawing>
          </w:r>
        </w:p>
      </w:body>
    </w:document>
    """

    result = extract_structure_from_document_xml(document_xml)

    assert result["status"] == "ready"
    assert len(result["objects"]) == 1
    assert result["objects"][0]["object_kind"] == "image"
    assert result["objects"][0]["source_locator"] == "body:p:1"
    assert result["objects"][0]["relationship_id"] == "rId5"
    assert "卡方检验符号图片" in result["objects"][0]["evidence_text"]
    assert result["objects"][0]["intended_target"] == "χ²"


def test_document_xml_preserves_table_cell_object_evidence_in_semantic_grid():
    document_xml = """
    <w:document
      xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
      xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
      xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
      xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
      xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
      xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <w:body>
        <w:p><w:r><w:t>Table 3 Object evidence</w:t></w:r></w:p>
        <w:tbl>
          <w:tr>
            <w:tc>
              <w:p>
                <w:r><w:t>Formula </w:t></w:r>
                <w:r>
                  <m:oMath>
                    <m:r><m:t>x=1</m:t></m:r>
                  </m:oMath>
                </w:r>
              </w:p>
            </w:tc>
            <w:tc>
              <w:p>
                <w:r>
                  <w:drawing>
                    <wp:anchor>
                      <wp:docPr id="2" name="floating image" descr="floating table object"/>
                      <a:graphic>
                        <a:graphicData>
                          <pic:pic>
                            <pic:blipFill>
                              <a:blip r:embed="rId7"/>
                            </pic:blipFill>
                          </pic:pic>
                        </a:graphicData>
                      </a:graphic>
                    </wp:anchor>
                  </w:drawing>
                </w:r>
              </w:p>
            </w:tc>
          </w:tr>
        </w:tbl>
      </w:body>
    </w:document>
    """

    result = extract_structure_from_document_xml(document_xml)

    assert result["status"] == "ready"
    assert len(result["objects"]) == 2
    semantic = result["tables"][0]["semantic"]
    first_cell = semantic["grid_cells"][0]
    second_cell = semantic["grid_cells"][1]
    assert first_cell["object_evidence"][0]["object_kind"] == "equation"
    assert first_cell["paragraphs"][0]["fragments"][1]["kind"] == "object"
    assert first_cell["paragraphs"][0]["fragments"][1]["object_kind"] == "equation"
    assert second_cell["object_evidence"][0]["object_kind"] == "image"
    assert second_cell["object_evidence"][0]["relationship_id"] == "rId7"
    assert second_cell["paragraphs"][0]["fragments"][0]["kind"] == "object"
    assert second_cell["paragraphs"][0]["fragments"][0]["relationship_id"] == "rId7"


def test_document_xml_marks_nested_tables_as_table_cell_object_evidence():
    document_xml = """
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>Table 4 Nested table</w:t></w:r></w:p>
        <w:tbl>
          <w:tr>
            <w:tc>
              <w:p><w:r><w:t>Outer cell</w:t></w:r></w:p>
              <w:tbl>
                <w:tr>
                  <w:tc><w:p><w:r><w:t>Inner A</w:t></w:r></w:p></w:tc>
                  <w:tc><w:p><w:r><w:t>Inner B</w:t></w:r></w:p></w:tc>
                </w:tr>
              </w:tbl>
            </w:tc>
          </w:tr>
        </w:tbl>
      </w:body>
    </w:document>
    """

    result = extract_structure_from_document_xml(document_xml)

    assert result["status"] == "ready"
    assert any(entry["object_kind"] == "nested_table" for entry in result["objects"])
    nested = next(entry for entry in result["objects"] if entry["object_kind"] == "nested_table")
    assert nested["container_kind"] == "table_cell"
    assert nested["intended_target"] == "preserve_as_nested_table"
    assert "nested_table rows=1 cells=2" in nested["evidence_text"]
    grid_cell = result["tables"][0]["semantic"]["grid_cells"][0]
    assert grid_cell["object_evidence"][0]["object_kind"] == "nested_table"
    assert grid_cell["object_evidence"][0]["source_locator"] == nested["source_locator"]


def test_document_xml_marks_text_box_tables_as_table_cell_object_evidence():
    document_xml = """
    <w:document
      xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
      xmlns:v="urn:schemas-microsoft-com:vml">
      <w:body>
        <w:p><w:r><w:t>Table 5 Text box table</w:t></w:r></w:p>
        <w:tbl>
          <w:tr>
            <w:tc>
              <w:p><w:r><w:t>Outer cell before text box</w:t></w:r></w:p>
              <w:p>
                <w:r>
                  <w:pict>
                    <v:shape id="TextBox1">
                      <v:textbox>
                        <w:txbxContent>
                          <w:tbl>
                            <w:tr>
                              <w:tc><w:p><w:r><w:t>Box A</w:t></w:r></w:p></w:tc>
                            </w:tr>
                          </w:tbl>
                        </w:txbxContent>
                      </v:textbox>
                    </v:shape>
                  </w:pict>
                </w:r>
              </w:p>
            </w:tc>
          </w:tr>
        </w:tbl>
      </w:body>
    </w:document>
    """

    result = extract_structure_from_document_xml(document_xml)

    assert result["status"] == "ready"
    assert any(entry["object_kind"] == "text_box_table" for entry in result["objects"])
    text_box_table = next(
        entry for entry in result["objects"] if entry["object_kind"] == "text_box_table"
    )
    assert text_box_table["container_kind"] == "table_cell"
    assert text_box_table["intended_target"] == "preserve_as_text_box_table"
    assert "text_box_table rows=1 cells=1" in text_box_table["evidence_text"]
    grid_cell = result["tables"][0]["semantic"]["grid_cells"][0]
    assert any(
        entry["object_kind"] == "text_box_table"
        for entry in grid_cell["object_evidence"]
    )


def test_document_xml_preserves_rotated_table_cell_text_direction():
    document_xml = """
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>Table 6 Rotated text</w:t></w:r></w:p>
        <w:tbl>
          <w:tr>
            <w:tc>
              <w:tcPr><w:textDirection w:val="btLr"/></w:tcPr>
              <w:p><w:r><w:t>Rotated header</w:t></w:r></w:p>
            </w:tc>
          </w:tr>
        </w:tbl>
      </w:body>
    </w:document>
    """

    result = extract_structure_from_document_xml(document_xml)

    assert result["status"] == "ready"
    style = result["tables"][0]["semantic"]["grid_cells"][0]["style_evidence"]
    assert style["text_direction"]["availability"] == "authoritative"
    assert style["text_direction"]["value"] == "btLr"


def test_document_xml_marks_ocr_image_tables_for_manual_review():
    document_xml = """
    <w:document
      xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
      xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
      xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
      xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
      xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <w:body>
        <w:p><w:r><w:t>Table 7 OCR image table</w:t></w:r></w:p>
        <w:tbl>
          <w:tr>
            <w:tc>
              <w:p>
                <w:r>
                  <w:drawing>
                    <wp:inline>
                      <wp:docPr id="3" name="ocr table image" descr="OCR image table needing review"/>
                      <a:graphic>
                        <a:graphicData>
                          <pic:pic>
                            <pic:blipFill>
                              <a:blip r:embed="rId9"/>
                            </pic:blipFill>
                          </pic:pic>
                        </a:graphicData>
                      </a:graphic>
                    </wp:inline>
                  </w:drawing>
                </w:r>
              </w:p>
            </w:tc>
          </w:tr>
        </w:tbl>
      </w:body>
    </w:document>
    """

    result = extract_structure_from_document_xml(document_xml)

    assert result["status"] == "ready"
    assert any(entry["object_kind"] == "ocr_image_table" for entry in result["objects"])
    ocr_table = next(
        entry for entry in result["objects"] if entry["object_kind"] == "ocr_image_table"
    )
    assert ocr_table["container_kind"] == "table_cell"
    assert ocr_table["relationship_id"] == "rId9"
    assert ocr_table["intended_target"] == "manual_ocr_table_review"
    grid_cell = result["tables"][0]["semantic"]["grid_cells"][0]
    assert grid_cell["object_evidence"][0]["object_kind"] == "ocr_image_table"
    assert grid_cell["paragraphs"][0]["fragments"][0]["kind"] == "object"
    assert grid_cell["paragraphs"][0]["fragments"][0]["object_kind"] == "ocr_image_table"
