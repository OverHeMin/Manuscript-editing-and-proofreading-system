from pathlib import Path
import sys
from xml.etree import ElementTree as ET


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from document_pipeline.table_patches import apply_table_patches  # noqa: E402


def build_document_root() -> ET.Element:
    document_xml = """
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:r><w:t>表1 基线特征比较</w:t></w:r>
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
              <w:p><w:r><w:t>项目</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:tcPr><w:gridSpan w:val="2"/></w:tcPr>
              <w:p><w:r><w:t>Treatment group</w:t></w:r></w:p>
            </w:tc>
          </w:tr>
          <w:tr>
            <w:tc>
              <w:tcPr><w:tcBorders><w:bottom w:val="single"/></w:tcBorders></w:tcPr>
              <w:p><w:r><w:t>男性</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:tcPr><w:tcBorders><w:bottom w:val="single"/></w:tcBorders></w:tcPr>
              <w:p><w:r><w:t>n</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:tcPr><w:tcBorders><w:bottom w:val="single"/></w:tcBorders></w:tcPr>
              <w:p><w:r><w:t>Rate (%)</w:t></w:r></w:p>
            </w:tc>
          </w:tr>
          <w:tr>
            <w:tc>
              <w:p><w:r><w:t>基线</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:p><w:r><w:t>18</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
              <w:p><w:r><w:t>60.0</w:t></w:r></w:p>
            </w:tc>
          </w:tr>
        </w:tbl>
        <w:p>
          <w:r><w:t>*P&lt;0.05 vs control</w:t></w:r>
        </w:p>
      </w:body>
    </w:document>
    """
    return ET.fromstring(document_xml)


def test_apply_table_patches_updates_only_targeted_local_regions():
    root = build_document_root()

    results = apply_table_patches(
        root,
        [
            {
                "patch_id": "patch-header",
                "rule_id": "rule-header",
                "table_id": "table-1",
                "patch_type": "replace_header_cell_text",
                "anchor": {
                    "table_id": "table-1",
                    "semantic_target": "header_cell",
                    "header_path": ["Treatment group", "n"],
                    "column_key": "Treatment group > n",
                },
                "proposed_before": "n",
                "proposed_after": "例数",
            },
            {
                "patch_id": "patch-unit",
                "rule_id": "rule-unit",
                "table_id": "table-1",
                "patch_type": "normalize_unit_text",
                "anchor": {
                    "table_id": "table-1",
                    "semantic_target": "unit_marker",
                    "header_path": ["Treatment group", "Rate (%)"],
                    "column_key": "Treatment group > Rate (%)",
                },
                "proposed_before": "%",
                "proposed_after": "％",
            },
            {
                "patch_id": "patch-footnote",
                "rule_id": "rule-footnote",
                "table_id": "table-1",
                "patch_type": "replace_footnote_text",
                "anchor": {
                    "table_id": "table-1",
                    "semantic_target": "footnote_item",
                    "footnote_anchor": "*",
                },
                "proposed_before": "*P<0.05 vs control",
                "proposed_after": "注：P<0.05 vs control",
            },
        ],
    )

    document_xml = ET.tostring(root, encoding="unicode")

    assert [entry["status"] for entry in results] == ["applied", "applied", "applied"]
    assert "例数" in document_xml
    assert "Rate (％)" in document_xml
    assert "注：P&lt;0.05 vs control" in document_xml
    assert ">18<" in document_xml
    assert ">60.0<" in document_xml


def build_advanced_document_root() -> ET.Element:
    document_xml = """
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:r><w:t>Table 1 Baseline characteristics</w:t></w:r>
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
            <w:tc><w:p><w:r><w:t>Item</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Value</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Age</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>54.2</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
        <w:p>
          <w:r><w:t>Note: P&lt;0.05 vs control</w:t></w:r>
        </w:p>
      </w:body>
    </w:document>
    """
    return ET.fromstring(document_xml)


