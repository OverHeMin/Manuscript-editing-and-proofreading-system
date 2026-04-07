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

    if not deterministic_rules:
        shutil.copyfile(source_path, output_path)
        return {
            "applied_rule_ids": [],
            "applied_changes": [],
        }

    with zipfile.ZipFile(source_path, "r") as archive:
        entries = {name: archive.read(name) for name in archive.namelist()}

    document_xml = entries.get("word/document.xml")
    if document_xml is None:
        raise ValueError("Source DOCX is missing word/document.xml.")

    root = ET.fromstring(document_xml)
    applied_changes: list[dict] = []
    applied_rule_ids: list[str] = []

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
    }


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
