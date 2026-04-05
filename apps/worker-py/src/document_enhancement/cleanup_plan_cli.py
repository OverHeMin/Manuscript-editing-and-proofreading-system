import argparse
import json
from collections.abc import Sequence
from pathlib import Path

from .artifacts import serialize_jsonable
from .cleanup_plan import build_cleanup_plan


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build a local cleanup plan for document enhancement artifacts."
    )
    parser.add_argument("--output-dir")
    parser.add_argument("--keep-last", type=int, default=20)
    parser.add_argument("--max-age-days", type=int)
    parser.add_argument("--write-plan", action="store_true")
    parser.add_argument("--plan-output-dir")
    return parser


def main(argv: Sequence[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    output_dir = Path(args.output_dir) if args.output_dir else None
    plan_output_dir = Path(args.plan_output_dir) if args.plan_output_dir else None
    result = build_cleanup_plan(
        output_dir=output_dir,
        keep_last=args.keep_last,
        max_age_days=args.max_age_days,
        write_plan=args.write_plan,
        plan_output_dir=plan_output_dir,
    )
    print(json.dumps(serialize_jsonable(result), indent=2))


if __name__ == "__main__":
    main()
