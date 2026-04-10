from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import zipfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[2]
    / "src"
    / "document_pipeline"
    / "extract_docx_structure.py"
)


def test_extract_docx_structure_emits_utf8_json_without_console_crash(
    tmp_path: Path,
) -> None:
    docx_path = tmp_path / "encoding-sample.docx"
    write_minimal_docx(
        docx_path,
        document_xml="""
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p>
              <w:r><w:t>［摘　要］‌含有零宽字符和不换行空格 </w:t></w:r>
            </w:p>
          </w:body>
        </w:document>
        """,
    )

    completed = subprocess.run(
        [sys.executable, str(SCRIPT_PATH), "--source-path", str(docx_path)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env={
            **dict(),
            "PYTHONIOENCODING": "gbk",
        },
    )

    assert completed.returncode == 0, completed.stderr
    payload = json.loads(completed.stdout)
    assert payload["status"] == "ready"
    assert payload["blocks"][0]["text"].startswith("［摘　要］")


def write_minimal_docx(path: Path, document_xml: str) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("word/document.xml", document_xml)
