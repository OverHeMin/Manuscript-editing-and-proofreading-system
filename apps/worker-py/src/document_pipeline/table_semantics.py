from __future__ import annotations

import re


STATISTICAL_NOTE_RE = re.compile(r"\bP\s*[<=>]\s*0?\.\d+", re.IGNORECASE)
UNIT_TOKEN_RE = re.compile(r"\(([^()]*)\)")
TABLE_CAPTION_RE = re.compile(
    r"^(?P<label>(?:表|Table)\s*\d+[A-Za-z0-9-]*)[\s:：、.\-]*(?P<title>.*)$",
    re.IGNORECASE,
)


def build_table_semantic_snapshot(
    *,
    table_index: int,
    rows: list[list[dict]],
    caption: str | None = None,
    caption_paragraphs: list[dict] | None = None,
    notes: list[str] | None = None,
    note_paragraphs: list[dict] | None = None,
    border_hints: dict | None = None,
) -> dict:
    notes = notes or []
    caption_paragraphs = caption_paragraphs or []
    note_paragraphs = note_paragraphs or []
    border_hints = border_hints or {}
    expanded_rows = _expand_rows(rows)
    header_depth = infer_header_depth(expanded_rows)
    header_rows = expanded_rows[:header_depth]
    data_rows = expanded_rows[header_depth:]
    column_paths = build_column_paths(header_rows)
    table_id = f"table-{table_index}"
    row_count = len(rows)
    column_count = calculate_column_count(rows)
    grid_cells, cell_id_by_position = build_grid_cells(
        table_id=table_id,
        rows=rows,
        header_depth=header_depth,
    )
    caption_fields = build_caption_fields(
        caption,
        caption_paragraphs=caption_paragraphs,
        table_id=table_id,
    )

    header_cells: list[dict] = []
    for column_index, header_path in enumerate(column_paths):
        header_cells.append(
            {
                "id": f"{table_id}-header-{column_index}",
                "text": header_path[-1] if header_path else "",
                "row_index": max(header_depth - 1, 0),
                "column_index": column_index,
                "header_path": header_path,
                "source_cell_id": cell_id_by_position.get(
                    (max(header_depth - 1, 0), column_index)
                ),
                "coordinate": {
                    "table_id": table_id,
                    "target": "header_cell",
                    "header_path": header_path or None,
                    "column_key": " > ".join(header_path) or None,
                },
            }
        )

    stub_columns: list[dict] = []
    data_cells: list[dict] = []
    for row_offset, row in enumerate(data_rows):
        if not row:
            continue

        row_key = (row[0].get("text") or "").strip()
        if row_key:
            stub_columns.append(
                {
                    "id": f"{table_id}-stub-{row_offset}",
                    "text": row_key,
                    "row_key": row_key,
                    "source_cell_id": cell_id_by_position.get(
                        (header_depth + row_offset, 0)
                    ),
                    "coordinate": {
                        "table_id": table_id,
                        "target": "stub_column",
                        "row_key": row_key,
                    },
                }
            )

        for column_index, cell in enumerate(row[1:], start=1):
            text = (cell.get("text") or "").strip()
            if not text:
                continue

            header_path = column_paths[column_index] if column_index < len(column_paths) else []
            column_key = " > ".join(header_path)
            data_cells.append(
                {
                    "id": f"{table_id}-data-{row_offset}-{column_index}",
                    "text": text,
                    "row_index": header_depth + row_offset,
                    "column_index": column_index,
                    "row_key": row_key,
                    "column_key": column_key,
                    "source_cell_id": cell_id_by_position.get(
                        (header_depth + row_offset, column_index)
                    ),
                    "coordinate": {
                        "table_id": table_id,
                        "target": "data_cell",
                        "header_path": header_path or None,
                        "row_key": row_key or None,
                        "column_key": column_key or None,
                    },
                    "unit_context": "header" if _extract_unit_tokens(column_key) else None,
                }
            )

    unit_markers: list[dict] = []
    for header_cell in header_cells:
        for token in _extract_unit_tokens(" > ".join(header_cell["header_path"])):
            unit_markers.append(
                {
                    "id": f"{header_cell['id']}-unit-{len(unit_markers)}",
                    "text": token,
                    "source_target": "header_cell",
                    "coordinate": {
                        "table_id": table_id,
                        "target": "unit_marker",
                        "header_path": header_cell["header_path"] or None,
                        "column_key": " > ".join(header_cell["header_path"]) or None,
                    },
                }
            )

    footnote_items: list[dict] = []
    for note_index, note in enumerate(notes):
        note_text = note.strip()
        if not note_text:
            continue

        anchor = note_text[0] if note_text[:1] in {"*", "#", "a", "b", "c"} else None
        footnote_items.append(
            {
                "id": f"{table_id}-footnote-{note_index}",
                "text": note_text,
                "note_kind": classify_note_kind(note_text),
                "marker": anchor,
                "paragraphs": materialize_paragraph_snapshots(
                    [note_paragraphs[note_index]]
                    if note_index < len(note_paragraphs)
                    else [],
                    f"{table_id}-footnote-{note_index}",
                ),
                "coordinate": {
                    "table_id": table_id,
                    "target": "footnote_item",
                    "footnote_anchor": anchor,
                },
            }
        )

    merged_relations = build_merged_relations(table_id, rows)
    note_zone = build_note_zone(
        table_id,
        notes,
        footnote_items,
        note_paragraphs=note_paragraphs,
    )

    snapshot = {
        "table_id": table_id,
        "caption": caption,
        "row_count": row_count,
        "column_count": column_count,
        "profile": {
            "is_three_line_table": bool(expanded_rows),
            "header_depth": header_depth,
            "has_stub_column": bool(stub_columns),
            "has_statistical_footnotes": any(
                item["note_kind"] == "statistical_significance"
                for item in footnote_items
            ),
            "has_unit_markers": bool(unit_markers),
            "has_merged_headers": bool(merged_relations),
        },
        "header_cells": header_cells,
        "stub_columns": stub_columns,
        "data_cells": data_cells,
        "unit_markers": unit_markers,
        "footnote_items": footnote_items,
        "merged_relations": merged_relations,
        "grid_cells": grid_cells,
        "style_profile": build_style_profile(
            table_id=table_id,
            rows=rows,
            header_depth=header_depth,
            border_hints=border_hints,
        ),
    }

    if caption_fields is not None:
        snapshot["caption_fields"] = caption_fields

        if caption_fields.get("label_text"):
            snapshot["table_label"] = {
                "id": f"{table_id}-label",
                "text": caption_fields["label_text"],
                "coordinate": {
                    "table_id": table_id,
                    "target": "table_label",
                },
            }

        if caption_fields.get("title_text"):
            snapshot["table_title"] = {
                "id": f"{table_id}-title",
                "text": caption_fields["title_text"],
                "coordinate": {
                    "table_id": table_id,
                    "target": "table_title",
                },
            }

    if note_zone is not None:
        snapshot["note_zone"] = note_zone

    return snapshot


