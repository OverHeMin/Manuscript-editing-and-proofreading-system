from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
from xml.etree import ElementTree as ET
import zipfile


WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": WORD_NS}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-path", required=True)
    parser.add_argument("--output-path", required=True)
    parser.add_argument("--rules-json", required=True)
    return parser.parse_args()


def select_deterministic_format_rules(rules: list[dict]) -> list[dict]:
    return [
        rule
        for rule in rules
        if rule.get("enabled", True)
        and rule.get("rule_type") == "format"
        and rule.get("execution_mode") in {"apply", "apply_and_inspect"}
        and rule.get("confidence_policy") == "always_auto"
        and not is_table_target_rule(rule)
    ]


def transform_heading(text: str, rule: dict) -> str:
    trigger = rule.get("trigger") or {}
    action = rule.get("action") or {}

    if trigger.get("kind") != "exact_text":
        return text

    if trigger.get("text") != text:
        return text

    if action.get("kind") not in {"replace_heading", "replace_text"}:
        return text

    replacement = action.get("to")
    if not isinstance(replacement, str):
        return text

    return replacement


def apply_rules_to_docx(source_path: Path, output_path: Path, rules: list[dict]) -> dict:
    deterministic_rules = select_deterministic_format_rules(rules)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(source_path, "r") as archive:
        entries = {name: archive.read(name) for name in archive.namelist()}

    document_xml = entries.get("word/document.xml")
    if document_xml is None:
        raise ValueError("Source DOCX is missing word/document.xml.")

    root = ET.fromstring(document_xml)
    table_descriptors = extract_table_descriptors(root)
    inspection_findings = build_inspection_findings(rules, table_descriptors)
    applied_changes: list[dict] = []
    applied_rule_ids: list[str] = []

    if not deterministic_rules:
        shutil.copyfile(source_path, output_path)
        return {
            "applied_rule_ids": [],
            "applied_changes": [],
            "inspection_findings": inspection_findings,
        }

    for paragraph in root.findall(".//w:body/w:p", NS):
        text_nodes = paragraph.findall(".//w:t", NS)
        if not text_nodes:
            continue

        current_text = "".join(node.text or "" for node in text_nodes)
        if not current_text:
            continue

        next_text = current_text
        applied_rule_id: str | None = None

        for rule in deterministic_rules:
            transformed = transform_heading(next_text, rule)
            if transformed == next_text:
                continue

            applied_rule_id = str(rule.get("id"))
            next_text = transformed
            applied_rule_ids.append(applied_rule_id)
            applied_changes.append(
                {
                    "ruleId": applied_rule_id,
                    "before": current_text,
                    "after": next_text,
                }
            )
            break

        if applied_rule_id is None:
            continue

        text_nodes[0].text = next_text
        for node in text_nodes[1:]:
            node.text = ""

    entries["word/document.xml"] = ET.tostring(root, encoding="utf-8", xml_declaration=True)

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries.items():
            archive.writestr(name, content)

    return {
        "applied_rule_ids": list(dict.fromkeys(applied_rule_ids)),
        "applied_changes": applied_changes,
        "inspection_findings": inspection_findings,
    }


def is_table_target_rule(rule: dict) -> bool:
    if rule.get("rule_object") == "table":
      return True

    scope = rule.get("scope") or {}
    if scope.get("block_kind") == "table":
        return True

    selector = rule.get("selector") or {}
    if selector.get("block_selector") == "table":
        return True

    action = rule.get("action") or {}
    return action.get("kind") in {
        "inspect_table_rule",
        "rewrite_table_layout",
        "normalize_table_layout",
    }


def build_inspection_findings(
    rules: list[dict],
    tables: list[dict],
) -> list[dict]:
    findings: list[dict] = []
    if not tables:
        return findings

    for rule in rules:
        if not rule.get("enabled", True) or not is_table_target_rule(rule):
            continue

        execution_mode = rule.get("execution_mode")
        confidence_policy = rule.get("confidence_policy")
        action_kind = (rule.get("action") or {}).get("kind")

        if (
            execution_mode == "inspect"
            or confidence_policy == "manual_only"
            or action_kind == "inspect_table_rule"
        ):
            disposition = "inspect_only"
            reason = (
                "Table rules require deterministic inspection before manual editorial confirmation."
            )
        else:
            disposition = "manual_review_required"
            reason = (
                "Requested table auto-apply action is not implemented safely in phase 1."
            )

        for table_index, table in enumerate(tables):
            findings.append(
                {
                    "ruleId": str(rule.get("id")),
                    "blockType": "table",
                    "tableIndex": table_index,
                    "caption": table.get("caption"),
                    "disposition": disposition,
                    "reason": reason,
                }
            )

    return findings


def extract_table_descriptors(root: ET.Element) -> list[dict]:
    body = root.find("w:body", NS)
    if body is None:
        return []

    tables: list[dict] = []
    pending_caption: str | None = None

    for child in list(body):
        if child.tag == qualify("p"):
            text = extract_node_text(child).strip()
            if not text:
                continue

            if is_table_caption(text):
                pending_caption = text
                continue

            if is_table_note(text) and tables:
                tables[-1].setdefault("notes", []).append(text)
                continue

            pending_caption = None
            continue

        if child.tag != qualify("tbl"):
            continue

        row_count, column_count = extract_table_dimensions(child)
        tables.append(
            {
                "caption": pending_caption,
                "row_count": row_count,
                "column_count": column_count,
                "notes": [],
            }
        )
        pending_caption = None

    return tables


def qualify(tag: str) -> str:
    return f"{{{WORD_NS}}}{tag}"


def extract_node_text(node: ET.Element) -> str:
    return "".join(text_node.text or "" for text_node in node.findall(".//w:t", NS))


def extract_table_dimensions(node: ET.Element) -> tuple[int, int]:
    rows = node.findall("./w:tr", NS)
    row_count = len(rows)
    column_count = max((len(row.findall("./w:tc", NS)) for row in rows), default=0)
    return row_count, column_count


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


def main() -> None:
    args = parse_args()
    result = apply_rules_to_docx(
        Path(args.source_path),
        Path(args.output_path),
        json.loads(args.rules_json),
    )
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
