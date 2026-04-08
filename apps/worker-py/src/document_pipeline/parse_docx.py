from __future__ import annotations

from xml.etree import ElementTree as ET

from document_pipeline.table_semantics import build_table_semantic_snapshot


HEADING_STYLE_LEVELS = {
    "title": 0,
    "heading 1": 1,
    "heading 2": 2,
    "heading 3": 3,
}

WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": WORD_NS}


def normalize_style_name(style_name: str | None) -> str:
    return (style_name or "").strip().lower()


def extract_structure_from_paragraphs(paragraphs: list[dict]) -> dict:
    sections: list[dict] = []

    for index, paragraph in enumerate(paragraphs):
        text = (paragraph.get("text") or "").strip()
        style = normalize_style_name(paragraph.get("style"))

        if not text or style not in HEADING_STYLE_LEVELS:
            continue

        sections.append(
            {
                "order": len(sections) + 1,
                "heading": text,
                "level": HEADING_STYLE_LEVELS[style],
                "paragraph_index": index,
            }
        )

    if not sections:
        return {
            "status": "needs_manual_review",
            "parser": "python_docx",
            "sections": [],
            "warnings": ["No title or heading styles were detected in the document."],
        }

    return {
        "status": "ready",
        "parser": "python_docx",
        "sections": sections,
        "warnings": [],
    }


def extract_structure_from_document_xml(document_xml: bytes | str) -> dict:
    root = ET.fromstring(document_xml)
    body = root.find("w:body", NS)
    if body is None:
        return {
            "status": "needs_manual_review",
            "parser": "python_docx_ooxml",
            "sections": [],
            "blocks": [],
            "tables": [],
            "warnings": ["The document body could not be parsed from OOXML."],
        }

    paragraphs: list[dict] = []
    sections: list[dict] = []
    blocks: list[dict] = []
    tables: list[dict] = []
    pending_table_caption: str | None = None

    for child in list(body):
        if child.tag == qualify("p"):
            text = extract_node_text(child).strip()
            if not text:
                continue

            style = extract_paragraph_style(child)
            paragraph_index = len(paragraphs)
            paragraphs.append({"text": text, "style": style})

            if normalize_style_name(style) in HEADING_STYLE_LEVELS:
                section = {
                    "order": len(sections) + 1,
                    "heading": text,
                    "level": HEADING_STYLE_LEVELS[normalize_style_name(style)],
                    "paragraph_index": paragraph_index,
                }
                sections.append(section)
                blocks.append({"kind": "heading", **section})
                pending_table_caption = None
                continue

            if is_table_caption(text):
                pending_table_caption = text
            elif is_table_note(text) and tables:
                tables[-1]["notes"].append(text)
            else:
                pending_table_caption = None

            blocks.append(
                {
                    "kind": "paragraph",
                    "text": text,
                    "style": style,
                    "paragraph_index": paragraph_index,
                }
            )
            continue

        if child.tag != qualify("tbl"):
            continue

        row_count, column_count, cells, raw_rows = extract_table_dimensions(child)
        table_entry = {
            "order": len(tables) + 1,
            "row_count": row_count,
            "column_count": column_count,
            "caption": pending_table_caption,
            "notes": [],
            "cells": cells,
            "raw_rows": raw_rows,
        }
        tables.append(table_entry)
        blocks.append(
            {
                "kind": "table",
                "table_index": len(tables) - 1,
                "caption": pending_table_caption,
                "row_count": row_count,
                "column_count": column_count,
            }
        )
        pending_table_caption = None

    warnings: list[str] = []
    if not sections:
        warnings.append("No title or heading styles were detected in the document.")

    if not paragraphs and not tables:
        return {
            "status": "needs_manual_review",
            "parser": "python_docx_ooxml",
            "sections": [],
            "blocks": [],
            "tables": [],
            "warnings": ["No readable paragraphs or tables were detected in the document."],
        }

    for table in tables:
        table["semantic"] = build_table_semantic_snapshot(
            table_index=table["order"],
            caption=table.get("caption"),
            notes=table.get("notes") or [],
            rows=table.get("raw_rows") or [],
        )

    return {
        "status": "ready",
        "parser": "python_docx_ooxml",
        "sections": sections,
        "blocks": blocks,
        "tables": tables,
        "warnings": warnings,
    }


def qualify(tag: str) -> str:
    return f"{{{WORD_NS}}}{tag}"


def extract_node_text(node: ET.Element) -> str:
    return "".join(text_node.text or "" for text_node in node.findall(".//w:t", NS))


def extract_paragraph_style(node: ET.Element) -> str | None:
    style = node.find("./w:pPr/w:pStyle", NS)
    if style is None:
        return None

    return style.attrib.get(qualify("val"))


def extract_table_dimensions(
    node: ET.Element,
) -> tuple[int, int, list[list[str]], list[list[dict]]]:
    rows = node.findall("./w:tr", NS)
    cell_rows: list[list[str]] = []
    raw_rows: list[list[dict]] = []

    for row in rows:
        cells = row.findall("./w:tc", NS)
        text_row: list[str] = []
        raw_row: list[dict] = []
        for cell in cells:
            text = extract_node_text(cell).strip()
            text_row.append(text)
            raw_row.append(
                {
                    "text": text,
                    "column_span": extract_grid_span(cell),
                    "row_span": extract_row_span(cell),
                }
            )
        cell_rows.append(text_row)
        raw_rows.append(raw_row)

    row_count = len(raw_rows)
    column_count = max(
        (sum(int(cell.get("column_span") or 1) for cell in row) for row in raw_rows),
        default=0,
    )
    return row_count, column_count, cell_rows, raw_rows


def extract_grid_span(node: ET.Element) -> int:
    grid_span = node.find("./w:tcPr/w:gridSpan", NS)
    if grid_span is None:
        return 1

    try:
        return int(grid_span.attrib.get(qualify("val"), "1"))
    except ValueError:
        return 1


def extract_row_span(node: ET.Element) -> int:
    vertical_merge = node.find("./w:tcPr/w:vMerge", NS)
    if vertical_merge is None:
        return 1
    return 2


def is_table_caption(text: str) -> bool:
    stripped = text.strip()
    return stripped.startswith("\u8868") or stripped.lower().startswith("table")


def is_table_note(text: str) -> bool:
    stripped = text.strip()
    return (
        stripped.startswith("\u6ce8\uff1a")
        or stripped.startswith("\u6ce8")
        or stripped.startswith("*P")
        or stripped.startswith("*p")
        or stripped.lower().startswith("note:")
        or stripped.lower().startswith("notes:")
    )
