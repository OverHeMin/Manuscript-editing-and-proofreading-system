from __future__ import annotations

import re
from xml.etree import ElementTree as ET

from .table_semantics import build_table_semantic_snapshot


HEADING_STYLE_LEVELS = {
    "title": 0,
    "heading 1": 1,
    "heading 2": 2,
    "heading 3": 3,
}

WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": WORD_NS}
NUMBERED_HEADING_RE = re.compile(r"^(\d+(?:\.\d+)*)\s+.+$")
AUTHOR_BIO_RE = re.compile(r"作者简介|作者信息")
CORRESPONDING_AUTHOR_RE = re.compile(r"通信作者|通讯作者")
FUNDING_RE = re.compile(r"基金项目|基金资助|资助项目")
CLASSIFICATION_RE = re.compile(r"中图分类号")
DOCUMENT_CODE_RE = re.compile(r"文献标志码|文献标识码")
INSTITUTION_RE = re.compile(
    r"(医院|大学|学院|研究所|中心|实验室|department|hospital|university|college|institute)",
    re.IGNORECASE,
)
OBJECT_EVIDENCE_TAGS = {
    "drawing",
    "pict",
    "object",
    "oleobject",
    "omath",
    "omathpara",
    "tbl",
    "txbxcontent",
}
OBJECT_TARGET_HINTS = (
    (re.compile(r"chi[- ]?square|卡方", re.IGNORECASE), "χ²"),
    (re.compile(r"\balpha\b|阿尔法", re.IGNORECASE), "α"),
    (re.compile(r"\bbeta\b|贝塔", re.IGNORECASE), "β"),
    (re.compile(r"plus[- ]?minus|正负", re.IGNORECASE), "±"),
    (re.compile(r"less than or equal|小于等于", re.IGNORECASE), "≤"),
    (re.compile(r"greater than or equal|大于等于", re.IGNORECASE), "≥"),
)


def normalize_style_name(style_name: str | None) -> str:
    return (style_name or "").strip().lower()


def extract_structure_from_paragraphs(paragraphs: list[dict]) -> dict:
    sections: list[dict] = []

    for index, paragraph in enumerate(paragraphs):
        text = (paragraph.get("text") or "").strip()
        style = normalize_style_name(paragraph.get("style"))

        if not text:
            continue

        inferred_level = (
            HEADING_STYLE_LEVELS[style]
            if style in HEADING_STYLE_LEVELS
            else infer_numbered_heading_level(text)
        )
        if inferred_level is None:
            continue

        sections.append(
            {
                "order": len(sections) + 1,
                "heading": text,
                "level": inferred_level,
                "paragraph_index": index,
            }
        )

    if not sections:
        return {
            "status": "needs_manual_review",
            "parser": "python_docx",
            "sections": [],
            "objects": [],
            "warnings": ["No title or heading styles were detected in the document."],
        }

    return {
        "status": "ready",
        "parser": "python_docx",
        "sections": sections,
        "objects": [],
        "warnings": [],
    }


