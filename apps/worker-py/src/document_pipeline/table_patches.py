from __future__ import annotations

from dataclasses import dataclass, field
from xml.etree import ElementTree as ET

from .parse_docx import (
    NS,
    extract_grid_span,
    extract_node_text,
    extract_table_border_hints,
    is_table_caption,
    is_table_note,
    qualify,
)
from .table_semantics import build_table_semantic_snapshot


@dataclass
class TableRuntimeContext:
    table_id: str
    table_node: ET.Element
    caption: str | None
    caption_paragraph: ET.Element | None = None
    note_paragraphs: list[ET.Element] = field(default_factory=list)
    note_texts: list[str] = field(default_factory=list)
    raw_rows: list[list[dict]] = field(default_factory=list)
    border_hints: dict = field(default_factory=dict)
    snapshot: dict = field(default_factory=dict)
    expanded_rows: list[list[ET.Element]] = field(default_factory=list)


def apply_table_patches(root: ET.Element, table_patches: list[dict]) -> list[dict]:
    contexts = build_table_runtime_contexts(root)
    context_by_id = {context.table_id: context for context in contexts}
    return [_apply_single_patch(context_by_id, patch) for patch in table_patches]


def build_table_runtime_contexts(root: ET.Element) -> list[TableRuntimeContext]:
    body = root.find("w:body", NS)
    if body is None:
        return []

    contexts: list[TableRuntimeContext] = []
    pending_caption: str | None = None
    pending_caption_paragraph: ET.Element | None = None

    for child in list(body):
        if child.tag == qualify("p"):
            text = extract_node_text(child).strip()
            if not text:
                continue

            if is_table_caption(text):
                pending_caption = text
                pending_caption_paragraph = child
            elif is_table_note(text) and contexts:
                contexts[-1].note_paragraphs.append(child)
                contexts[-1].note_texts.append(text)
            else:
                pending_caption = None
                pending_caption_paragraph = None
            continue

        if child.tag != qualify("tbl"):
            continue

        raw_rows = _extract_raw_rows(child)
        contexts.append(
            TableRuntimeContext(
                table_id=f"table-{len(contexts) + 1}",
                table_node=child,
                caption=pending_caption,
                caption_paragraph=pending_caption_paragraph,
                raw_rows=raw_rows,
                border_hints=extract_table_border_hints(child),
            )
        )
        pending_caption = None
        pending_caption_paragraph = None

    for context in contexts:
        context.snapshot = build_table_semantic_snapshot(
            table_index=int(context.table_id.split("-")[-1]),
            rows=context.raw_rows,
            caption=context.caption,
            notes=context.note_texts,
            border_hints=context.border_hints,
        )
        context.expanded_rows = _expand_table_rows_with_nodes(context.table_node)

    return contexts


def _apply_single_patch(
    context_by_id: dict[str, TableRuntimeContext],
    patch: dict,
) -> dict:
    patch_type = patch.get("patch_type")
    if patch_type not in {
        "replace_table_caption_text",
        "replace_header_cell_text",
        "replace_footnote_text",
        "replace_table_note_text",
        "normalize_unit_text",
        "apply_three_line_table_style",
    }:
        return build_patch_result(
            patch,
            "skipped_unsafe",
            f'Unsupported table patch type "{patch_type}".',
        )

    table_id = patch.get("table_id")
    if not isinstance(table_id, str) or not table_id:
        return build_patch_result(
            patch,
            "skipped_no_anchor",
            "Patch is missing a concrete table_id anchor.",
        )

    context = context_by_id.get(table_id)
    if context is None:
        return build_patch_result(
            patch,
            "skipped_no_anchor",
            f'Table "{table_id}" was not found in the DOCX runtime context.',
        )

    if patch_type == "replace_table_caption_text":
        return apply_caption_patch(context, patch)
    if patch_type == "replace_header_cell_text":
        return apply_header_cell_patch(context, patch)
    if patch_type == "replace_table_note_text":
        return apply_note_zone_patch(context, patch)
    if patch_type == "apply_three_line_table_style":
        return build_patch_result(
            patch,
            "skipped_unsafe",
            "Style patch family is not yet safe for deterministic DOCX auto-apply.",
        )
    if patch_type == "normalize_unit_text":
        return apply_unit_marker_patch(context, patch)
    return apply_footnote_patch(context, patch)


