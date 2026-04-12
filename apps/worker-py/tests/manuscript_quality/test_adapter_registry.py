from pathlib import Path
import subprocess
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from manuscript_quality.adapter_registry import build_adapter_registry
from manuscript_quality.run_quality_checks import run_quality_checks

SCRIPT_PATH = (
    Path(__file__).resolve().parents[2]
    / "src"
    / "manuscript_quality"
    / "run_quality_checks.py"
)


def test_adapter_registry_defaults_to_disabled_and_keeps_opt_in_without_runner_metadata_only():
    default_registry = build_adapter_registry(
        env={},
        module_checker=lambda _: True,
    )

    default_metadata = default_registry.list_adapters()

    assert default_registry.enabled_adapters() == []
    assert {entry["adapter_id"] for entry in default_metadata} == {
        "autocorrect",
        "pycorrector",
    }
    assert all(entry["enabled"] is False for entry in default_metadata)
    assert all(entry["configured"] is False for entry in default_metadata)

    opted_in_registry = build_adapter_registry(
        env={"MANUSCRIPT_QUALITY_ENABLE_PYCORRECTOR": "1"},
        module_checker=lambda _: True,
    )

    pycorrector = next(
        entry
        for entry in opted_in_registry.list_adapters()
        if entry["adapter_id"] == "pycorrector"
    )

    assert opted_in_registry.enabled_adapters() == []
    assert pycorrector["configured"] is True
    assert pycorrector["available"] is True
    assert pycorrector["enabled"] is False
    assert pycorrector["execution_mode"] == "metadata_only"


def test_run_quality_checks_keeps_external_adapter_findings_advisory_only():
    registry = build_adapter_registry(
        env={"MANUSCRIPT_QUALITY_ENABLE_PYCORRECTOR": "1"},
        module_checker=lambda _: True,
        runner_factories={
            "pycorrector": lambda: (
                lambda payload: [
                    {
                        "issue_type": "external.risky_claim",
                        "category": "sensitive_and_compliance",
                        "severity": "critical",
                        "action": "block",
                        "confidence": 0.92,
                        "text_excerpt": "璇ヨ鍙ヤ緷璧栧閮ㄩ€傞厤鍣ㄥ垽瀹氥€?",
                        "explanation": "External adapter flagged the sentence as risky.",
                    }
                ]
            ),
        },
    )

    report = run_quality_checks(
        [{"text": "璇ヨ鍙ュ彲浠ョ敤浜庢祴璇曞閮ㄩ€傞厤鍣ㄣ€?", "style": "Normal"}],
        registry=registry,
    )

    external_issue = next(
        issue
        for issue in report["issues"]
        if issue["source_id"] == "third_party/pycorrector"
    )

    assert external_issue["action"] == "manual_review"
    assert external_issue["source_kind"] == "third_party_adapter"
    assert external_issue["module_scope"] == "general_proofreading"
    assert report["adapters"][1]["enabled"] is True


def test_run_quality_checks_script_executes_from_direct_path():
    result = subprocess.run(
        [sys.executable, str(SCRIPT_PATH)],
        input='{"blocks":[{"text":"绀轰緥鏂囨湰銆?","style":"Normal"}]}',
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0
    assert '"module_scope": "general_proofreading"' in result.stdout