def extract_structure_from_document_xml(
    document_xml: bytes | str,
    header_xml_parts: list[tuple[str, bytes | str]] | None = None,
    footer_xml_parts: list[tuple[str, bytes | str]] | None = None,
) -> dict:
    root = ET.fromstring(document_xml)
    body = root.find("w:body", NS)
    if body is None:
        return {
            "status": "needs_manual_review",
            "parser": "python_docx_ooxml",
            "sections": [],
            "blocks": [],
            "tables": [],
            "objects": [],
            "warnings": ["The document body could not be parsed from OOXML."],
        }

    paragraphs: list[dict] = []
    sections: list[dict] = []
    blocks: list[dict] = []
    tables: list[dict] = []
    objects: list[dict] = []
    pending_table_caption: dict | None = None
    body_children = list(body)
    body_paragraph_count = sum(
        1
        for child in body_children
        if child.tag == qualify("p")
        and (extract_node_text(child).strip() or paragraph_contains_object(child))
    )
    body_paragraph_index = 0
    current_section = "front_matter"

    for child in body_children:
        if child.tag == qualify("p"):
            text = extract_node_text(child).strip()
            source_locator = f"body:p:{body_paragraph_index}"
            paragraph_source_zone = (
                "front_matter" if current_section == "front_matter" else "body"
            )
            object_entries = extract_paragraph_object_evidence(
                child,
                source_zone=paragraph_source_zone,
                source_locator=source_locator,
                container_kind="paragraph",
                paragraph_text=text,
            )
            if not text and not object_entries:
                continue
            if object_entries:
                objects.extend(object_entries)
            if not text:
                body_paragraph_index += 1
                pending_table_caption = None
                continue

            style = extract_paragraph_style(child)
            paragraph_index = len(paragraphs)
            paragraphs.append({"text": text, "style": style})
            semantic_role = infer_metadata_semantic_role(text)
            source_zone = infer_body_source_zone(
                text=text,
                style=style,
                paragraph_index=body_paragraph_index,
                paragraph_total=body_paragraph_count,
                current_section=current_section,
                semantic_role=semantic_role,
            )
            confidence = infer_metadata_confidence(
                semantic_role=semantic_role,
                source_zone=source_zone,
            )
            body_paragraph_index += 1

            inferred_level = (
                HEADING_STYLE_LEVELS[normalize_style_name(style)]
                if normalize_style_name(style) in HEADING_STYLE_LEVELS
                else infer_numbered_heading_level(text)
            )
            if inferred_level is not None:
                current_section = classify_heading_section_key(text)
                section = {
                    "order": len(sections) + 1,
                    "heading": text,
                    "level": inferred_level,
                    "paragraph_index": paragraph_index,
                }
                sections.append(section)
                blocks.append(
                    {
                        "kind": "heading",
                        **section,
                        "source_zone": source_zone,
                        "source_locator": source_locator,
                        "semantic_role": semantic_role,
                        "confidence": confidence,
                    }
                )
                pending_table_caption = None
                continue

            if is_table_caption(text):
                pending_table_caption = extract_paragraph_snapshot(child)
            elif is_table_note(text) and tables:
                note_snapshot = extract_paragraph_snapshot(child)
                tables[-1]["notes"].append(note_snapshot["text"])
                tables[-1]["note_paragraphs"].append(note_snapshot)
            else:
                pending_table_caption = None

            blocks.append(
                {
                    "kind": "paragraph",
                    "text": text,
                    "style": style,
                    "paragraph_index": paragraph_index,
                    "source_zone": source_zone,
                    "source_locator": source_locator,
                    "semantic_role": semantic_role,
                    "confidence": confidence,
                }
            )
            continue

        if child.tag != qualify("tbl"):
            continue

        table_order = len(tables) + 1
        row_count, column_count, cells, raw_rows, border_hints, table_objects = extract_table_dimensions(
            child,
            table_index=table_order,
            source_zone=current_section if current_section == "front_matter" else "body",
        )
        caption_text = pending_table_caption["text"] if pending_table_caption else None
        table_entry = {
            "order": table_order,
            "row_count": row_count,
            "column_count": column_count,
            "caption": caption_text,
            "caption_paragraphs": [pending_table_caption] if pending_table_caption else [],
            "notes": [],
            "note_paragraphs": [],
            "cells": cells,
            "raw_rows": raw_rows,
            "border_hints": border_hints,
        }
        tables.append(table_entry)
        objects.extend(table_objects)
        blocks.append(
            {
                "kind": "table",
                "table_index": len(tables) - 1,
                "caption": caption_text,
                "row_count": row_count,
                "column_count": column_count,
                "source_zone": current_section if current_section == "front_matter" else "body",
                "source_locator": f"body:table:{len(tables) - 1}",
            }
        )
        pending_table_caption = None

    header_blocks, header_objects = extract_header_footer_content(
        header_xml_parts or [],
        "header",
    )
    footer_blocks, footer_objects = extract_header_footer_content(
        footer_xml_parts or [],
        "footer",
    )
    blocks.extend(header_blocks)
    blocks.extend(footer_blocks)
    objects.extend(header_objects)
    objects.extend(footer_objects)

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
            "objects": objects,
            "warnings": ["No readable paragraphs or tables were detected in the document."],
        }

    for table in tables:
        table["semantic"] = build_table_semantic_snapshot(
            table_index=table["order"],
            caption=table.get("caption"),
            caption_paragraphs=table.get("caption_paragraphs") or [],
            notes=table.get("notes") or [],
            note_paragraphs=table.get("note_paragraphs") or [],
            rows=table.get("raw_rows") or [],
            border_hints=table.get("border_hints") or {},
        )

    return {
        "status": "ready",
        "parser": "python_docx_ooxml",
        "sections": sections,
        "blocks": blocks,
        "tables": tables,
        "objects": objects,
        "warnings": warnings,
    }


