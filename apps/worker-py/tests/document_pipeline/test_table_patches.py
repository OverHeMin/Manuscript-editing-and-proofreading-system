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


def test_apply_table_patches_rebuilds_complex_medical_table_with_merged_headers_and_notes():
    root = build_advanced_document_root()
    snapshot = build_controlled_rebuild_snapshot()
    snapshot["row_count"] = 4
    snapshot["column_count"] = 5
    snapshot["profile"]["header_depth"] = 2
    snapshot["caption_fields"]["title_text"] = "Clinical efficacy and inflammatory indicators"
    snapshot["caption_fields"]["text"] = "Table 2 Clinical efficacy and inflammatory indicators"
    snapshot["caption_fields"]["paragraphs"][0]["text"] = (
        "Table 2 Clinical efficacy and inflammatory indicators"
    )
    snapshot["caption_fields"]["paragraphs"][0]["fragments"][0]["text"] = "Table 2 "
    snapshot["caption_fields"]["paragraphs"][0]["fragments"][1]["text"] = (
        "Clinical efficacy and inflammatory indicators"
    )
    snapshot["note_zone"]["text"] = "Note: Compared with before treatment, P<0.05; TNF-α tumor necrosis factor."
    snapshot["note_zone"]["line_texts"] = [
        "Note: Compared with before treatment, P<0.05; TNF-α tumor necrosis factor."
    ]
    snapshot["note_zone"]["paragraphs"] = [
        {
            **snapshot["note_zone"]["paragraphs"][0],
            "text": "Note: Compared with before treatment, P<0.05; TNF-α tumor necrosis factor.",
            "fragments": [
                snapshot["note_zone"]["paragraphs"][0]["fragments"][0],
                {
                    "id": "note-fragment-alpha",
                    "kind": "text",
                    "text": "Compared with before treatment, P<0.05; TNF-α tumor necrosis factor.",
                    "style": snapshot["note_zone"]["paragraphs"][0]["fragments"][0]["style"],
                },
            ],
        }
    ]

    def paragraph(text: str, paragraph_id: str, *, alignment: str = "center") -> dict:
        base = snapshot["grid_cells"][0]["paragraphs"][0]
        fragment_style = base["fragments"][0]["style"]
        paragraph_style = {**base["style"], "alignment": {"availability": "authoritative", "value": alignment}}
        return {
            "id": paragraph_id,
            "text": text,
            "style": paragraph_style,
            "fragments": [
                {
                    "id": f"{paragraph_id}-fragment-1",
                    "kind": "text",
                    "text": text,
                    "style": fragment_style,
                }
            ],
        }

    style = snapshot["grid_cells"][0]["style_evidence"]
    snapshot["grid_cells"] = [
        {
            "id": "complex-cell-1",
            "text": "Group",
            "row_index": 0,
            "column_index": 0,
            "row_span": 2,
            "column_span": 1,
            "inferred_role": "header",
            "style_evidence": style,
            "paragraphs": [paragraph("Group", "complex-p1")],
        },
        {
            "id": "complex-cell-2",
            "text": "Clinical outcome",
            "row_index": 0,
            "column_index": 1,
            "row_span": 1,
            "column_span": 2,
            "inferred_role": "header",
            "style_evidence": style,
            "paragraphs": [paragraph("Clinical outcome", "complex-p2")],
        },
        {
            "id": "complex-cell-3",
            "text": "Inflammatory markers",
            "row_index": 0,
            "column_index": 3,
            "row_span": 1,
            "column_span": 2,
            "inferred_role": "header",
            "style_evidence": style,
            "paragraphs": [paragraph("Inflammatory markers", "complex-p3")],
        },
        {
            "id": "complex-cell-4",
            "text": "n",
            "row_index": 1,
            "column_index": 1,
            "row_span": 1,
            "column_span": 1,
            "inferred_role": "header",
            "style_evidence": style,
            "paragraphs": [paragraph("n", "complex-p4")],
        },
        {
            "id": "complex-cell-5",
            "text": "Effective rate (%)",
            "row_index": 1,
            "column_index": 2,
            "row_span": 1,
            "column_span": 1,
            "inferred_role": "header",
            "style_evidence": style,
            "paragraphs": [paragraph("Effective rate (%)", "complex-p5")],
        },
        {
            "id": "complex-cell-6",
            "text": "CRP (mg/L)",
            "row_index": 1,
            "column_index": 3,
            "row_span": 1,
            "column_span": 1,
            "inferred_role": "header",
            "style_evidence": style,
            "paragraphs": [paragraph("CRP (mg/L)", "complex-p6")],
        },
        {
            "id": "complex-cell-7",
            "text": "TNF-α (ng/L)",
            "row_index": 1,
            "column_index": 4,
            "row_span": 1,
            "column_span": 1,
            "inferred_role": "header",
            "style_evidence": style,
            "paragraphs": [paragraph("TNF-α (ng/L)", "complex-p7")],
        },
        {
            "id": "complex-cell-8",
            "text": "Observation group",
            "row_index": 2,
            "column_index": 0,
            "row_span": 2,
            "column_span": 1,
            "inferred_role": "stub",
            "style_evidence": style,
            "paragraphs": [paragraph("Observation group", "complex-p8")],
        },
        {
            "id": "complex-cell-9",
            "text": "42",
            "row_index": 2,
            "column_index": 1,
            "row_span": 1,
            "column_span": 1,
            "inferred_role": "data",
            "style_evidence": style,
            "paragraphs": [paragraph("42", "complex-p9")],
        },
        {
            "id": "complex-cell-10",
            "text": "95.24",
            "row_index": 2,
            "column_index": 2,
            "row_span": 1,
            "column_span": 1,
            "inferred_role": "data",
            "style_evidence": style,
            "paragraphs": [paragraph("95.24", "complex-p10")],
        },
        {
            "id": "complex-cell-11",
            "text": "8.21±1.04",
            "row_index": 2,
            "column_index": 3,
            "row_span": 1,
            "column_span": 1,
            "inferred_role": "data",
            "style_evidence": style,
            "paragraphs": [paragraph("8.21±1.04", "complex-p11")],
        },
        {
            "id": "complex-cell-12",
            "text": "18.65±3.17",
            "row_index": 2,
            "column_index": 4,
            "row_span": 1,
            "column_span": 1,
            "inferred_role": "data",
            "style_evidence": style,
            "paragraphs": [paragraph("18.65±3.17", "complex-p12")],
        },
        {
            "id": "complex-cell-13",
            "text": "Control group",
            "row_index": 3,
            "column_index": 1,
            "row_span": 1,
            "column_span": 1,
            "inferred_role": "data",
            "style_evidence": style,
            "paragraphs": [paragraph("Control group", "complex-p13")],
        },
        {
            "id": "complex-cell-14",
            "text": "80.95",
            "row_index": 3,
            "column_index": 2,
            "row_span": 1,
            "column_span": 1,
            "inferred_role": "data",
            "style_evidence": style,
            "paragraphs": [paragraph("80.95", "complex-p14")],
        },
        {
            "id": "complex-cell-15",
            "text": "11.72±1.89",
            "row_index": 3,
            "column_index": 3,
            "row_span": 1,
            "column_span": 2,
            "inferred_role": "data",
            "style_evidence": style,
            "paragraphs": [
                paragraph("11.72±1.89", "complex-p15"),
                paragraph("Safety follow-up complete", "complex-p16", alignment="left"),
            ],
        },
    ]

    results = apply_table_patches(
        root,
        [
            {
                "patch_id": "patch-complex-style",
                "rule_id": "rule-complex-style",
                "table_id": "table-1",
                "patch_type": "apply_three_line_table_style",
                "anchor": {
                    "table_id": "table-1",
                    "semantic_target": "style_profile",
                },
                "required_snapshot_capabilities": ["style_profile", "grid_cells"],
                "execution_path": "controlled_rebuild",
                "rebuild_payload": {
                    "table_snapshot": snapshot,
                },
                "proposed_after": "complex_three_line_table",
            },
        ],
    )

    assert [entry["status"] for entry in results] == ["applied"]
    document_xml = ET.tostring(root, encoding="unicode")
    rows = root.findall(".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tr")
    assert len(rows) == 4
    assert document_xml.count("gridSpan") >= 3
    assert document_xml.count("vMerge") >= 4
    assert "Table 2 " in document_xml
    assert "Clinical efficacy and inflammatory indicators" in document_xml
    assert "Clinical outcome" in document_xml
    assert "Inflammatory markers" in document_xml
    assert "Observation group" in document_xml
    assert "Control group" in document_xml
    assert "Safety follow-up complete" in document_xml
    assert "TNF-α" in document_xml
    assert "insideV" in document_xml
    assert 'val="nil"' in document_xml


