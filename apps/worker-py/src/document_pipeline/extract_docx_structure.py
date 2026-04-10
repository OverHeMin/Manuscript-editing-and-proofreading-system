from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import zipfile


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from document_pipeline.parse_docx import extract_structure_from_document_xml


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-path", required=True)
    return parser.parse_args()


def build_manual_review_result(message: str) -> dict:
    return {
        "status": "needs_manual_review",
        "parser": "python_docx_ooxml",
        "sections": [],
        "blocks": [],
        "tables": [],
        "warnings": [message],
    }


def emit_json(payload: dict) -> None:
    text = json.dumps(payload, ensure_ascii=False)
    sys.stdout.buffer.write(text.encode("utf-8"))
    sys.stdout.buffer.write(b"\n")


def main() -> None:
    args = parse_args()
    source_path = Path(args.source_path)

    if not source_path.exists():
        emit_json(
            build_manual_review_result(
                f"The DOCX file could not be found at {source_path}."
            )
        )
        return

    try:
        with zipfile.ZipFile(source_path, "r") as archive:
            document_xml = archive.read("word/document.xml")
    except KeyError:
        emit_json(
            build_manual_review_result(
                "The DOCX archive does not contain word/document.xml."
            )
        )
        return
    except zipfile.BadZipFile:
        emit_json(
            build_manual_review_result("The source asset is not a valid DOCX archive.")
        )
        return

    result = extract_structure_from_document_xml(document_xml)
    emit_json(result)


if __name__ == "__main__":
    main()