def qualify(tag: str) -> str:
    return f"{{{WORD_NS}}}{tag}"


def local_name(tag: str) -> str:
    return tag.split("}", 1)[-1].lower() if "}" in tag else tag.lower()


def paragraph_contains_object(node: ET.Element) -> bool:
    return any(local_name(child.tag) in OBJECT_EVIDENCE_TAGS for child in node.iter())


def extract_paragraph_object_evidence(
    node: ET.Element,
    *,
    source_zone: str,
    source_locator: str,
    container_kind: str,
    paragraph_text: str,
) -> list[dict]:
    objects: list[dict] = []
    for index, child in enumerate(node.iter()):
        if child is node or local_name(child.tag) not in OBJECT_EVIDENCE_TAGS:
            continue

        kind = classify_object_kind(child)
        evidence_text = extract_object_evidence_text(child)
        objects.append(
            {
                "object_id": f"{source_locator}:object:{len(objects)}",
                "object_kind": kind,
                "container_kind": container_kind,
                "source_zone": source_zone,
                "source_locator": source_locator,
                "original_tag": local_name(child.tag),
                **(
                    {"relationship_id": relationship_id}
                    if (relationship_id := extract_object_relationship_id(child))
                    else {}
                ),
                **({"evidence_text": evidence_text} if evidence_text else {}),
                **({"surrounding_text": paragraph_text} if paragraph_text else {}),
                **(
                    {"intended_target": intended_target}
                    if (
                        intended_target := infer_object_intended_target(
                            paragraph_text,
                            evidence_text,
                        )
                    )
                    else {}
                ),
            }
        )
    return objects


def classify_object_kind(node: ET.Element) -> str:
    tag = local_name(node.tag)
    if tag == "txbxcontent" and node.findall(".//w:tbl", NS):
        return "text_box_table"
    if tag == "tbl":
        return "nested_table"
    if tag in {"omath", "omathpara"}:
        return "equation"
    if tag in {"object", "oleobject"}:
        return "embedded_object"
    if any(local_name(child.tag) == "chart" for child in node.iter()):
        return "chart"
    if tag == "drawing":
        if looks_like_ocr_image_table(extract_object_evidence_text(node)):
            return "ocr_image_table"
        return "image" if extract_object_relationship_id(node) else "drawing"
    if tag == "pict":
        if looks_like_ocr_image_table(extract_object_evidence_text(node)):
            return "ocr_image_table"
        return "image"
    return "unknown"


def extract_object_evidence_text(node: ET.Element) -> str | None:
    parts: list[str] = []
    for child in node.iter():
        for attribute in ("descr", "title", "name", "progid"):
            value = read_attribute_by_local_name(child, attribute)
            if value and value not in parts:
                parts.append(value)
    if local_name(node.tag) == "tbl":
        rows = node.findall(".//w:tr", NS)
        cells = node.findall(".//w:tc", NS)
        parts.append(f"nested_table rows={len(rows)} cells={len(cells)}")
    if local_name(node.tag) == "txbxcontent" and node.findall(".//w:tbl", NS):
        rows = node.findall(".//w:tbl//w:tr", NS)
        cells = node.findall(".//w:tbl//w:tc", NS)
        parts.append(f"text_box_table rows={len(rows)} cells={len(cells)}")
    return "?".join(parts) if parts else None


def extract_object_relationship_id(node: ET.Element) -> str | None:
    for child in node.iter():
        for attribute in ("embed", "link"):
            value = read_attribute_by_local_name(child, attribute)
            if value:
                return value
    for child in node.iter():
        for attribute in ("id",):
            value = read_attribute_by_local_name(child, attribute)
            if value:
                return value
    return None


def read_attribute_by_local_name(node: ET.Element, target: str) -> str | None:
    for key, value in node.attrib.items():
        if local_name(key) == target and value.strip():
            return value.strip()
    return None


