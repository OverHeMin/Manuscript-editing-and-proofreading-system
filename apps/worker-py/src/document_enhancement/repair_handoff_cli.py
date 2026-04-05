import argparse
import json
from collections.abc import Sequence
from pathlib import Path

from .artifacts import serialize_jsonable
from .repair_handoff import build_repair_handoff


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build a local repair handoff for document enhancement artifacts."
    )
    parser.add_argument("--output-dir")
    parser.add_argument("--keep-last", type=int, default=20)
    parser.add_argument("--max-age-days", type=int)
    parser.add_argument("--write-handoff", action="store_true")
    parser.add_argument("--handoff-output-dir")
    return parser


def main(argv: Sequence[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    output_dir = Path(args.output_dir) if args.output_dir else None
    handoff_output_dir = Path(args.handoff_output_dir) if args.handoff_output_dir else None
    result = build_repair_handoff(
        output_dir=output_dir,
        keep_last=args.keep_last,
        max_age_days=args.max_age_days,
        write_handoff=args.write_handoff,
        handoff_output_dir=handoff_output_dir,
    )
    print(json.dumps(serialize_jsonable(result), indent=2))


if __name__ == "__main__":
    main()
