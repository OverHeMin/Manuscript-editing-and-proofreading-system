import argparse
import json
from collections.abc import Sequence
from pathlib import Path

from .artifacts import serialize_jsonable
from .index_consistency import evaluate_index_consistency


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Audit local document enhancement index consistency."
    )
    parser.add_argument("--output-dir")
    return parser


def main(argv: Sequence[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    output_dir = Path(args.output_dir) if args.output_dir else None
    result = evaluate_index_consistency(output_dir=output_dir)
    print(json.dumps(serialize_jsonable(result), indent=2))


if __name__ == "__main__":
    main()