def infer_object_intended_target(*values: str | None) -> str | None:
    combined = " ".join(value for value in values if value).strip()
    if not combined:
        return None

    if looks_like_ocr_image_table(combined):
        return "manual_ocr_table_review"

    for pattern, target in OBJECT_TARGET_HINTS:
        if pattern.search(combined):
            return target
    return None


def looks_like_ocr_image_table(value: str | None) -> bool:
    if not value:
        return False

    normalized = value.lower()
    return ("ocr" in normalized and "table" in normalized) or "scanned table" in normalized


def extract_node_text(node: ET.Element) -> str:
    return "".join(text_node.text or "" for text_node in node.findall(".//w:t", NS))


def extract_paragraph_style(node: ET.Element) -> str | None:
    style = node.find("./w:pPr/w:pStyle", NS)
    if style is None:
        return None

    return style.attrib.get(qualify("val"))


def extract_paragraph_snapshot(node: ET.Element) -> dict:
    fragments = extract_paragraph_fragments(node)
    text = "".join(fragment.get("text") or "" for fragment in fragments)
    return {
        "text": text,
        "style": extract_paragraph_style_evidence(node),
        "fragments": fragments,
    }


def extract_paragraph_fragments(node: ET.Element) -> list[dict]:
    fragments: list[dict] = []
    for child in list(node):
        if child.tag == qualify("r"):
            fragments.extend(extract_run_fragments(child))
            continue
        if child.tag == qualify("hyperlink"):
            for run in child.findall("./w:r", NS):
                fragments.extend(extract_run_fragments(run))
    return fragments


def extract_run_fragments(run: ET.Element) -> list[dict]:
    fragments: list[dict] = []
    style = extract_run_style_evidence(run)

    for child in list(run):
        if child.tag == qualify("rPr"):
            continue
        if child.tag == qualify("t"):
            text = child.text or ""
            if text:
                fragments.append(
                    {
                        "kind": "text",
                        "text": text,
                        "style": style,
                    }
                )
            continue
        if child.tag == qualify("tab"):
            fragments.append(
                {
                    "kind": "tab",
                    "text": "\t",
                    "style": style,
                }
            )
            continue
        if child.tag == qualify("br") or child.tag == qualify("cr"):
            fragments.append(
                {
                    "kind": "line_break",
                    "text": "\n",
                    "style": style,
                }
            )
            continue
        if child.tag == qualify("sym"):
            symbol_char = (child.attrib.get(qualify("char")) or "").strip()
            symbol_font = (child.attrib.get(qualify("font")) or "").strip() or None
            fragments.append(
                {
                    "kind": "symbol",
                    "text": decode_symbol_text(symbol_char),
                    "symbol_char": symbol_char or None,
                    "symbol_font": symbol_font,
                    "style": extract_run_style_evidence(
                        run, symbol_font_override=symbol_font
                    ),
                }
            )
            continue
        if local_name(child.tag) in OBJECT_EVIDENCE_TAGS:
            kind = classify_object_kind(child)
            evidence_text = extract_object_evidence_text(child)
            fragments.append(
                {
                    "kind": "object",
                    "text": "",
                    "object_kind": kind,
                    "original_tag": local_name(child.tag),
                    **(
                        {"relationship_id": relationship_id}
                        if (relationship_id := extract_object_relationship_id(child))
                        else {}
                    ),
                    **({"evidence_text": evidence_text} if evidence_text else {}),
                    "style": style,
                }
            )

    return fragments


def extract_run_style_evidence(
    run: ET.Element,
    *,
    symbol_font_override: str | None = None,
) -> dict:
    properties = run.find("./w:rPr", NS)
    return {
        "font_family": make_style_fact(
            symbol_font_override or extract_run_font_family(properties)
        ),
        "font_size_pt": make_style_fact(extract_run_font_size_pt(properties)),
        "bold": make_style_fact(extract_on_off_property(properties, "b")),
        "italic": make_style_fact(extract_on_off_property(properties, "i")),
        "script_position": make_style_fact(extract_script_position(properties)),
    }


