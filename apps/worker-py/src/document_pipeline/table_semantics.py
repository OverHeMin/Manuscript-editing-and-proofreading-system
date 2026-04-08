from __future__ import annotations

import re


STATISTICAL_NOTE_RE = re.compile(r"\bP\s*[<=>]\s*0?\.\d+", re.IGNORECASE)
UNIT_TOKEN_RE = re.compile(r"\(([^()]*)\)")


def build_table_semantic_snapshot(
    *,
    table_index: int,
    rows: list[list[dict]],
    caption: str | None = None,
    notes: list[str] | None = None,
) -> dict:
    notes = notes or []
    expanded_rows = _expand_rows(rows)
    header_depth = infer_header_depth(expanded_rows)
    header_rows = expanded_rows[:header_depth]
    data_rows = expanded_rows[header_depth:]
    column_paths = build_column_paths(header_rows)
    table_id = f"table-{table_index}"

    header_cells: list[dict] = []
    for column_index, header_path in enumerate(column_paths):
        header_cells.append(
            {
                "id": f"{table_id}-header-{column_index}",
                "text": header_path[-1] if header_path else "",
                "row_index": max(header_depth - 1, 0),
                "column_index": column_index,
                "header_path": header_path,
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
                "coordinate": {
                    "table_id": table_id,
                    "target": "footnote_item",
                    "footnote_anchor": anchor,
                },
            }
        )

    merged_relations = build_merged_relations(table_id, rows)

    return {
        "table_id": table_id,
        "caption": caption,
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
    }


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
            }
            expanded_row.extend(cell_payload.copy() for _ in range(column_span))
        expanded.append(expanded_row)
    return expanded


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