def test_apply_table_patches_escalates_low_confidence_complex_rebuild_without_mutating_table():
    root = build_advanced_document_root()
    before_xml = ET.tostring(root, encoding="unicode")
    snapshot = build_controlled_rebuild_snapshot()
    snapshot["rebuild_confidence"] = 0.42
    snapshot["confidence_reasons"] = [
        "missing grid evidence for merged header",
        "ambiguous row span reconstruction",
    ]

    results = apply_table_patches(
        root,
        [
            {
                "patch_id": "patch-low-confidence-style",
                "rule_id": "rule-low-confidence-style",
                "table_id": "table-1",
                "patch_type": "apply_three_line_table_style",
                "anchor": {
                    "table_id": "table-1",
                    "semantic_target": "style_profile",
                },
                "required_snapshot_capabilities": ["style_profile", "grid_cells"],
                "execution_path": "controlled_rebuild",
                "rebuild_payload": {
                    "table_snapshot": snapshot,
                    "minimum_rebuild_confidence": 0.8,
                },
                "proposed_after": "complex_three_line_table",
            },
        ],
    )

    assert results == [
        {
            "patch_id": "patch-low-confidence-style",
            "rule_id": "rule-low-confidence-style",
            "patch_type": "apply_three_line_table_style",
            "status": "escalated_manual_review",
            "reason": "Controlled table rebuild confidence 0.42 is below required 0.80.",
            "required_snapshot_capabilities": ["style_profile", "grid_cells"],
            "table_id": "table-1",
            "anchor": {
                "table_id": "table-1",
                "semantic_target": "style_profile",
            },
            "semantic_target": "style_profile",
            "execution_path": "controlled_rebuild",
            "confidence": 0.42,
            "minimum_rebuild_confidence": 0.8,
            "escalation_reason": "missing grid evidence for merged header; ambiguous row span reconstruction",
        }
    ]
    assert ET.tostring(root, encoding="unicode") == before_xml
