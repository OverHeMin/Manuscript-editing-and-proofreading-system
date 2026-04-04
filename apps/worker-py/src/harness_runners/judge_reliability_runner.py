from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Callable


CalibrationBatch = dict[str, Any]
JudgeConfig = dict[str, Any]
Evaluator = Callable[[CalibrationBatch, JudgeConfig], dict[str, Any]]


def load_input_document(input_path: Path | str) -> dict[str, Any]:
    path = Path(input_path)
    document = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(document, dict):
        raise ValueError("Expected a JSON object input document.")
    return document


def build_judge_calibration_batch(document: dict[str, Any]) -> CalibrationBatch:
    calibration_batch = document.get("calibration_batch")
    items = document.get("items")

    if not isinstance(calibration_batch, dict):
        raise ValueError("Input document must contain a calibration_batch object.")
    if not isinstance(items, list):
        raise ValueError("Input document must contain an items array.")

    normalized = {
        "schema_version": "judge_calibration_batch.v1",
        "calibration_batch": clone_json(calibration_batch),
        "sample_count": len(items),
        "items": clone_json(items),
    }
    return normalized


def run_judge_reliability(
    input_path: Path | str,
    output_path: Path | str | None = None,
    config: JudgeConfig | None = None,
    evaluator: Evaluator | None = None,
) -> dict[str, Any]:
    document = load_input_document(input_path)
    batch = build_judge_calibration_batch(document)
    normalized_config = normalize_config(config)
    evaluation = (evaluator or run_local_stub_evaluator)(batch, normalized_config)
    sample_results = clone_json(evaluation.get("sample_results")) or []

    agreement_count = sum(
        1 for result in sample_results if result.get("agrees_with_human") is True
    )
    disagreement_item_ids = [
        result.get("item_id")
        for result in sample_results
        if result.get("agrees_with_human") is False
    ]
    sample_count = max(batch["sample_count"], 1)

    result = {
        "schema_version": "judge_reliability_run.v1",
        "status": "completed",
        "engine": clone_json(evaluation.get("engine"))
        or {"name": "judge_reliability", "mode": "local_stub"},
        "batch": {
            "calibration_batch_id": batch["calibration_batch"]["id"],
            "sample_count": batch["sample_count"],
            "module": batch["calibration_batch"].get("module"),
        },
        "config": normalized_config,
        "summary": {
            "agreement_count": agreement_count,
            "disagreement_count": len(sample_results) - agreement_count,
            "exact_match_rate": round(agreement_count / sample_count, 4),
            "disagreement_item_ids": disagreement_item_ids,
        },
        "sample_results": sample_results,
    }

    if output_path is not None:
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return result


def run_local_stub_evaluator(
    batch: CalibrationBatch,
    config: JudgeConfig,
) -> dict[str, Any]:
    sample_results: list[dict[str, Any]] = []

    for item in batch["items"]:
        judge_output = item.get("judge_output") if isinstance(item.get("judge_output"), dict) else {}
        human_label = item.get("human_label")
        judge_label = judge_output.get("label")
        sample_results.append(
            {
                "item_id": item.get("item_id"),
                "human_label": human_label,
                "judge_label": judge_label,
                "judge_score": judge_output.get("score"),
                "agrees_with_human": judge_label == human_label,
            }
        )

    return {
        "engine": {
            "name": "judge_reliability",
            "mode": "local_stub",
            "judge_provider": config["judge_provider"],
            "judge_model": config["judge_model"],
        },
        "sample_results": sample_results,
    }


def normalize_config(config: JudgeConfig | None) -> JudgeConfig:
    normalized = {
        "judge_provider": "local_stub",
        "judge_model": "judge-local",
    }
    if config:
        normalized.update({key: value for key, value in config.items() if value is not None})
    return normalized


def clone_json(value: Any) -> Any:
    return json.loads(json.dumps(value))


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a local-first judge reliability comparison batch.",
    )
    parser.add_argument("--input", required=True, help="Path to the judge calibration batch JSON file.")
    parser.add_argument("--output", help="Path to write the normalized judge-reliability JSON envelope.")
    parser.add_argument("--judge-provider", default="local_stub")
    parser.add_argument("--judge-model", default="judge-local")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    result = run_judge_reliability(
        input_path=args.input,
        output_path=args.output,
        config={
            "judge_provider": args.judge_provider,
            "judge_model": args.judge_model,
        },
    )

    if args.output:
        print(Path(args.output))
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
