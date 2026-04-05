import argparse
import json
from collections.abc import Sequence
from pathlib import Path

from .artifacts import serialize_jsonable
from .operator_summary import build_operator_summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build a local operator summary for document enhancement artifacts."
    )
    parser.add_argument("--output-dir")
    parser.add_argument("--keep-last", type=int, default=20)
    parser.add_argument("--max-age-days", type=int)
    parser.add_argument("--history-limit", type=int, default=5)
    parser.add_argument("--attention-limit", type=int, default=5)
    parser.add_argument("--write-summary", action="store_true")
    parser.add_argument("--summary-output-dir")
    return parser


def main(argv: Sequence[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    output_dir = Path(args.output_dir) if args.output_dir else None
    summary_output_dir = (
        Path(args.summary_output_dir) if args.summary_output_dir else None
    )
    result = build_operator_summary(
        output_dir=output_dir,
        keep_last=args.keep_last,
        max_age_days=args.max_age_days,
        history_limit=args.history_limit,
        attention_limit=args.attention_limit,
        write_summary=args.write_summary,
        summary_output_dir=summary_output_dir,
    )
    print(json.dumps(serialize_jsonable(result), indent=2))


if __name__ == "__main__":
    main()
