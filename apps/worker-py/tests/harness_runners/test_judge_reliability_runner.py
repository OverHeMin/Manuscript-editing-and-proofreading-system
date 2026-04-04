from pathlib import Path
import json
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from harness_runners.judge_reliability_runner import (
    build_judge_calibration_batch,
    run_judge_reliability,
)


def test_build_judge_calibration_batch_reads_a_governed_local_batch():
    batch = build_judge_calibration_batch(build_calibration_batch_document())

    assert batch["schema_version"] == "judge_calibration_batch.v1"
    assert batch["calibration_batch"]["id"] == "judge-batch-1"
    assert batch["sample_count"] == 3
    assert batch["items"][0]["item_id"] == "judge-item-1"
    assert batch["items"][1]["human_label"] == "reject"


def test_run_judge_reliability_compares_human_labels_and_judge_outputs(tmp_path):
    input_path = tmp_path / "judge-batch.json"
    output_path = tmp_path / "judge-result.json"
    input_path.write_text(
        json.dumps(build_calibration_batch_document(), ensure_ascii=False),
        encoding="utf-8",
    )

    result = run_judge_reliability(
        input_path=input_path,
        output_path=output_path,
        config={
            "judge_provider": "local_stub",
            "judge_model": "judge-local",
        },
        evaluator=fake_evaluator,
    )

    assert result["schema_version"] == "judge_reliability_run.v1"
    assert result["status"] == "completed"
    assert result["batch"]["calibration_batch_id"] == "judge-batch-1"
    assert result["batch"]["sample_count"] == 3
    assert result["config"]["judge_provider"] == "local_stub"
    assert result["summary"]["exact_match_rate"] == 0.6667
    assert result["summary"]["agreement_count"] == 2
    assert result["summary"]["disagreement_count"] == 1
    assert result["sample_results"][1]["item_id"] == "judge-item-2"
    assert result["sample_results"][1]["agrees_with_human"] is False
    assert output_path.exists()
    assert json.loads(output_path.read_text(encoding="utf-8")) == result


def build_calibration_batch_document():
    return {
        "schema_version": "judge_calibration_batch.v1",
        "calibration_batch": {
            "id": "judge-batch-1",
            "rubric_id": "rubric-1",
            "rubric_version": 2,
            "module": "editing",
        },
        "items": [
            {
                "item_id": "judge-item-1",
                "human_label": "approve",
                "judge_output": {
                    "label": "approve",
                    "score": 0.97,
                },
            },
            {
                "item_id": "judge-item-2",
                "human_label": "reject",
                "judge_output": {
                    "label": "approve",
                    "score": 0.54,
                },
            },
            {
                "item_id": "judge-item-3",
                "human_label": "reject",
                "judge_output": {
                    "label": "reject",
                    "score": 0.91,
                },
            },
        ],
    }


def fake_evaluator(batch, config):
    assert batch["sample_count"] == 3
    assert config["judge_provider"] == "local_stub"
    assert config["judge_model"] == "judge-local"

    return {
        "engine": {
            "name": "judge_reliability",
            "mode": "stub",
        },
        "sample_results": [
            {
                "item_id": "judge-item-1",
                "human_label": "approve",
                "judge_label": "approve",
                "judge_score": 0.97,
                "agrees_with_human": True,
            },
            {
                "item_id": "judge-item-2",
                "human_label": "reject",
                "judge_label": "approve",
                "judge_score": 0.54,
                "agrees_with_human": False,
            },
            {
                "item_id": "judge-item-3",
                "human_label": "reject",
                "judge_label": "reject",
                "judge_score": 0.91,
                "agrees_with_human": True,
            },
        ],
    }