def extract_paragraph_style_evidence(node: ET.Element) -> dict:
    properties = node.find("./w:pPr", NS)
    spacing = properties.find("./w:spacing", NS) if properties is not None else None
    line_spacing, line_spacing_mode = extract_line_spacing(spacing)
    indent = properties.find("./w:ind", NS) if properties is not None else None
    return {
        "alignment": make_style_fact(extract_paragraph_alignment(properties)),
        "spacing_before_pt": make_style_fact(
            read_twips_pt(spacing.attrib.get(qualify("before"))) if spacing is not None else None
        ),
        "spacing_after_pt": make_style_fact(
            read_twips_pt(spacing.attrib.get(qualify("after"))) if spacing is not None else None
        ),
        "line_spacing": make_style_fact(line_spacing),
        "line_spacing_mode": make_style_fact(line_spacing_mode),
        "left_indent_pt": make_style_fact(
            read_twips_pt(indent.attrib.get(qualify("left"))) if indent is not None else None
        ),
        "right_indent_pt": make_style_fact(
            read_twips_pt(indent.attrib.get(qualify("right"))) if indent is not None else None
        ),
        "first_line_indent_pt": make_style_fact(
            read_twips_pt(indent.attrib.get(qualify("firstLine")))
            if indent is not None
            else None
        ),
        "hanging_indent_pt": make_style_fact(
            read_twips_pt(indent.attrib.get(qualify("hanging")))
            if indent is not None
            else None
        ),
    }


def extract_table_dimensions(
    node: ET.Element,
    *,
    table_index: int,
    source_zone: str,
) -> tuple[int, int, list[list[str]], list[list[dict]], dict, list[dict]]:
    rows = node.findall("./w:tr", NS)
    cell_rows: list[list[str]] = []
    raw_rows: list[list[dict]] = []
    objects: list[dict] = []

    for row_index, row in enumerate(rows):
        cells = row.findall("./w:tc", NS)
        text_row: list[str] = []
        raw_row: list[dict] = []
        for cell_index, cell in enumerate(cells):
            paragraphs = extract_table_cell_paragraphs(cell)
            display_text = build_table_cell_display_text(paragraphs)
            cell_objects = extract_table_cell_object_evidence(
                cell,
                table_index=table_index,
                row_index=row_index,
                cell_index=cell_index,
                source_zone=source_zone,
            )
            objects.extend(
                cell_objects
            )
            text = display_text.strip()
            text_row.append(text)
            raw_row.append(
                {
                    "text": text,
                    "display_text": display_text,
                    "normalized_text": normalize_table_cell_text(display_text),
                    "raw_xml_text": ET.tostring(cell, encoding="unicode"),
                    "style_runs": flatten_table_cell_style_runs(paragraphs),
                    "column_span": extract_grid_span(cell),
                    "row_span": extract_row_span(cell),
                    "borders": extract_cell_border_hints(cell),
                    "vertical_alignment": extract_cell_vertical_alignment(cell),
                    "text_direction": extract_cell_text_direction(cell),
                    "paragraphs": paragraphs,
                    "object_evidence": cell_objects,
                }
            )
        cell_rows.append(text_row)
        raw_rows.append(raw_row)

    row_count = len(raw_rows)
    column_count = max(
        (sum(int(cell.get("column_span") or 1) for cell in row) for row in raw_rows),
        default=0,
    )
    return (
        row_count,
        column_count,
        cell_rows,
        raw_rows,
        extract_table_border_hints(node),
        objects,
    )


def build_table_cell_display_text(paragraphs: list[dict]) -> str:
    return "\n".join(
        paragraph.get("text", "")
        for paragraph in paragraphs
        if (paragraph.get("text") or "").strip()
    )


def normalize_table_cell_text(text: str) -> str:
    normalized = " ".join(part.strip() for part in text.splitlines() if part.strip())
    normalized = re.sub(r"\s+", " ", normalized).strip()
    normalized = re.sub(r"\s*±\s*", "±", normalized)
    normalized = re.sub(r"\s*([<>=≤≥])\s*", r"\1", normalized)
    normalized = re.sub(r"\s*([;；])\s*", r"\1", normalized)
    return normalized