def apply_caption_patch(context: TableRuntimeContext, patch: dict) -> dict:
    anchor = patch.get("anchor")
    if not isinstance(anchor, dict):
        return build_patch_result(
            patch,
            "skipped_no_anchor",
            "Caption patch is missing its semantic anchor payload.",
        )

    if anchor.get("semantic_target") not in {"table_label", "table_title"}:
        return build_patch_result(
            patch,
            "skipped_unsafe",
            "Caption patch anchor must target table_label or table_title.",
        )

    paragraph = find_caption_paragraph(context, anchor)
    if paragraph is None:
        return build_patch_result(
            patch,
            "skipped_no_anchor",
            "Caption anchor could not be resolved in the DOCX table context.",
        )

    replacement_text = read_required_replacement_text(patch)
    if replacement_text is None:
        return build_patch_result(
            patch,
            "skipped_unsafe",
            "Caption patch is missing proposed_after replacement text.",
        )

    current_text = extract_node_text(paragraph).strip()
    planned_before = read_optional_text(patch.get("proposed_before"))
    if planned_before is not None and current_text != planned_before:
        return build_patch_result(
            patch,
            "skipped_conflict",
            "Caption text did not match the planned replacement source text.",
        )

    replace_container_text(paragraph, replacement_text)
    context.caption = replacement_text
    return build_patch_result(patch, "applied", "Caption patch applied.")


def apply_header_cell_patch(context: TableRuntimeContext, patch: dict) -> dict:
    anchor = patch.get("anchor")
    if not isinstance(anchor, dict):
        return build_patch_result(
            patch,
            "skipped_no_anchor",
            "Header cell patch is missing its semantic anchor payload.",
        )

    if anchor.get("semantic_target") not in {None, "header_cell"}:
        return build_patch_result(
            patch,
            "skipped_unsafe",
            "Header cell patch anchor must target header_cell.",
        )

    cell = find_header_cell_node(context, anchor)
    if cell is None:
        return build_patch_result(
            patch,
            "skipped_no_anchor",
            "Header cell anchor could not be resolved in the DOCX table.",
        )

    replacement_text = read_required_replacement_text(patch)
    if replacement_text is None:
        return build_patch_result(
            patch,
            "skipped_unsafe",
            "Header cell patch is missing proposed_after replacement text.",
        )

    current_text = extract_node_text(cell).strip()
    planned_before = read_optional_text(patch.get("proposed_before"))
    if planned_before is not None and current_text != planned_before:
        return build_patch_result(
            patch,
            "skipped_conflict",
            "Header cell text did not match the planned replacement source text.",
        )

    replace_container_text(cell, replacement_text)
    return build_patch_result(patch, "applied", "Header cell patch applied.")


def apply_unit_marker_patch(context: TableRuntimeContext, patch: dict) -> dict:
    anchor = patch.get("anchor")
    if not isinstance(anchor, dict):
        return build_patch_result(
            patch,
            "skipped_no_anchor",
            "Unit marker patch is missing its semantic anchor payload.",
        )

    if anchor.get("semantic_target") not in {None, "unit_marker"}:
        return build_patch_result(
            patch,
            "skipped_unsafe",
            "Unit marker patch anchor must target unit_marker.",
        )

    cell = find_unit_marker_source_cell(context, anchor)
    if cell is None:
        return build_patch_result(
            patch,
            "skipped_no_anchor",
            "Unit marker anchor could not be resolved in the DOCX table.",
        )

    target_text = read_optional_text(patch.get("proposed_before"))
    replacement_text = read_required_replacement_text(patch)
    if target_text is None or replacement_text is None:
        return build_patch_result(
            patch,
            "skipped_unsafe",
            "Unit marker patches require both proposed_before and proposed_after text.",
        )

    current_text = extract_node_text(cell).strip()
    if target_text not in current_text:
        return build_patch_result(
            patch,
            "skipped_conflict",
            "Unit marker text did not match the planned replacement source text.",
        )

    next_text = current_text.replace(target_text, replacement_text, 1)
    if next_text == current_text:
        return build_patch_result(
            patch,
            "skipped_conflict",
            "Unit marker text did not change after applying the planned replacement.",
        )

    replace_container_text(cell, next_text)
    return build_patch_result(patch, "applied", "Unit marker patch applied.")


