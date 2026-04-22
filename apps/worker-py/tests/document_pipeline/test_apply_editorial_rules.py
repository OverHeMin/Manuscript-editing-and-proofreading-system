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
W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


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

    result = apply_rules_to_docx(source_path, output_path, rules, [])

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


def test_apply_rules_to_docx_skips_ai_replacements_that_span_multiple_runs(tmp_path):
    source_path = tmp_path / "source-multi-run.docx"
    output_path = tmp_path / "output-multi-run.docx"
    source_path.parent.mkdir(parents=True, exist_ok=True)

    document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W_NS}">
  <w:body>
    <w:p>
      <w:r><w:t>5 mg </w:t></w:r>
      <w:r><w:t>per dL</w:t></w:r>
    </w:p>
    <w:sectPr/>
  </w:body>
</w:document>
"""
    content_types_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
"""
    rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
"""

    with zipfile.ZipFile(source_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types_xml)
        archive.writestr("_rels/.rels", rels_xml)
        archive.writestr("word/document.xml", document_xml)

    result = apply_rules_to_docx(
        source_path,
        output_path,
        [],
        [
            {
                "targetText": "5 mg per dL",
                "replacementText": "5 mg/dL",
            }
        ],
    )

    assert result["applied_rule_ids"] == []
    assert result["applied_changes"] == []

    with zipfile.ZipFile(output_path, "r") as archive:
        output_xml = archive.read("word/document.xml").decode("utf-8")

    assert "<w:t>5 mg </w:t>" in output_xml
    assert "<w:t>per dL</w:t>" in output_xml