def flatten_table_cell_style_runs(paragraphs: list[dict]) -> list[dict]:
    style_runs: list[dict] = []
    for paragraph_index, paragraph in enumerate(paragraphs):
        fragments = paragraph.get("fragments") if isinstance(paragraph, dict) else None
        if not isinstance(fragments, list):
            continue
        for fragment_index, fragment in enumerate(fragments):
            if not isinstance(fragment, dict):
                continue
            text = fragment.get("text") or ""
            if not text:
                continue
            style = fragment.get("style") if isinstance(fragment.get("style"), dict) else {}
            style_runs.append(
                {
                    "text": text,
                    "kind": fragment.get("kind") or "text",
                    "paragraph_index": paragraph_index,
                    "fragment_index": fragment_index,
                    "font_family": read_style_fact_value(style.get("font_family")),
                    "font_size_pt": read_style_fact_value(style.get("font_size_pt")),
                    "bold": read_style_fact_value(style.get("bold")),
                    "italic": read_style_fact_value(style.get("italic")),
                    "script_position": read_style_fact_value(
                        style.get("script_position")
                    ),
                }
            )
    return style_runs


def read_style_fact_value(value: object) -> object:
    if not isinstance(value, dict):
        return None
    if value.get("availability") != "authoritative":
        return None
    return value.get("value")


def extract_table_cell_object_evidence(
    node: ET.Element,
    *,
    table_index: int,
    row_index: int,
    cell_index: int,
    source_zone: str,
) -> list[dict]:
    objects: list[dict] = []
    direct_text = " ".join(
        extract_node_text(paragraph).strip()
        for paragraph in node.findall("./w:p", NS)
        if extract_node_text(paragraph).strip()
    ).strip()
    for nested_index, nested_table in enumerate(node.findall("./w:tbl", NS)):
        source_locator = (
            f"body:table:{table_index - 1}:cell:{row_index}:{cell_index}:nested_table:{nested_index}"
        )
        evidence_text = extract_object_evidence_text(nested_table)
        objects.append(
            {
                "object_id": f"{source_locator}:object:0",
                "object_kind": "nested_table",
                "container_kind": "table_cell",
                "source_zone": source_zone,
                "source_locator": source_locator,
                "original_tag": "tbl",
                **({"evidence_text": evidence_text} if evidence_text else {}),
                **({"surrounding_text": direct_text} if direct_text else {}),
                "intended_target": "preserve_as_nested_table",
            }
        )
    for text_box_index, text_box in enumerate(node.findall(".//w:txbxContent", NS)):
        if not text_box.findall(".//w:tbl", NS):
            continue
        source_locator = (
            f"body:table:{table_index - 1}:cell:{row_index}:{cell_index}:text_box_table:{text_box_index}"
        )
        evidence_text = extract_object_evidence_text(text_box)
        objects.append(
            {
                "object_id": f"{source_locator}:object:0",
                "object_kind": "text_box_table",
                "container_kind": "table_cell",
                "source_zone": source_zone,
                "source_locator": source_locator,
                "original_tag": "txbxcontent",
                **({"evidence_text": evidence_text} if evidence_text else {}),
                **({"surrounding_text": direct_text} if direct_text else {}),
                "intended_target": "preserve_as_text_box_table",
            }
        )
    for paragraph_index, paragraph in enumerate(node.findall("./w:p", NS)):
        text = extract_node_text(paragraph).strip()
        source_locator = (
            f"body:table:{table_index - 1}:cell:{row_index}:{cell_index}:p:{paragraph_index}"
        )
        objects.extend(
            extract_paragraph_object_evidence(
                paragraph,
                source_zone=source_zone,
                source_locator=source_locator,
                container_kind="table_cell",
                paragraph_text=text,
            )
        )
    return objects


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


def extract_cell_vertical_alignment(node: ET.Element) -> str | None:
    vertical_align = node.find("./w:tcPr/w:vAlign", NS)
    if vertical_align is None:
        return None

    value = (vertical_align.attrib.get(qualify("val")) or "").strip().lower()
    return value or None


def extract_cell_text_direction(node: ET.Element) -> str | None:
    text_direction = node.find("./w:tcPr/w:textDirection", NS)
    if text_direction is None:
        return None

    value = (text_direction.attrib.get(qualify("val")) or "").strip()
    return value or None


