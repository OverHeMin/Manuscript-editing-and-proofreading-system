from pathlib import Path
import sys
import zipfile


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from document_pipeline.apply_editorial_rules import (  # noqa: E402
    apply_rules_to_docx,
    transform_heading,
)
from document_pipeline.materialize_docx import write_docx  # noqa: E402

BEFORE_HEADING = "\u6458\u8981 \u76ee\u7684"
AFTER_HEADING = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09"
BODY_TEXT = "\u6b63\u6587\u6bb5\u843d"
W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def test_replace_heading_with_full_width_brackets_and_space():
    rule = {
        "id": "rule-abstract-objective",
        "rule_type": "format",
        "execution_mode": "apply_and_inspect",
        "confidence_policy": "always_auto",
        "trigger": {"kind": "exact_text", "text": BEFORE_HEADING},
        "action": {"kind": "replace_heading", "to": AFTER_HEADING},
    }

    assert transform_heading(BEFORE_HEADING, rule) == AFTER_HEADING


def test_apply_rules_to_docx_writes_transformed_output_and_change_log(tmp_path):
    source_path = tmp_path / "source.docx"
    output_path = tmp_path / "output.docx"
    write_docx(source_path, [BEFORE_HEADING, BODY_TEXT])
    rules = [
        {
            "id": "rule-abstract-objective",
            "rule_type": "format",
            "execution_mode": "apply_and_inspect",
            "confidence_policy": "always_auto",
            "trigger": {"kind": "exact_text", "text": BEFORE_HEADING},
            "action": {"kind": "replace_heading", "to": AFTER_HEADING},
        }
    ]

    result = apply_rules_to_docx(source_path, output_path, rules, [])

    assert result["applied_rule_ids"] == ["rule-abstract-objective"]
    assert result["applied_changes"] == [
        {
            "ruleId": "rule-abstract-objective",
            "before": BEFORE_HEADING,
            "after": AFTER_HEADING,
        }
    ]

    with zipfile.ZipFile(output_path, "r") as archive:
        document_xml = archive.read("word/document.xml").decode("utf-8")

    assert AFTER_HEADING in document_xml
    assert BEFORE_HEADING not in document_xml


def test_apply_rules_to_docx_skips_ai_replacements_that_span_multiple_runs(tmp_path):
    source_path = tmp_path / "source-multi-run.docx"
    output_path = tmp_path / "output-multi-run.docx"
    source_path.parent.mkdir(parents=True, exist_ok=True)

    document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W_NS}">
  <w:body>
    <w:p>
      <w:r><w:t>5 mg </w:t></w:r>
      <w:r><w:t>per dL</w:t></w:r>
    </w:p>
    <w:sectPr/>
  </w:body>
</w:document>
"""
    content_types_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
"""
    rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
