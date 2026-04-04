import argparse
import json
import os
from collections.abc import Sequence
from dataclasses import asdict
from pathlib import Path

from .academic_structure import build_academic_structure_advisory
from .contracts import DocumentEnhancementAuditReport
from .privacy import build_privacy_advisory


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Emit a local-first advisory privacy and academic-structure audit report."
        )
    )
    parser.add_argument("--document-path", required=True)
    parser.add_argument("--text-file")
    parser.add_argument(
        "--text-layer",
        choices=("present", "missing", "unknown"),
        default="unknown",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    environment = dict(os.environ)

    notes = [
        "Local-first advisory evidence only; missing adapters or unavailable local files degrade instead of blocking runtime flows.",
    ]
    text = None
    document_path = Path(args.document_path)

    if args.text_file:
        text_file = Path(args.text_file)
        try:
            text = text_file.read_text(encoding="utf-8")
        except OSError as exc:
            notes.append(
                f"Unable to read text file {text_file}: {exc}. Privacy advisory degraded to manual review."
            )

    if not document_path.exists():
        notes.append(
            f"Document path {document_path} does not exist locally; academic-structure guidance is based on path metadata only."
        )

    report = DocumentEnhancementAuditReport(
        document_path=str(document_path),
        privacy=build_privacy_advisory(text, environment=environment),
        academic_structure=build_academic_structure_advisory(
            document_path=str(document_path),
            text_layer=args.text_layer,
            environment=environment,
        ),
        notes=notes,
    )

    print(json.dumps(asdict(report), indent=2))


if __name__ == "__main__":
    main()
