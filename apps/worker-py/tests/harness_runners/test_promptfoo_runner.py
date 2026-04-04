from pathlib import Path
import json
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from harness_runners.promptfoo_runner import (
    build_promptfoo_suite,
    run_promptfoo_suite,
)


def test_build_promptfoo_suite_reads_a_published_gold_set_export():
    suite = build_promptfoo_suite(build_published_gold_set_export())

    assert suite["schema_version"] == "promptfoo_suite.v1"
    assert suite["gold_set_version"]["id"] == "gold-version-1"
    assert suite["module"] == "editing"
    assert suite["case_count"] == 2
    assert suite["cases"][0]["case_id"] == "gold-version-1:1"
    assert (
        suite["cases"][0]["vars"]["question"]
        == "How should the editing agent ground endpoint rules?"
    )
    assert suite["cases"][0]["assertions"] == [
        {
            "type": "contains",
            "value": "Use the approved endpoint disclosure rule.",
        }
    ]


def test_run_promptfoo_suite_emits_a_normalized_json_envelope(tmp_path):
    input_path = tmp_path / "gold-set.json"
    output_path = tmp_path / "promptfoo-result.json"
    input_path.write_text(
        json.dumps(build_published_gold_set_export(), ensure_ascii=False),
        encoding="utf-8",
    )

    result = run_promptfoo_suite(
        input_path=input_path,
        output_path=output_path,
        config={
            "provider": "local_stub",
            "grader": "local_stub",
        },
        executor=fake_executor,
    )

    assert result["schema_version"] == "promptfoo_run.v1"
    assert result["status"] == "completed"
    assert result["suite"]["gold_set_version_id"] == "gold-version-1"
    assert result["suite"]["case_count"] == 2
    assert result["config"]["provider"] == "local_stub"
    assert result["summary"]["pass_count"] == 1
    assert result["summary"]["fail_count"] == 1
    assert result["summary"]["pass_rate"] == 0.5
    assert result["case_results"][0]["case_id"] == "gold-version-1:1"
    assert output_path.exists()
    assert json.loads(output_path.read_text(encoding="utf-8")) == result


def build_published_gold_set_export():
    return {
        "family": {
            "id": "family-1",
            "name": "Editing prompt evaluation gold set",
            "scope": {
                "module": "editing",
                "manuscript_types": ["clinical_study"],
                "measure_focus": "conformance",
                "template_family_id": "template-family-1",
            },
        },
        "gold_set_version": {
            "id": "gold-version-1",
            "version_no": 1,
            "status": "published",
            "items": [
                {
                    "source_kind": "reviewed_case_snapshot",
                    "source_id": "snapshot-1",
                    "manuscript_id": "manuscript-1",
                    "manuscript_type": "clinical_study",
                    "expected_structured_output": {
                        "question": "How should the editing agent ground endpoint rules?",
                        "reference_answer": "Use the approved endpoint disclosure rule.",
                    },
                },
                {
                    "source_kind": "human_final_asset",
                    "source_id": "asset-2",
                    "manuscript_id": "manuscript-2",
                    "manuscript_type": "clinical_study",
                    "expected_structured_output": {
                        "question": "Which checklist should drive terminology cleanup?",
                        "reference_answer": "Use the published terminology checklist.",
                    },
                },
            ],
        },
    }


def fake_executor(suite, config):
    assert suite["case_count"] == 2
    assert config["provider"] == "local_stub"
    assert config["grader"] == "local_stub"

    return {
        "engine": {
            "name": "promptfoo",
            "mode": "stub",
        },
        "summary": {
            "pass_count": 1,
            "fail_count": 1,
        },
        "case_results": [
            {
                "case_id": "gold-version-1:1",
                "status": "pass",
                "score": 1,
            },
            {
                "case_id": "gold-version-1:2",
                "status": "fail",
                "score": 0,
            },
        ],
    }