def apply_footnote_patch(context: TableRuntimeContext, patch: dict) -> dict:
    anchor = patch.get("anchor")
    if not isinstance(anchor, dict):
        return build_patch_result(
            patch,
            "skipped_no_anchor",
            "Footnote patch is missing its semantic anchor payload.",
        )

    if anchor.get("semantic_target") not in {None, "footnote_item"}:
        return build_patch_result(
            patch,
            "skipped_unsafe",
            "Footnote patch anchor must target footnote_item.",
        )

    paragraph = find_footnote_paragraph(context, anchor)
    if paragraph is None:
        return build_patch_result(
            patch,
            "skipped_no_anchor",
            "Footnote anchor could not be resolved in the DOCX table notes.",
        )

    replacement_text = read_required_replacement_text(patch)
    if replacement_text is None:
        return build_patch_result(
            patch,
            "skipped_unsafe",
            "Footnote patch is missing proposed_after replacement text.",
        )

    current_text = extract_node_text(paragraph).strip()
    planned_before = read_optional_text(patch.get("proposed_before"))
    if planned_before is not None and current_text != planned_before:
        return build_patch_result(
            patch,
            "skipped_conflict",
            "Footnote text did not match the planned replacement source text.",
        )

    replace_container_text(paragraph, replacement_text)
    return build_patch_result(patch, "applied", "Footnote patch applied.")


def apply_note_zone_patch(context: TableRuntimeContext, patch: dict) -> dict:
    anchor = patch.get("anchor")
    if not isinstance(anchor, dict):
        return build_patch_result(
            patch,
            "skipped_no_anchor",
            "Note zone patch is missing its semantic anchor payload.",
        )

    if anchor.get("semantic_target") != "note_zone":
        return build_patch_result(
            patch,
            "skipped_unsafe",
            "Note zone patch anchor must target note_zone.",
        )

    paragraphs = find_note_zone_paragraphs(context, anchor)
    if not paragraphs:
        return build_patch_result(
            patch,
            "skipped_no_anchor",
            "Note zone anchor could not be resolved in the DOCX table notes.",
        )

    replacement_text = read_required_replacement_text(patch)
    if replacement_text is None:
        return build_patch_result(
            patch,
            "skipped_unsafe",
            "Note zone patch is missing proposed_after replacement text.",
        )

    current_text = "\n".join(extract_node_text(paragraph).strip() for paragraph in paragraphs)
    planned_before = read_optional_text(patch.get("proposed_before"))
    if planned_before is not None and current_text != planned_before:
        return build_patch_result(
            patch,
            "skipped_conflict",
            "Note zone text did not match the planned replacement source text.",
        )

    replacement_lines = [line.strip() for line in replacement_text.splitlines() if line.strip()]
    if len(replacement_lines) != len(paragraphs):
        return build_patch_result(
            patch,
            "skipped_unsafe",
            "Note zone patch requires line-aligned replacements for each DOCX note paragraph.",
        )

    for paragraph, replacement_line in zip(paragraphs, replacement_lines):
        replace_container_text(paragraph, replacement_line)

    context.note_texts = replacement_lines
    return build_patch_result(patch, "applied", "Note zone patch applied.")


