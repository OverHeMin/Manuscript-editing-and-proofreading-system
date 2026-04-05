import argparse
import json
from collections.abc import Sequence
from pathlib import Path

from .artifacts import serialize_jsonable
from .retention import evaluate_retention_audit


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Evaluate local retention recommendations for document enhancement artifacts."
    )
    parser.add_argument("--output-dir")
    parser.add_argument("--keep-last", type=int, default=20)
    parser.add_argument("--max-age-days", type=int)
    return parser


def main(argv: Sequence[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    output_dir = Path(args.output_dir) if args.output_dir else None
    result = evaluate_retention_audit(
        output_dir=output_dir,
        keep_last=args.keep_last,
        max_age_days=args.max_age_days,
    )
    print(json.dumps(serialize_jsonable(result), indent=2))


if __name__ == "__main__":
    main()
