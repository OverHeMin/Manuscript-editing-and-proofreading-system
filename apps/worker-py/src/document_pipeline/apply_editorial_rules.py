from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import shutil
import sys
from xml.etree import ElementTree as ET
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from document_pipeline.table_patches import apply_table_patches


WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": WORD_NS}
FORMAT_ONLY_IGNORED_PATTERN = re.compile(r"[\s.,;:!?()\[\]{}\"'`<>/\-|\\，。；：！？（）【】《》、]+")
NUMERIC_ENTITY_PATTERN = re.compile(
    r"\d|%|‰|mg|g/L|mmol|μmol|ml|kg|cm|mm|p\s*[<=>]|ci|confidence interval|n\s*=|mean|sd|±",
    re.IGNORECASE,
)
MEDICAL_ENTITY_PATTERN = re.compile(
    r"patient|patients|diagnosis|diagnostic|therapy|treatment|clinical|hemoglobin|"
    r"alanine aminotransferase|serum|plasma|dose|dosage|患者|诊断|治疗|临床|血红蛋白|转氨酶|剂量|结论",
    re.IGNORECASE,
)
OBJECT_TYPE_PATTERN = re.compile(r"χ²|χ|β|α|±|≤|≥|∑|√|≈|≠")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-path", required=True)
    parser.add_argument("--output-path", required=True)
    parser.add_argument("--rules-json", required=True)
    parser.add_argument("--ai-replacements-json", default="[]")
    parser.add_argument(
        "--table-auto-apply-mode",
        default="disabled",
        choices=["disabled", "inspect_only", "editing_safe_apply"],
    )
    parser.add_argument("--table-patches-json", default="[]")
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