def extract_table_border_hints(node: ET.Element) -> dict:
    borders = node.find("./w:tblPr/w:tblBorders", NS)
    if borders is None:
        return {}

    hints = {}
    for side in ("top", "bottom", "left", "right", "insideH", "insideV"):
        if _read_border_enabled(borders.find(f"./w:{side}", NS)):
            normalized_side = {
                "insideH": "inside_horizontal",
                "insideV": "inside_vertical",
            }.get(side, side)
            hints[normalized_side] = True
    return hints


def extract_cell_border_hints(node: ET.Element) -> dict:
    borders = node.find("./w:tcPr/w:tcBorders", NS)
    if borders is None:
        return {}

    hints = {}
    for side in ("top", "bottom", "left", "right"):
        if _read_border_enabled(borders.find(f"./w:{side}", NS)):
            hints[side] = True
    return hints


def extract_table_cell_paragraphs(node: ET.Element) -> list[dict]:
    paragraphs: list[dict] = []
    for paragraph in node.findall("./w:p", NS):
        snapshot = extract_paragraph_snapshot(paragraph)
        if snapshot["text"] or snapshot["fragments"]:
            paragraphs.append(snapshot)
    return paragraphs


def _read_border_enabled(node: ET.Element | None) -> bool:
    if node is None:
        return False

    value = (node.attrib.get(qualify("val")) or "single").strip().lower()
    return value not in {"nil", "none"}


def extract_run_font_family(properties: ET.Element | None) -> str | None:
    if properties is None:
        return None

    fonts = properties.find("./w:rFonts", NS)
    if fonts is None:
        return None

    for attribute in ("ascii", "hAnsi", "eastAsia", "cs"):
        value = (fonts.attrib.get(qualify(attribute)) or "").strip()
        if value:
            return value
    return None


def extract_run_font_size_pt(properties: ET.Element | None) -> float | None:
    if properties is None:
        return None

    size = properties.find("./w:sz", NS)
    if size is None:
        return None

    try:
        return int(size.attrib.get(qualify("val"), "0")) / 2
    except ValueError:
        return None


def extract_on_off_property(properties: ET.Element | None, key: str) -> bool | None:
    if properties is None:
        return None

    node = properties.find(f"./w:{key}", NS)
    if node is None:
        return None

    value = (node.attrib.get(qualify("val")) or "true").strip().lower()
    return value not in {"false", "0", "off"}


def extract_script_position(properties: ET.Element | None) -> str | None:
    if properties is None:
        return None

    vertical_align = properties.find("./w:vertAlign", NS)
    if vertical_align is None:
        return None

    value = (vertical_align.attrib.get(qualify("val")) or "").strip().lower()
    if value == "superscript":
        return "superscript"
    if value == "subscript":
        return "subscript"
    return "baseline" if value else None


def extract_paragraph_alignment(properties: ET.Element | None) -> str | None:
    if properties is None:
        return None

    alignment = properties.find("./w:jc", NS)
    if alignment is None:
        return None

    value = (alignment.attrib.get(qualify("val")) or "").strip().lower()
    return value or None


def extract_line_spacing(spacing: ET.Element | None) -> tuple[float | None, str | None]:
    if spacing is None:
        return None, None

    raw_line = spacing.attrib.get(qualify("line"))
    if raw_line is None:
        return None, None

    try:
        numeric = int(raw_line)
    except ValueError:
        return None, None

    rule = (spacing.attrib.get(qualify("lineRule")) or "auto").strip().lower()
    if rule == "exact":
        return numeric / 20, "exact_pt"
    if rule == "atleast":
        return numeric / 20, "at_least_pt"
    return numeric / 240, "multiple"


def read_twips_pt(value: str | None) -> float | None:
    if value is None:
        return None

    try:
        return int(value) / 20
    except ValueError:
        return None


def make_style_fact(value: object) -> dict:
    if value is None:
        return {"availability": "unavailable"}
    return {
        "availability": "authoritative",
        "value": value,
    }


def decode_symbol_text(symbol_char: str | None) -> str:
    if not symbol_char:
        return ""
    try:
        return chr(int(symbol_char, 16))
    except ValueError:
        return ""


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


def infer_numbered_heading_level(text: str) -> int | None:
    stripped = text.strip()
    if is_table_caption(stripped):
        return None

    match = NUMBERED_HEADING_RE.match(stripped)
    if not match:
        return None

    number_token = match.group(1)
    return number_token.count(".") + 1