def build_controlled_rebuild_snapshot() -> dict:
    def fact(value):
        return {"availability": "authoritative", "value": value}

    def paragraph_snapshot(paragraph_id: str, text: str, *, alignment: str = "left", italic: bool = False, symbol: dict | None = None) -> dict:
        fragments = [
            {
                "id": f"{paragraph_id}-fragment-1",
                "kind": "text",
                "text": text if symbol is None else "Note: ",
                "style": {
                    "font_family": fact("Times New Roman"),
                    "font_size_pt": fact(10.5),
                    "bold": fact(False),
                    "italic": fact(italic),
                    "script_position": fact("baseline"),
                },
            }
        ]
        if symbol is not None:
            fragments.append(symbol)

        return {
            "id": paragraph_id,
            "text": text,
            "style": {
                "alignment": fact(alignment),
                "spacing_before_pt": fact(0),
                "spacing_after_pt": fact(0),
                "line_spacing": fact(1),
                "line_spacing_mode": fact("multiple"),
                "left_indent_pt": fact(0),
                "right_indent_pt": fact(0),
                "first_line_indent_pt": fact(0),
                "hanging_indent_pt": fact(0),
            },
            "fragments": fragments,
        }

    def cell_style(vertical_alignment: str = "center") -> dict:
        return {
            "font_family": fact("Times New Roman"),
            "font_size_pt": fact(10.5),
            "bold": fact(False),
            "italic": fact(False),
            "script_position": fact("baseline"),
            "alignment": fact("center"),
            "spacing_before_pt": fact(0),
            "spacing_after_pt": fact(0),
            "line_spacing": fact(1),
            "line_spacing_mode": fact("multiple"),
            "left_indent_pt": fact(0),
            "right_indent_pt": fact(0),
            "first_line_indent_pt": fact(0),
            "hanging_indent_pt": fact(0),
            "vertical_alignment": fact(vertical_alignment),
        }

    return {
        "table_id": "table-1",
        "row_count": 2,
        "column_count": 2,
        "profile": {
            "is_three_line_table": False,
            "header_depth": 1,
            "has_stub_column": False,
            "has_statistical_footnotes": True,
            "has_unit_markers": False,
        },
        "caption_fields": {
            "text": "Table 1 Demographic characteristics",
            "label_text": "Table 1",
            "title_text": "Demographic characteristics",
            "paragraphs": [
                {
                    "id": "caption-paragraph-1",
                    "text": "Table 1 Demographic characteristics",
                    "style": paragraph_snapshot(
                        "caption-paragraph-1",
                        "Table 1 Demographic characteristics",
                        alignment="center",
                    )["style"],
                    "fragments": [
                        {
                            "id": "caption-fragment-1",
                            "kind": "text",
                            "text": "Table 1 ",
                            "style": {
                                "font_family": fact("Times New Roman"),
                                "font_size_pt": fact(12),
                                "bold": fact(True),
                                "italic": fact(False),
                                "script_position": fact("baseline"),
                            },
                        },
                        {
                            "id": "caption-fragment-2",
                            "kind": "text",
                            "text": "Demographic characteristics",
                            "style": {
                                "font_family": fact("Times New Roman"),
                                "font_size_pt": fact(12),
                                "bold": fact(False),
                                "italic": fact(True),
                                "script_position": fact("baseline"),
                            },
                        },
                    ],
                }
            ],
        },
        "note_zone": {
            "text": "Note: χ2 compared with control",
            "line_texts": ["Note: χ2 compared with control"],
            "footnote_ids": ["table-1-footnote-1"],
            "coordinate": {
                "table_id": "table-1",
                "target": "note_zone",
            },
            "paragraphs": [
                paragraph_snapshot(
                    "note-paragraph-1",
                    "Note: χ2 compared with control",
                    symbol={
                        "id": "note-fragment-2",
                        "kind": "symbol",
                        "text": "",
                        "symbol_font": "Symbol",
                        "symbol_char": "03C7",
                        "style": {
                            "font_family": fact("Symbol"),
                            "font_size_pt": fact(10.5),
                            "bold": fact(False),
                            "italic": fact(False),
                            "script_position": fact("baseline"),
                        },
                    },
                )
            ],
        },
        "footnote_items": [
            {
                "id": "table-1-footnote-1",
                "text": "Note: χ2 compared with control",
                "note_kind": "statistical_significance",
                "marker": "*",
                "coordinate": {
                    "table_id": "table-1",
                    "target": "footnote_item",
                    "footnote_anchor": "*",
                },
            }
        ],
        "grid_cells": [
            {
                "id": "table-1-grid-1",
                "text": "Item",
                "row_index": 0,
                "column_index": 0,
                "row_span": 1,
                "column_span": 1,
                "inferred_role": "header",
                "style_evidence": cell_style(),
                "paragraphs": [paragraph_snapshot("cell-paragraph-1", "Item", alignment="center")],
            },
            {
                "id": "table-1-grid-2",
                "text": "Value",
                "row_index": 0,
                "column_index": 1,
                "row_span": 1,
                "column_span": 1,
                "inferred_role": "header",
                "style_evidence": cell_style(),
                "paragraphs": [paragraph_snapshot("cell-paragraph-2", "Value", alignment="center")],
            },
            {
                "id": "table-1-grid-3",
                "text": "Age",
                "row_index": 1,
                "column_index": 0,
                "row_span": 1,
                "column_span": 1,
                "inferred_role": "data",
                "style_evidence": cell_style(),
                "paragraphs": [paragraph_snapshot("cell-paragraph-3", "Age", alignment="left")],
            },
            {
                "id": "table-1-grid-4",
                "text": "54.2",
                "row_index": 1,
                "column_index": 1,
                "row_span": 1,
                "column_span": 1,
                "inferred_role": "data",
                "style_evidence": cell_style(),
                "paragraphs": [paragraph_snapshot("cell-paragraph-4", "54.2", alignment="right")],
            },
        ],
    }


def test_apply_table_patches_rebuilds_three_line_tables_from_rich_snapshot_evidence():
    root = build_advanced_document_root()

    results = apply_table_patches(
        root,
        [
            {
                "patch_id": "patch-style",
                "rule_id": "rule-style",
                "table_id": "table-1",
                "patch_type": "apply_three_line_table_style",
                "anchor": {
                    "table_id": "table-1",
                    "semantic_target": "style_profile",
                },
                "required_snapshot_capabilities": ["style_profile", "grid_cells"],
                "execution_path": "controlled_rebuild",
                "rebuild_payload": {
                    "table_snapshot": build_controlled_rebuild_snapshot(),
                },
                "proposed_after": "three_line_table",
            },
        ],
    )

    assert [entry["status"] for entry in results] == ["applied"]
    assert results[0]["execution_path"] == "controlled_rebuild"

    rows = root.findall(".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tr")
    assert len(rows) == 2
    assert len(rows[0].findall("./{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tc")) == 2
    assert len(rows[1].findall("./{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tc")) == 2

    document_xml = ET.tostring(root, encoding="unicode")
    assert "Table 1 " in document_xml
    assert "Demographic characteristics" in document_xml
    assert "Note: " in document_xml
    assert "Item" in document_xml
    assert "Value" in document_xml
    assert "Age" in document_xml
    assert "54.2" in document_xml
    assert "insideV" in document_xml
    assert 'val="nil"' in document_xml
    assert "03C7" in document_xml
    assert "<ns0:i />" in document_xml or "<w:i />" in document_xml
