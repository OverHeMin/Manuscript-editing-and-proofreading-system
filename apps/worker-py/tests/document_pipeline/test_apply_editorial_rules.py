from pathlib import Path
import sys
import zipfile


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from document_pipeline.apply_editorial_rules import (  # noqa: E402
    apply_rules_to_docx,
    transform_heading,
)
from document_pipeline.materialize_docx import write_docx  # noqa: E402

BEFORE_HEADING = "\u6458\u8981 \u76ee\u7684"
AFTER_HEADING = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09"
BODY_TEXT = "\u6b63\u6587\u6bb5\u843d"


def test_replace_heading_with_full_width_brackets_and_space():
    rule = {
        "id": "rule-abstract-objective",
        "rule_type": "format",
        "execution_mode": "apply_and_inspect",
        "confidence_policy": "always_auto",
        "trigger": {"kind": "exact_text", "text": BEFORE_HEADING},
        "action": {"kind": "replace_heading", "to": AFTER_HEADING},
    }

    assert transform_heading(BEFORE_HEADING, rule) == AFTER_HEADING


def test_apply_rules_to_docx_writes_transformed_output_and_change_log(tmp_path):
    source_path = tmp_path / "source.docx"
    output_path = tmp_path / "output.docx"
    write_docx(source_path, [BEFORE_HEADING, BODY_TEXT])
    rules = [
        {
            "id": "rule-abstract-objective",
            "rule_type": "format",
            "execution_mode": "apply_and_inspect",
            "confidence_policy": "always_auto",
            "trigger": {"kind": "exact_text", "text": BEFORE_HEADING},
            "action": {"kind": "replace_heading", "to": AFTER_HEADING},
        }
    ]

    result = apply_rules_to_docx(source_path, output_path, rules)

    assert result["applied_rule_ids"] == ["rule-abstract-objective"]
    assert result["applied_changes"] == [
        {
            "ruleId": "rule-abstract-objective",
            "before": BEFORE_HEADING,
            "after": AFTER_HEADING,
        }
    ]

    with zipfile.ZipFile(output_path, "r") as archive:
        document_xml = archive.read("word/document.xml").decode("utf-8")

    assert AFTER_HEADING in document_xml
    assert BEFORE_HEADING not in document_xml