def infer_header_depth(expanded_rows: list[list[dict]]) -> int:
    if not expanded_rows:
        return 0

    if len(expanded_rows) == 1:
        return 1

    for row_index, row in enumerate(expanded_rows[1:], start=1):
        body_cells = [(cell.get("text") or "").strip() for cell in row[1:]]
        meaningful = [text for text in body_cells if text]
        if not meaningful:
            continue

        numeric_like = sum(1 for text in meaningful if _looks_like_data_value(text))
        if numeric_like >= max(1, len(meaningful) // 2):
            return row_index

    return min(len(expanded_rows), 1)


def build_column_paths(header_rows: list[list[dict]]) -> list[list[str]]:
    if not header_rows:
        return []

    column_count = max(len(row) for row in header_rows)
    paths: list[list[str]] = []

    for column_index in range(column_count):
        path: list[str] = []
        for row in header_rows:
            if column_index >= len(row):
                continue

            text = (row[column_index].get("text") or "").strip()
            if text and (not path or path[-1] != text):
                path.append(text)
        paths.append(path)

    return paths


def build_merged_relations(table_id: str, rows: list[list[dict]]) -> list[dict]:
    relations: list[dict] = []

    for row_index, row in enumerate(rows):
        for cell_index, cell in enumerate(row):
            column_span = int(cell.get("column_span") or 1)
            row_span = int(cell.get("row_span") or 1)
            if column_span <= 1 and row_span <= 1:
                continue

            relations.append(
                {
                    "id": f"{table_id}-merge-{row_index}-{cell_index}",
                    "target_ids": [f"{table_id}-cell-{row_index}-{cell_index}"],
                    "axis": "column" if column_span > 1 else "row",
                }
            )

    return relations


def build_caption_fields(
    caption: str | None,
    *,
    caption_paragraphs: list[dict] | None = None,
    table_id: str | None = None,
) -> dict | None:
    text = (caption or "").strip()
    if not text:
        return None

    label_text, title_text = split_caption_parts(text)
    fields = {"text": text}
    paragraph_snapshots = materialize_paragraph_snapshots(
        caption_paragraphs or [],
        f"{table_id or 'table'}-caption",
    )
    if label_text:
        fields["label_text"] = label_text
    if title_text:
        fields["title_text"] = title_text
    if paragraph_snapshots:
        fields["paragraphs"] = paragraph_snapshots
    return fields


def split_caption_parts(text: str) -> tuple[str | None, str | None]:
    match = TABLE_CAPTION_RE.match(text.strip())
    if not match:
        return None, None

    label_text = (match.group("label") or "").strip() or None
    title_text = (match.group("title") or "").strip() or None
    return label_text, title_text


def build_note_zone(
    table_id: str,
    notes: list[str],
    footnote_items: list[dict],
    *,
    note_paragraphs: list[dict] | None = None,
) -> dict | None:
    line_texts = [note.strip() for note in notes if note and note.strip()]
    if not line_texts:
        return None

    note_zone = {
        "text": "\n".join(line_texts),
        "line_texts": line_texts,
        "footnote_ids": [item["id"] for item in footnote_items],
        "coordinate": {
            "table_id": table_id,
            "target": "note_zone",
        },
    }
    paragraph_snapshots = materialize_paragraph_snapshots(
        note_paragraphs or [],
        f"{table_id}-note-zone",
    )
    if paragraph_snapshots:
        note_zone["paragraphs"] = paragraph_snapshots
    return note_zone


def build_style_profile(
    *,
    table_id: str,
    rows: list[list[dict]],
    header_depth: int,
    border_hints: dict,
) -> dict:
    header_rule_row = rows[header_depth - 1] if 0 < header_depth <= len(rows) else []
    return {
        "has_top_rule": bool(border_hints.get("top")) or _row_has_border(rows[:1], "top"),
        "has_header_rule": bool(border_hints.get("inside_horizontal"))
        or _row_has_border([header_rule_row], "bottom"),
        "has_bottom_rule": bool(border_hints.get("bottom")) or _row_has_border(rows[-1:], "bottom"),
        "has_vertical_rules": bool(border_hints.get("inside_vertical"))
        or bool(border_hints.get("left"))
        or bool(border_hints.get("right"))
        or _rows_have_vertical_borders(rows),
        "coordinate": {
            "table_id": table_id,
            "target": "style_profile",
        },
    }


def calculate_column_count(rows: list[list[dict]]) -> int:
    return max(
        (sum(int(cell.get("column_span") or 1) for cell in row) for row in rows),
        default=0,
    )


def build_grid_cells(
    *,
    table_id: str,
    rows: list[list[dict]],
    header_depth: int,
) -> tuple[list[dict], dict[tuple[int, int], str]]:
    grid_cells: list[dict] = []
    cell_id_by_position: dict[tuple[int, int], str] = {}

    for row_index, row in enumerate(rows):
        column_index = 0
        for raw_cell in row:
            row_span = int(raw_cell.get("row_span") or 1)
            column_span = int(raw_cell.get("column_span") or 1)
            cell_id = f"{table_id}-cell-{row_index}-{column_index}"
            paragraphs = materialize_paragraph_snapshots(
                raw_cell.get("paragraphs"),
                cell_id,
            )
            cell_payload = {
                "id": cell_id,
                "text": (raw_cell.get("text") or "").strip(),
                "row_index": row_index,
                "column_index": column_index,
                "row_span": row_span,
                "column_span": column_span,
                "inferred_role": infer_grid_cell_role(
                    row_index=row_index,
                    column_index=column_index,
                    header_depth=header_depth,
                ),
                "style_evidence": build_cell_style_evidence(
                    paragraphs,
                    raw_cell.get("vertical_alignment"),
                    raw_cell.get("text_direction"),
                ),
                "paragraphs": paragraphs,
            }
            for fidelity_key in (
                "display_text",
                "normalized_text",
                "raw_xml_text",
                "style_runs",
            ):
                if fidelity_key in raw_cell:
                    cell_payload[fidelity_key] = raw_cell[fidelity_key]
            borders = _copy_border_flags(raw_cell.get("borders"))
            if borders:
                cell_payload["border_hints"] = borders
            object_evidence = raw_cell.get("object_evidence")
            if isinstance(object_evidence, list) and object_evidence:
                cell_payload["object_evidence"] = [
                    entry for entry in object_evidence if isinstance(entry, dict)
                ]
            grid_cells.append(cell_payload)
            cell_id_by_position[(row_index, column_index)] = cell_id
            column_index += column_span

    return grid_cells, cell_id_by_position


def infer_grid_cell_role(*, row_index: int, column_index: int, header_depth: int) -> str:
    if row_index < header_depth:
        return "header"
    if column_index == 0:
        return "stub"
    return "data"


def materialize_paragraph_snapshots(value: object, prefix: str) -> list[dict]:
    if not isinstance(value, list):
        return []

    snapshots: list[dict] = []
    for index, entry in enumerate(value):
        if not isinstance(entry, dict):
            continue
        paragraph_id = f"{prefix}-paragraph-{index}"
        fragments = materialize_inline_fragments(
            entry.get("fragments"),
            paragraph_id,
        )
        snapshots.append(
            {
                "id": paragraph_id,
                "text": entry.get("text") or "",
                "style": normalize_paragraph_style_evidence(entry.get("style")),
                "fragments": fragments,
            }
        )
    return snapshots


def materialize_inline_fragments(value: object, prefix: str) -> list[dict]:
    if not isinstance(value, list):
        return []

    fragments: list[dict] = []
    for index, entry in enumerate(value):
        if not isinstance(entry, dict):
            continue
        fragment = {
            "id": f"{prefix}-fragment-{index}",
            "kind": normalize_fragment_kind(entry.get("kind")),
            "text": entry.get("text") or "",
            "style": normalize_inline_style_evidence(entry.get("style")),
        }
        if entry.get("symbol_font"):
            fragment["symbol_font"] = entry.get("symbol_font")
        if entry.get("symbol_char"):
            fragment["symbol_char"] = entry.get("symbol_char")
        if entry.get("object_kind"):
            fragment["object_kind"] = entry.get("object_kind")
        if entry.get("original_tag"):
            fragment["original_tag"] = entry.get("original_tag")
        if entry.get("relationship_id"):
            fragment["relationship_id"] = entry.get("relationship_id")
        if entry.get("evidence_text"):
            fragment["evidence_text"] = entry.get("evidence_text")
        fragments.append(fragment)
    return fragments


def normalize_fragment_kind(value: object) -> str:
    if value in {"text", "symbol", "tab", "line_break", "object"}:
        return value  # type: ignore[return-value]
    return "text"


def normalize_inline_style_evidence(value: object) -> dict:
    record = value if isinstance(value, dict) else {}
    return {
        "font_family": normalize_style_fact(record.get("font_family")),
        "font_size_pt": normalize_style_fact(record.get("font_size_pt")),
        "bold": normalize_style_fact(record.get("bold")),
        "italic": normalize_style_fact(record.get("italic")),
        "script_position": normalize_style_fact(record.get("script_position")),
    }


def normalize_paragraph_style_evidence(value: object) -> dict:
    record = value if isinstance(value, dict) else {}
    return {
        "alignment": normalize_style_fact(record.get("alignment")),
        "spacing_before_pt": normalize_style_fact(record.get("spacing_before_pt")),
        "spacing_after_pt": normalize_style_fact(record.get("spacing_after_pt")),
        "line_spacing": normalize_style_fact(record.get("line_spacing")),
        "line_spacing_mode": normalize_style_fact(record.get("line_spacing_mode")),
        "left_indent_pt": normalize_style_fact(record.get("left_indent_pt")),
        "right_indent_pt": normalize_style_fact(record.get("right_indent_pt")),
        "first_line_indent_pt": normalize_style_fact(record.get("first_line_indent_pt")),
        "hanging_indent_pt": normalize_style_fact(record.get("hanging_indent_pt")),
    }


def build_cell_style_evidence(
    paragraphs: list[dict],
    vertical_alignment: object,
    text_direction: object = None,
) -> dict:
    fragments = [
        fragment
        for paragraph in paragraphs
        for fragment in paragraph.get("fragments", [])
        if isinstance(fragment, dict)
    ]
    return {
        "font_family": summarize_style_fact(
            [fragment.get("style", {}).get("font_family") for fragment in fragments]
        ),
        "font_size_pt": summarize_style_fact(
            [fragment.get("style", {}).get("font_size_pt") for fragment in fragments]
        ),
        "bold": summarize_style_fact(
            [fragment.get("style", {}).get("bold") for fragment in fragments]
        ),
        "italic": summarize_style_fact(
            [fragment.get("style", {}).get("italic") for fragment in fragments]
        ),
        "script_position": summarize_style_fact(
            [fragment.get("style", {}).get("script_position") for fragment in fragments]
        ),
        "alignment": summarize_style_fact(
            [paragraph.get("style", {}).get("alignment") for paragraph in paragraphs]
        ),
        "spacing_before_pt": summarize_style_fact(
            [paragraph.get("style", {}).get("spacing_before_pt") for paragraph in paragraphs]
        ),
        "spacing_after_pt": summarize_style_fact(
            [paragraph.get("style", {}).get("spacing_after_pt") for paragraph in paragraphs]
        ),
        "line_spacing": summarize_style_fact(
            [paragraph.get("style", {}).get("line_spacing") for paragraph in paragraphs]
        ),
        "line_spacing_mode": summarize_style_fact(
            [paragraph.get("style", {}).get("line_spacing_mode") for paragraph in paragraphs]
        ),
        "left_indent_pt": summarize_style_fact(
            [paragraph.get("style", {}).get("left_indent_pt") for paragraph in paragraphs]
        ),
        "right_indent_pt": summarize_style_fact(
            [paragraph.get("style", {}).get("right_indent_pt") for paragraph in paragraphs]
        ),
        "first_line_indent_pt": summarize_style_fact(
            [
                paragraph.get("style", {}).get("first_line_indent_pt")
                for paragraph in paragraphs
            ]
        ),
        "hanging_indent_pt": summarize_style_fact(
            [paragraph.get("style", {}).get("hanging_indent_pt") for paragraph in paragraphs]
        ),
        "vertical_alignment": summarize_style_fact(
            [normalize_style_fact_from_value(vertical_alignment)]
            if vertical_alignment
            else []
        ),
        "text_direction": summarize_style_fact(
            [normalize_style_fact_from_value(text_direction)] if text_direction else []
        ),
    }


def normalize_style_fact(value: object) -> dict:
    if not isinstance(value, dict):
        return {"availability": "unavailable"}

    availability = value.get("availability")
    if availability not in {"authoritative", "mixed", "unavailable"}:
        return {"availability": "unavailable"}

    normalized = {"availability": availability}
    if availability != "unavailable" and "value" in value:
        normalized["value"] = value.get("value")
    return normalized


def normalize_style_fact_from_value(value: object) -> dict:
    if value is None:
        return {"availability": "unavailable"}
    return {
        "availability": "authoritative",
        "value": value,
    }


def summarize_style_fact(facts: list[object]) -> dict:
    authoritative_values: list[object] = []
    saw_unknown = False

    for fact in facts:
        normalized = normalize_style_fact(fact)
        availability = normalized["availability"]
        if availability == "authoritative":
            authoritative_values.append(normalized.get("value"))
            continue
        if availability == "mixed":
            return normalized
        saw_unknown = True

    authoritative_values = [value for value in authoritative_values if value is not None]
    if not authoritative_values:
        return {"availability": "unavailable"}

    first_value = authoritative_values[0]
    if any(value != first_value for value in authoritative_values[1:]):
        return {"availability": "mixed"}

    if saw_unknown:
        return {
            "availability": "mixed",
            "value": first_value,
        }

    return {
        "availability": "authoritative",
        "value": first_value,
    }


def classify_note_kind(note_text: str) -> str:
    if STATISTICAL_NOTE_RE.search(note_text):
        return "statistical_significance"
    if re.search(r"\b[A-Z]{2,}\b", note_text):
        return "abbreviation"
    return "general"


def _expand_rows(rows: list[list[dict]]) -> list[list[dict]]:
    expanded: list[list[dict]] = []
    for row in rows:
        expanded_row: list[dict] = []
        for cell in row:
            column_span = int(cell.get("column_span") or 1)
            cell_payload = {
                "text": (cell.get("text") or "").strip(),
                "column_span": column_span,
                "row_span": int(cell.get("row_span") or 1),
                "borders": _copy_border_flags(cell.get("borders")),
            }
            expanded_row.extend(cell_payload.copy() for _ in range(column_span))
        expanded.append(expanded_row)
    return expanded


def _copy_border_flags(value: object) -> dict:
    if not isinstance(value, dict):
        return {}

    return {
        side: bool(value.get(side))
        for side in ("top", "bottom", "left", "right")
        if side in value
    }


def _row_has_border(rows: list[list[dict]], side: str) -> bool:
    for row in rows:
        for cell in row:
            borders = cell.get("borders") or {}
            if isinstance(borders, dict) and bool(borders.get(side)):
                return True
    return False


def _rows_have_vertical_borders(rows: list[list[dict]]) -> bool:
    for row in rows:
        for cell in row:
            borders = cell.get("borders") or {}
            if isinstance(borders, dict) and (
                bool(borders.get("left")) or bool(borders.get("right"))
            ):
                return True
    return False


def _extract_unit_tokens(text: str) -> list[str]:
    tokens: list[str] = []
    for match in UNIT_TOKEN_RE.findall(text):
        for part in re.split(r"[,/ ]+", match):
            token = part.strip()
            if token:
                tokens.append(token)
    return tokens


def _looks_like_data_value(text: str) -> bool:
    return bool(re.search(r"\d", text))
