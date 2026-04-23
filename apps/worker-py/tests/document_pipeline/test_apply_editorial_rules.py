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

    with zipfile.ZipFile(output_path, "r") as archive:
        output_xml = archive.read("word/document.xml").decode("utf-8")

    assert "<w:t>5 mg </w:t>" in output_xml
    assert "<w:t>per dL</w:t>" in output_xml


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