"""

    with zipfile.ZipFile(source_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
      archive.writestr("[Content_Types].xml", content_types_xml)
      archive.writestr("_rels/.rels", rels_xml)
      archive.writestr("word/document.xml", document_xml)

    result = apply_rules_to_docx(
        source_path,
        output_path,
        [],
        [
            {
                "targetText": "5 mg per dL",
                "replacementText": "5 mg/dL",
            }
        ],
    )

    assert result["applied_rule_ids"] == []
    assert result["applied_changes"] == []
    assert result["skipped_ai_replacements"] == [
        {
            "replacementId": "ai-replacement-1",
            "reason": "anchor_not_precise",
            "targetText": "5 mg per dL",
        }
    ]

    with zipfile.ZipFile(output_path, "r") as archive:
        output_xml = archive.read("word/document.xml").decode("utf-8")

    assert "<w:t>5 mg </w:t>" in output_xml
    assert "<w:t>per dL</w:t>" in output_xml


def test_apply_rules_to_docx_skips_numeric_ai_replacements_by_guardrail(tmp_path):
    source_path = tmp_path / "source-numeric.docx"
    output_path = tmp_path / "output-numeric.docx"
    write_docx(source_path, ["5 mg per dL"])

    result = apply_rules_to_docx(
        source_path,
        output_path,
        [],
        [
            {
                "targetText": "5 mg per dL",
                "replacementText": "5 mg/dL",
            }
        ],
    )

    assert result["applied_rule_ids"] == []
    assert result["applied_changes"] == []
    assert result["skipped_ai_replacements"] == [
        {
            "replacementId": "ai-replacement-1",
            "reason": "numeric_entity_present",
            "targetText": "5 mg per dL",
        }
    ]

    with zipfile.ZipFile(output_path, "r") as archive:
        output_xml = archive.read("word/document.xml").decode("utf-8")

    assert "5 mg per dL" in output_xml
    assert "5 mg/dL" not in output_xml


def test_apply_rules_to_docx_flags_missing_replacement_as_insufficient_style_evidence(
    tmp_path,
):
    source_path = tmp_path / "source-missing-replacement.docx"
    output_path = tmp_path / "output-missing-replacement.docx"
    write_docx(source_path, ["摘要 目的"])

    result = apply_rules_to_docx(
        source_path,
        output_path,
        [],
        [
            {
                "targetText": "摘要 目的",
            }
        ],
    )

    assert result["applied_rule_ids"] == []
    assert result["applied_changes"] == []
    assert result["skipped_ai_replacements"] == [
        {
            "replacementId": "ai-replacement-1",
            "reason": "insufficient_style_evidence",
            "targetText": "摘要 目的",
        }
    ]


def test_apply_rules_to_docx_allows_format_only_punctuation_ai_replacements(tmp_path):
    source_path = tmp_path / "source-punctuation.docx"
    output_path = tmp_path / "output-punctuation.docx"
    write_docx(source_path, ["Introduction ,"])

    result = apply_rules_to_docx(
        source_path,
        output_path,
        [],
        [
            {
                "targetText": "Introduction ,",
                "replacementText": "Introduction,",
            }
        ],
    )

    assert result["applied_rule_ids"] == ["ai-replacement-1"]
    assert result["applied_changes"] == [
        {
            "ruleId": "ai-replacement-1",
            "before": "Introduction ,",
            "after": "Introduction,",
        }
    ]
    assert result["skipped_ai_replacements"] == []


def test_apply_rules_to_docx_does_not_record_false_skip_before_later_paragraph_match(
    tmp_path,
):
    source_path = tmp_path / "source-later-paragraph.docx"
    output_path = tmp_path / "output-later-paragraph.docx"
    write_docx(source_path, ["Background paragraph", "Introduction ,"])

    result = apply_rules_to_docx(
        source_path,
        output_path,
        [],
        [
            {
                "targetText": "Introduction ,",
                "replacementText": "Introduction,",
            }
        ],
    )

    assert result["applied_rule_ids"] == ["ai-replacement-1"]
    assert result["applied_changes"] == [
        {
            "ruleId": "ai-replacement-1",
            "before": "Introduction ,",
            "after": "Introduction,",
        }
    ]
    assert result["skipped_ai_replacements"] == []


def test_apply_rules_to_docx_rejects_table_patches_outside_editing_safe_mode(tmp_path):
    source_path = tmp_path / "source.docx"
    output_path = tmp_path / "output.docx"
    write_docx(source_path, [BODY_TEXT])

    try:
        apply_rules_to_docx(
            source_path,
            output_path,
            [],
            [],
            table_auto_apply_mode="inspect_only",
            table_patches=[
                {
                    "patch_type": "replace_header_cell_text",
                    "table_id": "table-1",
                    "header_path": ["Treatment group"],
                    "replacement_text": "Treatment Group",
                }
            ],
        )
    except ValueError as exc:
        assert "editing_safe_apply" in str(exc)
    else:
        raise AssertionError(
            "Expected table patch payloads outside editing_safe_apply mode to be rejected."
        )


def test_apply_rules_to_docx_applies_safe_table_patches_and_returns_patch_results(
    tmp_path,
):
    source_path = tmp_path / "source.docx"
    output_path = tmp_path / "output.docx"
    write_table_docx(source_path)

    result = apply_rules_to_docx(
        source_path,
        output_path,
        [],
        [],
        table_auto_apply_mode="editing_safe_apply",
        table_patches=[
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

    assert result["applied_rule_ids"] == []
    assert [entry["status"] for entry in result["table_patch_results"]] == [
        "applied",
        "applied",
        "applied",
    ]

    with zipfile.ZipFile(output_path, "r") as archive:
        document_xml = archive.read("word/document.xml").decode("utf-8")

    assert "例数" in document_xml
    assert "Rate (％)" in document_xml
    assert "注：P&lt;0.05 vs control" in document_xml


def test_apply_rules_to_docx_rebuilds_three_line_tables_and_reports_execution_path(
    tmp_path,
):
    source_path = tmp_path / "source-rebuild.docx"
    output_path = tmp_path / "output-rebuild.docx"
    write_advanced_table_docx(source_path)

    result = apply_rules_to_docx(
        source_path,
        output_path,
        [],
        [],
        table_auto_apply_mode="editing_safe_apply",
        table_patches=[
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
                    "table_snapshot": build_three_line_rebuild_snapshot(),
                },
                "proposed_after": "three_line_table",
            }
        ],
    )

    assert result["applied_rule_ids"] == []
    assert result["table_patch_results"] == [
        {
            "patch_id": "patch-style",
            "rule_id": "rule-style",
            "patch_type": "apply_three_line_table_style",
            "status": "applied",
            "reason": "Controlled table rebuild applied.",
            "required_snapshot_capabilities": ["style_profile", "grid_cells"],
            "table_id": "table-1",
            "anchor": {
                "table_id": "table-1",
                "semantic_target": "style_profile",
            },
            "semantic_target": "style_profile",
            "execution_path": "controlled_rebuild",
        }
    ]

    with zipfile.ZipFile(output_path, "r") as archive:
        document_xml = archive.read("word/document.xml").decode("utf-8")

    assert "Table 1 " in document_xml
    assert "Demographic characteristics" in document_xml
    assert "Item" in document_xml
    assert "Value" in document_xml
    assert "Age" in document_xml
    assert "54.2" in document_xml
    assert "03C7" in document_xml
    assert "insideV" in document_xml


def build_three_line_rebuild_snapshot() -> dict:
    def fact(value):
        return {"availability": "authoritative", "value": value}

    def paragraph_snapshot(
        paragraph_id: str,
        text: str,
        *,
        alignment: str = "left",
        italic: bool = False,
        symbol: dict | None = None,
    ) -> dict:
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

    def cell_style() -> dict:
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
            "vertical_alignment": fact("center"),
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


def write_table_docx(output_path: Path) -> None:
    document_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>表1 基线特征比较</w:t></w:r></w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblBorders>
          <w:top w:val="single"/>
          <w:bottom w:val="single"/>
          <w:insideV w:val="nil"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>项目</w:t></w:r></w:p></w:tc>
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
        <w:tc><w:p><w:r><w:t>基线</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>18</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>60.0</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:p><w:r><w:t>*P&lt;0.05 vs control</w:t></w:r></w:p>
  </w:body>
</w:document>"""

    write_docx(output_path, ["placeholder"])
    with zipfile.ZipFile(output_path, "r") as archive:
        entries = {name: archive.read(name) for name in archive.namelist()}
    entries["word/document.xml"] = document_xml.encode("utf-8")
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries.items():
            archive.writestr(name, content)


def write_advanced_table_docx(output_path: Path) -> None:
    document_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Table 1 Baseline characteristics</w:t></w:r></w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblBorders>
          <w:top w:val="single"/>
          <w:bottom w:val="single"/>
          <w:insideV w:val="single"/>
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
    <w:p><w:r><w:t>Note: P&lt;0.05 vs control</w:t></w:r></w:p>
  </w:body>
</w:document>"""

    write_docx(output_path, ["placeholder"])
    with zipfile.ZipFile(output_path, "r") as archive:
        entries = {name: archive.read(name) for name in archive.namelist()}
    entries["word/document.xml"] = document_xml.encode("utf-8")
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries.items():
            archive.writestr(name, content)