def find_header_cell_node(
    context: TableRuntimeContext,
    anchor: dict,
) -> ET.Element | None:
    header_entry = find_snapshot_entry(
        context.snapshot.get("header_cells") or [],
        anchor,
    )
    if header_entry is None:
        return None

    row_index = header_entry.get("row_index")
    column_index = header_entry.get("column_index")
    if not isinstance(row_index, int) or not isinstance(column_index, int):
        return None

    if row_index >= len(context.expanded_rows):
        return None
    if column_index >= len(context.expanded_rows[row_index]):
        return None
    return context.expanded_rows[row_index][column_index]


def find_caption_paragraph(
    context: TableRuntimeContext,
    anchor: dict,
) -> ET.Element | None:
    if context.caption_paragraph is None:
        return None

    target = normalize_optional_text(anchor.get("semantic_target"))
    if target == "table_label":
        entry = context.snapshot.get("table_label")
    elif target == "table_title":
        entry = context.snapshot.get("table_title")
    else:
        return None

    if not isinstance(entry, dict):
        return None

    coordinate = entry.get("coordinate")
    if not isinstance(coordinate, dict) or not anchor_matches_coordinate(anchor, coordinate):
        return None

    return context.caption_paragraph


def find_unit_marker_source_cell(
    context: TableRuntimeContext,
    anchor: dict,
) -> ET.Element | None:
    marker_entry = find_snapshot_entry(
        context.snapshot.get("unit_markers") or [],
        anchor,
    )
    if marker_entry is None:
        return None

    coordinate = marker_entry.get("coordinate")
    if not isinstance(coordinate, dict):
        return None

    return find_header_cell_node(
        context,
        {
            "table_id": coordinate.get("table_id"),
            "semantic_target": "header_cell",
            "header_path": coordinate.get("header_path"),
            "column_key": coordinate.get("column_key"),
        },
    )


def find_footnote_paragraph(
    context: TableRuntimeContext,
    anchor: dict,
) -> ET.Element | None:
    footnote_items = context.snapshot.get("footnote_items") or []
    for note_index, item in enumerate(footnote_items):
        if note_index >= len(context.note_paragraphs):
            continue
        coordinate = item.get("coordinate")
        if not isinstance(coordinate, dict):
            continue
        if not anchor_matches_coordinate(anchor, coordinate):
            continue
        return context.note_paragraphs[note_index]
    return None


def find_note_zone_paragraphs(
    context: TableRuntimeContext,
    anchor: dict,
) -> list[ET.Element]:
    note_zone = context.snapshot.get("note_zone")
    if not isinstance(note_zone, dict):
        return []

    coordinate = note_zone.get("coordinate")
    if not isinstance(coordinate, dict) or not anchor_matches_coordinate(anchor, coordinate):
        return []

    return [*context.note_paragraphs]


def find_snapshot_entry(entries: list[dict], anchor: dict) -> dict | None:
    for entry in entries:
        coordinate = entry.get("coordinate")
        if not isinstance(coordinate, dict):
            continue
        if anchor_matches_coordinate(anchor, coordinate):
            return entry
    return None


def anchor_matches_coordinate(anchor: dict, coordinate: dict) -> bool:
    return (
        normalize_optional_text(anchor.get("table_id"))
        == normalize_optional_text(coordinate.get("table_id"))
        and normalize_optional_text(anchor.get("semantic_target"))
        == normalize_optional_text(coordinate.get("target"))
        and normalize_optional_text(anchor.get("column_key"))
        == normalize_optional_text(coordinate.get("column_key"))
        and normalize_optional_text(anchor.get("row_key"))
        == normalize_optional_text(coordinate.get("row_key"))
        and normalize_optional_text(anchor.get("footnote_anchor"))
        == normalize_optional_text(coordinate.get("footnote_anchor"))
        and normalize_optional_text_list(anchor.get("header_path"))
        == normalize_optional_text_list(coordinate.get("header_path"))
    )


