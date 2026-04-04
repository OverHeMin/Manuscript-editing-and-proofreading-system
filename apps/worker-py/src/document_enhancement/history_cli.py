import argparse
import json
from collections.abc import Sequence
from pathlib import Path

from .artifacts import serialize_jsonable
from .history import list_audit_history, replay_audit_artifact


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="List or replay local document enhancement audit artifacts."
    )
    mode_group = parser.add_mutually_exclusive_group(required=True)
    mode_group.add_argument("--list", action="store_true")
    mode_group.add_argument("--artifact-path")
    parser.add_argument("--output-dir")
    parser.add_argument("--limit", type=int, default=10)
    return parser


def main(argv: Sequence[str] | None = None) -> None:
    args = build_parser().parse_args(argv)

    if args.list:
        output_dir = Path(args.output_dir) if args.output_dir else None
        result = list_audit_history(output_dir=output_dir, limit=args.limit)
    else:
        result = replay_audit_artifact(Path(args.artifact_path))

    print(json.dumps(serialize_jsonable(result), indent=2))


if __name__ == "__main__":
    main()
