from __future__ import annotations

from xml.etree import ElementTree as ET


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
            paragraphs.append(
                {
                    "text": text,
                    "style": style,
                }
            )

            if normalize_style_name(style) in HEADING_STYLE_LEVELS:
                section = {
                    "order": len(sections) + 1,
                    "heading": text,
                    "level": HEADING_STYLE_LEVELS[normalize_style_name(style)],
                    "paragraph_index": paragraph_index,
                }
                sections.append(section)
                blocks.append(
                    {
                        "kind": "heading",
                        **section,
                    }
                )
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

        row_count, column_count, cells = extract_table_dimensions(child)
        table_entry = {
            "order": len(tables) + 1,
            "row_count": row_count,
            "column_count": column_count,
            "caption": pending_table_caption,
            "notes": [],
            "cells": cells,
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


def extract_table_dimensions(node: ET.Element) -> tuple[int, int, list[list[str]]]:
    rows = node.findall("./w:tr", NS)
    cell_rows: list[list[str]] = []

    for row in rows:
        cells = row.findall("./w:tc", NS)
        cell_rows.append([extract_node_text(cell).strip() for cell in cells])

    row_count = len(cell_rows)
    column_count = max((len(row) for row in cell_rows), default=0)
    return row_count, column_count, cell_rows


def is_table_caption(text: str) -> bool:
    stripped = text.strip()
    return stripped.startswith("表") or stripped.lower().startswith("table")


def is_table_note(text: str) -> bool:
    stripped = text.strip()
    return (
        stripped.startswith("注：")
        or stripped.startswith("注:")
        or stripped.lower().startswith("note:")
        or stripped.lower().startswith("notes:")
    )
