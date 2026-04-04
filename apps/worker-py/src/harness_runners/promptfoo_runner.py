from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Callable


PromptfooSuite = dict[str, Any]
PromptfooConfig = dict[str, Any]
Executor = Callable[[PromptfooSuite, PromptfooConfig], dict[str, Any]]


def load_input_document(input_path: Path | str) -> dict[str, Any]:
    path = Path(input_path)
    document = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(document, dict):
        raise ValueError("Expected a JSON object input document.")
    return document


def build_promptfoo_suite(document: dict[str, Any]) -> PromptfooSuite:
    if document.get("schema_version") == "promptfoo_suite.v1":
        normalized = clone_json(document)
        normalized["case_count"] = len(normalized.get("cases", []))
        return normalized

    gold_set_version = document.get("gold_set_version")
    family = document.get("family")

    if not isinstance(gold_set_version, dict):
        raise ValueError("Input document must contain a gold_set_version object.")
    if gold_set_version.get("status") != "published":
        raise ValueError("Only published gold-set versions can seed Promptfoo suites.")
    if not isinstance(family, dict):
        raise ValueError("Input document must contain a family object.")

    items = gold_set_version.get("items")
    if not isinstance(items, list):
        raise ValueError("Input document must contain a gold_set_version.items array.")

    family_scope = family.get("scope") if isinstance(family.get("scope"), dict) else {}
    cases: list[dict[str, Any]] = []
    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            raise ValueError("Every gold-set item must be a JSON object.")

        expected = (
            item.get("expected_structured_output")
            if isinstance(item.get("expected_structured_output"), dict)
            else {}
        )
        question = expected.get(
            "question",
            f"Evaluate governed output for manuscript {item.get('manuscript_id')}.",
        )
        reference_answer = expected.get("reference_answer", "")

        cases.append(
            {
                "case_id": f"{gold_set_version.get('id')}:{index}",
                "description": f"{item.get('source_kind')}:{item.get('source_id')}",
                "vars": {
                    "question": question,
                    "manuscript_id": item.get("manuscript_id"),
                    "manuscript_type": item.get("manuscript_type"),
                },
                "assertions": (
                    [{"type": "contains", "value": reference_answer}]
                    if reference_answer
                    else []
                ),
                "metadata": {
                    "source_kind": item.get("source_kind"),
                    "source_id": item.get("source_id"),
                    "risk_tags": list(item.get("risk_tags", [])),
                },
            }
        )

    return {
        "schema_version": "promptfoo_suite.v1",
        "family": {
            "id": family.get("id"),
            "name": family.get("name"),
            "scope": clone_json(family_scope),
        },
        "gold_set_version": {
            "id": gold_set_version.get("id"),
            "version_no": gold_set_version.get("version_no"),
            "status": gold_set_version.get("status"),
        },
        "module": family_scope.get("module"),
        "template_family_id": family_scope.get("template_family_id"),
        "case_count": len(cases),
        "cases": cases,
    }


def run_promptfoo_suite(
    input_path: Path | str,
    output_path: Path | str | None = None,
    config: PromptfooConfig | None = None,
    executor: Executor | None = None,
) -> dict[str, Any]:
    document = load_input_document(input_path)
    suite = build_promptfoo_suite(document)
    normalized_config = normalize_config(config)
    evaluation = (executor or run_local_stub_executor)(suite, normalized_config)
    case_results = clone_json(evaluation.get("case_results")) or []
    summary = clone_json(evaluation.get("summary")) or {}

    pass_count = int(summary.get("pass_count", count_case_status(case_results, "pass")))
    fail_count = int(summary.get("fail_count", count_case_status(case_results, "fail")))
    case_count = max(suite["case_count"], 1)

    result = {
        "schema_version": "promptfoo_run.v1",
        "status": "completed",
        "engine": clone_json(evaluation.get("engine"))
        or {"name": "promptfoo", "mode": "local_stub"},
        "suite": {
            "gold_set_version_id": suite["gold_set_version"]["id"],
            "module": suite.get("module"),
            "template_family_id": suite.get("template_family_id"),
            "case_count": suite["case_count"],
        },
        "config": normalized_config,
        "summary": {
            "pass_count": pass_count,
            "fail_count": fail_count,
            "pass_rate": round(pass_count / case_count, 4),
        },
        "case_results": case_results,
    }

    if output_path is not None:
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return result


def run_local_stub_executor(
    suite: PromptfooSuite,
    config: PromptfooConfig,
) -> dict[str, Any]:
    case_results: list[dict[str, Any]] = []
    pass_count = 0

    for case in suite["cases"]:
        assertions = case.get("assertions", [])
        passed = len(assertions) > 0 and bool(assertions[0].get("value"))
        status = "pass" if passed else "fail"
        if passed:
          pass_count += 1
        case_results.append(
            {
                "case_id": case["case_id"],
                "status": status,
                "score": 1 if passed else 0,
            }
        )

    return {
        "engine": {
            "name": "promptfoo",
            "mode": "local_stub",
            "provider": config["provider"],
            "grader": config["grader"],
        },
        "summary": {
            "pass_count": pass_count,
            "fail_count": len(case_results) - pass_count,
        },
        "case_results": case_results,
    }


def normalize_config(config: PromptfooConfig | None) -> PromptfooConfig:
    normalized = {
        "provider": "local_stub",
        "grader": "local_stub",
    }
    if config:
        normalized.update({key: value for key, value in config.items() if value is not None})
    return normalized


def count_case_status(case_results: list[dict[str, Any]], status: str) -> int:
    return sum(1 for case in case_results if case.get("status") == status)


def clone_json(value: Any) -> Any:
    return json.loads(json.dumps(value))


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a local-first Promptfoo-style suite from governed JSON inputs.",
    )
    parser.add_argument("--input", required=True, help="Path to the Promptfoo suite or gold-set export JSON file.")
    parser.add_argument("--output", help="Path to write the normalized Promptfoo JSON envelope.")
    parser.add_argument("--provider", default="local_stub")
    parser.add_argument("--grader", default="local_stub")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    result = run_promptfoo_suite(
        input_path=args.input,
        output_path=args.output,
        config={
            "provider": args.provider,
            "grader": args.grader,
        },
    )

    if args.output:
        print(Path(args.output))
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