def classify_heading_section_key(text: str) -> str:
    normalized = text.strip().lower().replace(" ", "")
    if "参考文献" in text or "references" in normalized:
        return "reference"
    if "摘要" in text or "abstract" in normalized or "关键词" in text or "keyword" in normalized:
        return "abstract"
    if normalized.startswith("2") or "结果" in text or "results" in normalized:
        return "results"
    return "body"


def infer_body_source_zone(
    *,
    text: str,
    style: str | None,
    paragraph_index: int,
    paragraph_total: int,
    current_section: str,
    semantic_role: str | None,
) -> str:
    normalized_style = normalize_style_name(style)
    if paragraph_index == 0 or normalized_style == "title":
        return "title_area"
    if current_section == "front_matter":
        return "front_matter"
    if current_section == "abstract" or "摘要" in text or "关键词" in text:
        return "abstract_neighborhood"
    if paragraph_index >= max(paragraph_total - 3, 0) or looks_like_tail_declaration(text):
        return "document_tail"
    if semantic_role:
        return "suspicious_nearby_paragraph"
    return "body"


def extract_header_footer_content(
    xml_parts: list[tuple[str, bytes | str]],
    zone: str,
) -> tuple[list[dict], list[dict]]:
    blocks: list[dict] = []
    objects: list[dict] = []
    for part_name, xml_bytes in xml_parts:
        root = ET.fromstring(xml_bytes)
        paragraph_index = 0
        for paragraph in root.findall(".//w:p", NS):
            text = extract_node_text(paragraph).strip()
            source_locator = f"{zone}:{part_name}:p:{paragraph_index}"
            object_entries = extract_paragraph_object_evidence(
                paragraph,
                source_zone=zone,
                source_locator=source_locator,
                container_kind=zone,
                paragraph_text=text,
            )
            if object_entries:
                objects.extend(object_entries)
            if not text and not object_entries:
                continue
            if not text:
                paragraph_index += 1
                continue
            semantic_role = infer_metadata_semantic_role(text)
            blocks.append(
                {
                    "kind": "paragraph",
                    "text": text,
                    "style": extract_paragraph_style(paragraph),
                    "source_zone": zone,
                    "source_locator": source_locator,
                    "semantic_role": semantic_role,
                    "confidence": infer_metadata_confidence(
                        semantic_role=semantic_role,
                        source_zone=zone,
                    ),
                }
            )
            paragraph_index += 1
    return blocks, objects


def infer_metadata_semantic_role(text: str) -> str | None:
    if CORRESPONDING_AUTHOR_RE.search(text):
        return "corresponding_author_bio"
    if AUTHOR_BIO_RE.search(text):
        return "author_bio"
    if FUNDING_RE.search(text):
        return "funding_statement"
    if CLASSIFICATION_RE.search(text):
        return "classification_code"
    if DOCUMENT_CODE_RE.search(text):
        return "document_code"
    if INSTITUTION_RE.search(text):
        return "affiliation_line"
    if looks_like_author_line(text):
        return "author_line"
    return None


def infer_metadata_confidence(*, semantic_role: str | None, source_zone: str) -> float | None:
    if semantic_role in {
        "author_bio",
        "corresponding_author_bio",
        "funding_statement",
        "classification_code",
        "document_code",
    }:
        return 0.97
    if semantic_role == "affiliation_line":
        return 0.88
    if semantic_role == "author_line":
        return 0.84
    if source_zone in {"header", "footer"}:
        return 0.72
    return None


def looks_like_tail_declaration(text: str) -> bool:
    return bool(
        re.search(
            r"(基金项目|通信作者|通讯作者|作者简介|利益冲突|伦理|受试者|收稿日期|录用日期)",
            text,
        )
    )


def looks_like_author_line(text: str) -> bool:
    trimmed = text.strip()
    if (
        len(trimmed) == 0
        or len(trimmed) > 80
        or "：" in trimmed
        or ":" in trimmed
        or INSTITUTION_RE.search(trimmed)
    ):
        return False
    return bool(re.fullmatch(r"[\u4e00-\u9fffA-Za-z·,\s1-9*†‡、]+", trimmed)) and (
        " " in trimmed or "、" in trimmed or "," in trimmed
    )
