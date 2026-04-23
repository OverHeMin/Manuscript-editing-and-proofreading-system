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


def test_apply_table_patches_supports_caption_and_note_zone_families_and_keeps_style_patch_guarded():
    root = build_advanced_document_root()

    results = apply_table_patches(
        root,
        [
            {
                "patch_id": "patch-caption",
                "rule_id": "rule-caption",
                "table_id": "table-1",
                "patch_type": "replace_table_caption_text",
                "anchor": {
                    "table_id": "table-1",
                    "semantic_target": "table_title",
                },
                "proposed_before": "Table 1 Baseline characteristics",
                "proposed_after": "Table 1 Demographic characteristics",
            },
            {
                "patch_id": "patch-note-zone",
                "rule_id": "rule-note-zone",
                "table_id": "table-1",
                "patch_type": "replace_table_note_text",
                "anchor": {
                    "table_id": "table-1",
                    "semantic_target": "note_zone",
                },
                "proposed_before": "Note: P<0.05 vs control",
                "proposed_after": "Note: P<0.05 compared with control",
            },
            {
                "patch_id": "patch-style",
                "rule_id": "rule-style",
                "table_id": "table-1",
                "patch_type": "apply_three_line_table_style",
                "anchor": {
                    "table_id": "table-1",
                    "semantic_target": "style_profile",
                },
                "proposed_after": "three_line_table",
            },
        ],
    )

    document_xml = ET.tostring(root, encoding="unicode")

    assert [entry["status"] for entry in results] == [
        "applied",
        "applied",
        "skipped_unsafe",
    ]
    assert "Table 1 Demographic characteristics" in document_xml
    assert "Note: P&lt;0.05 compared with control" in document_xml
    assert "insideV" in document_xml
    assert 'val="nil"' in document_xml