def apply_rules_to_docx(
    source_path: Path,
    output_path: Path,
    rules: list[dict],
    ai_replacements: list[dict] | None = None,
    table_auto_apply_mode: str = "disabled",
    table_patches: list[dict] | None = None,
) -> dict:
    resolved_ai_replacements = ai_replacements or []
    resolved_table_patches = table_patches or []
    enforce_table_auto_apply_guard(
        table_auto_apply_mode=table_auto_apply_mode,
        table_patches=resolved_table_patches,
    )
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
    table_patch_results: list[dict] = []
    skipped_ai_replacements: list[dict] = []
    pending_ai_replacements: list[tuple[int, dict]] = []

    for replacement_index, replacement in enumerate(resolved_ai_replacements):
        target_text = replacement.get("targetText")
        if not isinstance(target_text, str) or not target_text:
            skipped_ai_replacements.append(
                {
                    "replacementId": f"ai-replacement-{replacement_index + 1}",
                    "reason": "anchor_not_precise",
                    "targetText": replacement.get("targetText"),
                }
            )
            continue

        pending_ai_replacements.append((replacement_index, replacement))

    resolved_ai_replacement_indexes: set[int] = set()

    if not deterministic_rules and not resolved_ai_replacements and not resolved_table_patches:
        shutil.copyfile(source_path, output_path)
        return {
            "applied_rule_ids": [],
            "applied_changes": [],
            "inspection_findings": inspection_findings,
            "table_patch_results": [],
            "skipped_ai_replacements": [],
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

            if not replace_paragraph_text_in_single_node(
                text_nodes,
                expected_text=next_text,
                replacement_text=transformed,
            ):
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

        for replacement_index, replacement in pending_ai_replacements:
            if replacement_index in resolved_ai_replacement_indexes:
                continue

            target_text = replacement.get("targetText")
            if not isinstance(target_text, str) or not target_text:
                resolved_ai_replacement_indexes.add(replacement_index)
                skipped_ai_replacements.append(
                    {
                        "replacementId": f"ai-replacement-{replacement_index + 1}",
                        "reason": "anchor_not_precise",
                        "targetText": replacement.get("targetText"),
                    }
                )
                continue

            if target_text not in next_text:
                continue

            application_skip_reason = detect_ai_replacement_application_skip_reason(
                text_nodes, replacement
            )
            if application_skip_reason:
                resolved_ai_replacement_indexes.add(replacement_index)
                skipped_ai_replacements.append(
                    {
                        "replacementId": f"ai-replacement-{replacement_index + 1}",
                        "reason": application_skip_reason,
                        "targetText": target_text,
                    }
                )
                continue

            guardrail_reason = detect_ai_replacement_guardrail_reason(replacement)
            if guardrail_reason:
                resolved_ai_replacement_indexes.add(replacement_index)
                skipped_ai_replacements.append(
                    {
                        "replacementId": f"ai-replacement-{replacement_index + 1}",
                        "reason": guardrail_reason,
                        "targetText": target_text,
                    }
                )
                continue

            replaced_text = apply_ai_replacement_to_text_nodes(text_nodes, replacement)
            if replaced_text is None:
                resolved_ai_replacement_indexes.add(replacement_index)
                skipped_ai_replacements.append(
                    {
                        "replacementId": f"ai-replacement-{replacement_index + 1}",
                        "reason": "anchor_not_precise",
                        "targetText": target_text,
                    }
                )
                continue

            replacement_id = f"ai-replacement-{replacement_index + 1}"
            before_ai, transformed = next_text, replaced_text
            next_text = transformed
            applied_rule_ids.append(replacement_id)
            applied_changes.append(
                {
                    "ruleId": replacement_id,
                    "before": before_ai,
                    "after": next_text,
                }
            )
            applied_rule_id = replacement_id
            resolved_ai_replacement_indexes.add(replacement_index)
            break

        if applied_rule_id is None:
            continue

    if resolved_table_patches:
        table_patch_results = apply_table_patches(root, resolved_table_patches)

    for replacement_index, replacement in pending_ai_replacements:
        if replacement_index in resolved_ai_replacement_indexes:
            continue

        skipped_ai_replacements.append(
            {
                "replacementId": f"ai-replacement-{replacement_index + 1}",
                "reason": "anchor_not_precise",
                "targetText": replacement.get("targetText"),
            }
        )

    if not applied_rule_ids and not table_patch_results:
        shutil.copyfile(source_path, output_path)
        return {
            "applied_rule_ids": [],
            "applied_changes": [],
            "inspection_findings": inspection_findings,
            "table_patch_results": [],
            "skipped_ai_replacements": skipped_ai_replacements,
        }

    entries["word/document.xml"] = ET.tostring(root, encoding="utf-8", xml_declaration=True)

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries.items():
            archive.writestr(name, content)

    return {
        "applied_rule_ids": list(dict.fromkeys(applied_rule_ids)),
        "applied_changes": applied_changes,
        "inspection_findings": inspection_findings,
        "table_patch_results": table_patch_results,
        "skipped_ai_replacements": skipped_ai_replacements,
    }


def enforce_table_auto_apply_guard(
    table_auto_apply_mode: str,
    table_patches: list[dict],
) -> None:
    if not table_patches:
        return

    if table_auto_apply_mode != "editing_safe_apply":
        raise ValueError(
            "Table patch payloads require table_auto_apply_mode=editing_safe_apply."
        )


def apply_ai_replacement(text: str, replacement: dict) -> str:
    target_text = replacement.get("targetText")
    replacement_text = replacement.get("replacementText")
    if not isinstance(target_text, str) or not target_text:
        return text
    if not isinstance(replacement_text, str) or not replacement_text:
        return text
    if target_text not in text:
        return text
    return text.replace(target_text, replacement_text, 1)


def detect_ai_replacement_guardrail_reason(replacement: dict) -> str | None:
    target_text = replacement.get("targetText")
    replacement_text = replacement.get("replacementText")
    if not isinstance(target_text, str) or not target_text:
        return "anchor_not_precise"
    if not isinstance(replacement_text, str) or not replacement_text:
        return "insufficient_style_evidence"

    combined_text = f"{target_text}\n{replacement_text}"
    if OBJECT_TYPE_PATTERN.search(combined_text):
        return "object_type_not_safe"
    if NUMERIC_ENTITY_PATTERN.search(combined_text):
        return "numeric_entity_present"
    if MEDICAL_ENTITY_PATTERN.search(combined_text):
        return "medical_entity_present"
    if not is_likely_format_only_replacement(target_text, replacement_text):
        return "meaning_risk"
    return None


def detect_ai_replacement_application_skip_reason(
    text_nodes: list[ET.Element], replacement: dict
) -> str | None:
    target_text = replacement.get("targetText")
    if not isinstance(target_text, str) or not target_text:
        return "anchor_not_precise"

    paragraph_text = "".join(node.text or "" for node in text_nodes)
    if target_text not in paragraph_text:
        return "anchor_not_precise"

    if not any(target_text in (node.text or "") for node in text_nodes):
        return "anchor_not_precise"

    return None


def is_likely_format_only_replacement(target_text: str, replacement_text: str) -> bool:
    return normalize_format_skeleton(target_text) == normalize_format_skeleton(
        replacement_text
    )


def normalize_format_skeleton(value: str) -> str:
    normalized = value.casefold()
    return FORMAT_ONLY_IGNORED_PATTERN.sub("", normalized)


def replace_paragraph_text_in_single_node(
    text_nodes: list[ET.Element],
    *,
    expected_text: str,
    replacement_text: str,
) -> bool:
    non_empty_nodes = [node for node in text_nodes if node.text]
    if len(non_empty_nodes) != 1:
        return False

    target_node = non_empty_nodes[0]
    if target_node.text != expected_text:
        return False

    target_node.text = replacement_text
    return True


def apply_ai_replacement_to_text_nodes(
    text_nodes: list[ET.Element],
    replacement: dict,
) -> str | None:
    target_text = replacement.get("targetText")
    replacement_text = replacement.get("replacementText")
    if not isinstance(target_text, str) or not target_text:
        return None
    if not isinstance(replacement_text, str) or not replacement_text:
        return None

    for node in text_nodes:
        node_text = node.text or ""
        if target_text not in node_text:
            continue

        updated_text = node_text.replace(target_text, replacement_text, 1)
        if updated_text == node_text:
            continue

        node.text = updated_text
        return "".join(text_node.text or "" for text_node in text_nodes)

    return None


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
        json.loads(args.ai_replacements_json),
        table_auto_apply_mode=args.table_auto_apply_mode,
        table_patches=json.loads(args.table_patches_json),
    )
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
