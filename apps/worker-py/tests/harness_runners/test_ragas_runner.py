from pathlib import Path
import json
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from harness_runners.ragas_runner import (
    build_ragas_dataset,
    run_retrieval_quality,
)


def test_build_ragas_dataset_reads_a_published_gold_set_export():
    dataset = build_ragas_dataset(build_published_gold_set_export())

    assert dataset["schema_version"] == "retrieval_eval_dataset.v1"
    assert dataset["gold_set_version"]["id"] == "gold-version-1"
    assert dataset["module"] == "editing"
    assert dataset["sample_count"] == 2
    assert dataset["items"][0]["item_id"] == "gold-version-1:1"
    assert dataset["items"][0]["question"] == "How should the editing agent ground endpoint rules?"
    assert dataset["items"][0]["reference_context_ids"] == ["knowledge-1"]


def test_run_retrieval_quality_emits_a_normalized_json_envelope(tmp_path):
    input_path = tmp_path / "gold-set.json"
    output_path = tmp_path / "ragas-result.json"
    input_path.write_text(
        json.dumps(build_published_gold_set_export(), ensure_ascii=False),
        encoding="utf-8",
    )

    result = run_retrieval_quality(
        input_path=input_path,
        output_path=output_path,
        config={
            "embedding_provider": "local_stub",
            "embedding_model": "text-embedding-local",
            "llm_provider": "local_stub",
            "llm_model": "judge-local",
        },
        evaluator=fake_evaluator,
    )

    assert result["schema_version"] == "retrieval_quality_run.v1"
    assert result["status"] == "completed"
    assert result["dataset"]["gold_set_version_id"] == "gold-version-1"
    assert result["dataset"]["sample_count"] == 2
    assert result["config"]["embedding_provider"] == "local_stub"
    assert result["metric_summary"]["answer_relevancy"] == 0.88
    assert result["sample_results"][0]["item_id"] == "gold-version-1:1"
    assert output_path.exists()
    assert json.loads(output_path.read_text(encoding="utf-8")) == result


def build_published_gold_set_export():
    return {
        "family": {
            "id": "family-1",
            "name": "Editing retrieval gold set",
            "scope": {
                "module": "editing",
                "manuscript_types": ["clinical_study"],
                "measure_focus": "grounding",
                "template_family_id": "template-family-1",
            },
        },
        "gold_set_version": {
            "id": "gold-version-1",
            "version_no": 2,
            "status": "published",
            "items": [
                {
                    "source_kind": "reviewed_case_snapshot",
                    "source_id": "snapshot-1",
                    "manuscript_id": "manuscript-1",
                    "manuscript_type": "clinical_study",
                    "deidentification_passed": True,
                    "human_reviewed": True,
                    "expected_structured_output": {
                        "question": "How should the editing agent ground endpoint rules?",
                        "reference_answer": "Use the approved endpoint disclosure rule.",
                        "reference_context_ids": ["knowledge-1"],
                    },
                },
                {
                    "source_kind": "human_final_asset",
                    "source_id": "asset-2",
                    "manuscript_id": "manuscript-2",
                    "manuscript_type": "clinical_study",
                    "deidentification_passed": True,
                    "human_reviewed": True,
                    "expected_structured_output": {
                        "question": "Which checklist should drive terminology cleanup?",
                        "reference_answer": "Use the published terminology checklist.",
                        "reference_context_ids": ["knowledge-2"],
                    },
                },
            ],
        },
        "rubric": {
            "id": "rubric-1",
            "name": "Editing retrieval rubric",
            "version_no": 1,
            "status": "published",
        },
    }


def fake_evaluator(dataset, config):
    assert dataset["sample_count"] == 2
    assert config["embedding_provider"] == "local_stub"
    assert config["llm_provider"] == "local_stub"

    return {
        "engine": {
            "name": "ragas",
            "mode": "stub",
        },
        "metric_summary": {
            "answer_relevancy": 0.88,
            "context_precision": 0.81,
            "context_recall": 0.79,
        },
        "sample_results": [
            {
                "item_id": "gold-version-1:1",
                "metrics": {
                    "answer_relevancy": 0.9,
                    "context_precision": 0.84,
                },
            },
            {
                "item_id": "gold-version-1:2",
                "metrics": {
                    "answer_relevancy": 0.86,
                    "context_precision": 0.78,
                },
            },
        ],
    }
