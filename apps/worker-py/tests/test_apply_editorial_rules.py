from __future__ import annotations

from html import escape
from pathlib import Path
import zipfile

from src.document_pipeline.apply_editorial_rules import apply_rules_to_docx
from src.document_pipeline.parse_docx import extract_structure_from_document_xml


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def make_paragraph(text: str, *, style: str | None = None) -> str:
    style_xml = (
        f'<w:pPr><w:pStyle w:val="{escape(style)}"/></w:pPr>' if style else ""
    )
    return (
        f"<w:p>{style_xml}<w:r><w:t xml:space=\"preserve\">{escape(text)}</w:t></w:r></w:p>"
    )


def make_table(rows: list[list[str]]) -> str:
    row_xml = []
    for row in rows:
        cell_xml = []
        for cell in row:
            cell_xml.append(
                "<w:tc>"
                "<w:p>"
                f"<w:r><w:t>{escape(cell)}</w:t></w:r>"
                "</w:p>"
                "</w:tc>"
            )
        row_xml.append(f"<w:tr>{''.join(cell_xml)}</w:tr>")
    return f"<w:tbl>{''.join(row_xml)}</w:tbl>"


def build_minimal_docx(path: Path, body_elements: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{W_NS}">'
        f"<w:body>{''.join(body_elements)}<w:sectPr/></w:body>"
        "</w:document>"
    )
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

    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types_xml)
        archive.writestr("_rels/.rels", rels_xml)
        archive.writestr("word/document.xml", document_xml)


def read_document_xml(path: Path) -> bytes:
    with zipfile.ZipFile(path, "r") as archive:
        return archive.read("word/document.xml")


def test_apply_rules_to_docx_replaces_exact_abstract_heading(tmp_path: Path) -> None:
    source_path = tmp_path / "source.docx"
    output_path = tmp_path / "output.docx"
    build_minimal_docx(
        source_path,
        [
            make_paragraph("摘要 目的"),
            make_paragraph("观察组与对照组比较。"),
        ],
    )

    result = apply_rules_to_docx(
        source_path,
        output_path,
        [
            {
                "id": "rule-abstract-1",
                "enabled": True,
                "rule_object": "abstract",
                "rule_type": "format",
                "execution_mode": "apply_and_inspect",
                "confidence_policy": "always_auto",
                "trigger": {
                    "kind": "exact_text",
                    "text": "摘要 目的",
                },
                "action": {
                    "kind": "replace_heading",
                    "to": "（摘要　目的）",
                },
            }
        ],
    )

    assert result["applied_rule_ids"] == ["rule-abstract-1"]
    assert result["inspection_findings"] == []
    assert result["applied_changes"] == [
        {
            "ruleId": "rule-abstract-1",
            "before": "摘要 目的",
            "after": "（摘要　目的）",
        }
    ]
    assert "（摘要　目的）" in read_document_xml(output_path).decode("utf-8")


def test_extract_structure_from_document_xml_surfaces_tables_captions_and_notes(
    tmp_path: Path,
) -> None:
    source_path = tmp_path / "structured.docx"
    build_minimal_docx(
        source_path,
        [
            make_paragraph("临床研究稿件", style="Title"),
            make_paragraph("表1 基线资料"),
            make_table(
                [
                    ["组别", "例数"],
                    ["治疗组", "30"],
                ]
            ),
            make_paragraph("注：计量资料以 x̄±s 表示。"),
        ],
    )

    structure = extract_structure_from_document_xml(read_document_xml(source_path))

    assert structure["status"] == "ready"
    assert structure["sections"][0]["heading"] == "临床研究稿件"
    assert len(structure["tables"]) == 1
    assert structure["tables"][0]["caption"] == "表1 基线资料"
    assert structure["tables"][0]["notes"] == ["注：计量资料以 x̄±s 表示。"]
    assert structure["tables"][0]["row_count"] == 2
    assert structure["tables"][0]["column_count"] == 2


def test_apply_rules_to_docx_reports_table_rules_for_manual_review(tmp_path: Path) -> None:
    source_path = tmp_path / "table-source.docx"
    output_path = tmp_path / "table-output.docx"
    build_minimal_docx(
        source_path,
        [
            make_paragraph("表1 基线资料"),
            make_table(
                [
                    ["组别", "例数"],
                    ["治疗组", "30"],
                ]
            ),
            make_paragraph("注：数据保留 2 位小数。"),
        ],
    )

    result = apply_rules_to_docx(
        source_path,
        output_path,
        [
            {
                "id": "rule-table-inspect",
                "enabled": True,
                "rule_object": "table",
                "rule_type": "format",
                "execution_mode": "inspect",
                "confidence_policy": "manual_only",
                "scope": {
                    "block_kind": "table",
                },
                "selector": {
                    "block_selector": "table",
                    "table_selector": {
                        "table_kind": "three_line_table",
                    },
                },
                "action": {
                    "kind": "inspect_table_rule",
                    "layout_requirement": "禁用竖线",
                },
            },
            {
                "id": "rule-table-auto-unsupported",
                "enabled": True,
                "rule_object": "table",
                "rule_type": "format",
                "execution_mode": "apply_and_inspect",
                "confidence_policy": "always_auto",
                "scope": {
                    "block_kind": "table",
                },
                "selector": {
                    "block_selector": "table",
                    "table_selector": {
                        "table_kind": "three_line_table",
                    },
                },
                "action": {
                    "kind": "rewrite_table_layout",
                    "layout_requirement": "三线表",
                },
            },
        ],
    )

    assert result["applied_rule_ids"] == []
    assert result["applied_changes"] == []
    assert result["inspection_findings"] == [
        {
            "ruleId": "rule-table-inspect",
            "blockType": "table",
            "tableIndex": 0,
            "caption": "表1 基线资料",
            "disposition": "inspect_only",
            "reason": "Table rules require deterministic inspection before manual editorial confirmation.",
        },
        {
            "ruleId": "rule-table-auto-unsupported",
            "blockType": "table",
            "tableIndex": 0,
            "caption": "表1 基线资料",
            "disposition": "manual_review_required",
            "reason": "Requested table auto-apply action is not implemented safely in phase 1.",
        },
    ]
    assert "表1 基线资料" in read_document_xml(output_path).decode("utf-8")
