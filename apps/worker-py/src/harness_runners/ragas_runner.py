from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Callable


DatasetDocument = dict[str, Any]
EvaluationConfig = dict[str, Any]
Evaluator = Callable[[DatasetDocument, EvaluationConfig], dict[str, Any]]


def load_input_document(input_path: Path | str) -> dict[str, Any]:
    path = Path(input_path)
    document = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(document, dict):
        raise ValueError("Expected a JSON object input document.")
    return document


def build_ragas_dataset(document: dict[str, Any]) -> DatasetDocument:
    if document.get("schema_version") == "retrieval_eval_dataset.v1":
        return clone_json(document)

    gold_set_version = document.get("gold_set_version")
    family = document.get("family")

    if not isinstance(gold_set_version, dict):
        raise ValueError("Input document must contain a gold_set_version object.")
    if gold_set_version.get("status") != "published":
        raise ValueError("Only published gold-set versions can be evaluated.")
    if not isinstance(family, dict):
        raise ValueError("Input document must contain a family object.")

    items = gold_set_version.get("items")
    if not isinstance(items, list):
        raise ValueError("Input document must contain a gold_set_version.items array.")

    family_scope = family.get("scope") if isinstance(family.get("scope"), dict) else {}
    dataset_items = []
    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            raise ValueError("Every gold-set item must be a JSON object.")

        expected = (
            item.get("expected_structured_output")
            if isinstance(item.get("expected_structured_output"), dict)
            else {}
        )
        item_id = f"{gold_set_version.get('id')}:{index}"
        dataset_items.append(
            {
                "item_id": item_id,
                "question": expected.get(
                    "question",
                    f"Retrieve grounding context for manuscript {item.get('manuscript_id')}.",
                ),
                "reference_answer": expected.get("reference_answer", ""),
                "reference_context_ids": list(expected.get("reference_context_ids", [])),
                "metadata": {
                    "source_kind": item.get("source_kind"),
                    "source_id": item.get("source_id"),
                    "manuscript_id": item.get("manuscript_id"),
                    "manuscript_type": item.get("manuscript_type"),
                    "risk_tags": list(item.get("risk_tags", [])),
                },
            }
        )

    return {
        "schema_version": "retrieval_eval_dataset.v1",
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
        "sample_count": len(dataset_items),
        "items": dataset_items,
    }


def run_retrieval_quality(
    input_path: Path | str,
    output_path: Path | str | None = None,
    config: EvaluationConfig | None = None,
    evaluator: Evaluator | None = None,
) -> dict[str, Any]:
    document = load_input_document(input_path)
    dataset = build_ragas_dataset(document)
    normalized_config = normalize_config(config)
    evaluation = (evaluator or run_local_stub_evaluator)(dataset, normalized_config)

    result = {
        "schema_version": "retrieval_quality_run.v1",
        "status": "completed",
        "engine": clone_json(evaluation.get("engine"))
        or {"name": "ragas", "mode": "local_stub"},
        "dataset": {
            "gold_set_version_id": dataset["gold_set_version"]["id"],
            "module": dataset.get("module"),
            "template_family_id": dataset.get("template_family_id"),
            "sample_count": dataset["sample_count"],
        },
        "config": normalized_config,
        "metric_summary": clone_json(evaluation.get("metric_summary")) or {},
        "sample_results": clone_json(evaluation.get("sample_results")) or [],
    }

    if output_path is not None:
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return result


def run_local_stub_evaluator(dataset: DatasetDocument, config: EvaluationConfig) -> dict[str, Any]:
    sample_results: list[dict[str, Any]] = []
    answer_relevancy_total = 0.0
    context_precision_total = 0.0
    context_recall_total = 0.0

    for item in dataset["items"]:
        has_reference_context = len(item.get("reference_context_ids", [])) > 0
        answer_relevancy = 0.9 if has_reference_context else 0.7
        context_precision = 0.85 if has_reference_context else 0.6
        context_recall = 0.82 if has_reference_context else 0.58

        sample_results.append(
            {
                "item_id": item["item_id"],
                "metrics": {
                    "answer_relevancy": answer_relevancy,
                    "context_precision": context_precision,
                    "context_recall": context_recall,
                },
            }
        )
        answer_relevancy_total += answer_relevancy
        context_precision_total += context_precision
        context_recall_total += context_recall

    sample_count = max(dataset["sample_count"], 1)
    return {
        "engine": {
            "name": "ragas",
            "mode": "local_stub",
            "embedding_provider": config["embedding_provider"],
            "llm_provider": config["llm_provider"],
        },
        "metric_summary": {
            "answer_relevancy": round(answer_relevancy_total / sample_count, 4),
            "context_precision": round(context_precision_total / sample_count, 4),
            "context_recall": round(context_recall_total / sample_count, 4),
        },
        "sample_results": sample_results,
    }


def normalize_config(config: EvaluationConfig | None) -> EvaluationConfig:
    normalized = {
        "embedding_provider": "local_stub",
        "embedding_model": "text-embedding-local",
        "llm_provider": "local_stub",
        "llm_model": "judge-local",
    }
    if config:
        normalized.update({key: value for key, value in config.items() if value is not None})
    return normalized


def clone_json(value: Any) -> Any:
    return json.loads(json.dumps(value))


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a local-first retrieval-quality evaluation from a gold-set export or retrieval dataset.",
    )
    parser.add_argument("--input", required=True, help="Path to the gold-set export or retrieval dataset JSON file.")
    parser.add_argument("--output", help="Path to write the normalized retrieval-quality JSON envelope.")
    parser.add_argument("--embedding-provider", default="local_stub")
    parser.add_argument("--embedding-model", default="text-embedding-local")
    parser.add_argument("--llm-provider", default="local_stub")
    parser.add_argument("--llm-model", default="judge-local")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    result = run_retrieval_quality(
        input_path=args.input,
        output_path=args.output,
        config={
            "embedding_provider": args.embedding_provider,
            "embedding_model": args.embedding_model,
            "llm_provider": args.llm_provider,
            "llm_model": args.llm_model,
        },
    )

    if args.output:
        print(Path(args.output))
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