def normalize_optional_text(value: object) -> str:
    return value.strip().lower() if isinstance(value, str) else ""


def normalize_optional_text_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip().lower() for item in value if isinstance(item, str)]


def read_optional_text(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def read_required_replacement_text(patch: dict) -> str | None:
    return read_optional_text(patch.get("proposed_after"))


def replace_container_text(container: ET.Element, next_text: str) -> None:
    text_nodes = container.findall(".//w:t", NS)
    if text_nodes:
        text_nodes[0].text = next_text
        for node in text_nodes[1:]:
            node.text = ""
        return

    paragraph = container if container.tag == qualify("p") else container.find("./w:p", NS)
    if paragraph is None:
        paragraph = ET.SubElement(container, qualify("p"))
    run = paragraph.find("./w:r", NS)
    if run is None:
        run = ET.SubElement(paragraph, qualify("r"))
    text_node = run.find("./w:t", NS)
    if text_node is None:
        text_node = ET.SubElement(run, qualify("t"))
    text_node.text = next_text


def build_patch_result(patch: dict, status: str, reason: str) -> dict:
    result = {
        "patch_id": str(patch.get("patch_id") or ""),
        "rule_id": str(patch.get("rule_id") or ""),
        "patch_type": str(patch.get("patch_type") or "unknown"),
        "status": status,
        "reason": reason,
        "required_snapshot_capabilities": [
            capability
            for capability in patch.get("required_snapshot_capabilities") or []
            if isinstance(capability, str)
        ],
    }

    if isinstance(patch.get("table_id"), str):
        result["table_id"] = patch["table_id"]

    anchor = patch.get("anchor")
    if isinstance(anchor, dict):
        result["anchor"] = clone_anchor(anchor)
        if isinstance(anchor.get("semantic_target"), str):
            result["semantic_target"] = anchor["semantic_target"]
    elif isinstance(patch.get("semantic_target"), str):
        result["semantic_target"] = patch["semantic_target"]

    return result


def clone_anchor(anchor: dict) -> dict:
    return {
        key: ([*value] if isinstance(value, list) else value)
        for key, value in anchor.items()
        if isinstance(key, str)
    }


def _extract_raw_rows(table_node: ET.Element) -> list[list[dict]]:
    rows = table_node.findall("./w:tr", NS)
    raw_rows: list[list[dict]] = []
    for row in rows:
        raw_row: list[dict] = []
        for cell in row.findall("./w:tc", NS):
            raw_row.append(
                {
                    "text": extract_node_text(cell).strip(),
                    "column_span": extract_grid_span(cell),
                    "row_span": _extract_row_span(cell),
                    "borders": _extract_cell_borders(cell),
                }
            )
        raw_rows.append(raw_row)
    return raw_rows


def _expand_table_rows_with_nodes(table_node: ET.Element) -> list[list[ET.Element]]:
    expanded_rows: list[list[ET.Element]] = []
    for row in table_node.findall("./w:tr", NS):
        expanded_row: list[ET.Element] = []
        for cell in row.findall("./w:tc", NS):
            expanded_row.extend([cell] * extract_grid_span(cell))
        expanded_rows.append(expanded_row)
    return expanded_rows


def _extract_row_span(cell_node: ET.Element) -> int:
    vertical_merge = cell_node.find("./w:tcPr/w:vMerge", NS)
    if vertical_merge is None:
        return 1
    return 2


def _extract_cell_borders(cell_node: ET.Element) -> dict:
    borders = cell_node.find("./w:tcPr/w:tcBorders", NS)
    if borders is None:
        return {}

    hints = {}
    for side in ("top", "bottom", "left", "right"):
        border = borders.find(f"./w:{side}", NS)
        if border is None:
            continue
        value = (border.attrib.get(qualify("val")) or "single").strip().lower()
        if value not in {"nil", "none"}:
            hints[side] = True
    return hints
