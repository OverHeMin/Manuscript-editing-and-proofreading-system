from pathlib import Path
import os
import socket
from urllib.parse import urlparse

from src.document_pipeline import build_normalization_job
from src.module_runners import (
    build_editing_plan,
    build_proofreading_draft_plan,
    build_proofreading_final_plan,
    build_screening_plan,
)
from src.pdf_pipeline import (
    PdfHeadingExtractionAdapters,
    compare_toc_and_body_headings,
    extract_pdf_heading_sets,
)


APP_ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    for file_name in [".env", ".env.example"]:
        load_env_defaults(APP_ROOT / file_name)

    assert_tcp_reachable("Postgres", require_env("DATABASE_URL"))
    assert_tcp_reachable("Redis", require_env("REDIS_URL"))
    assert_tcp_reachable("Object storage", require_env("OBJECT_STORAGE_ENDPOINT"))
    require_optional_value("LIBREOFFICE_BINARY")

    _ = build_normalization_job(
        {
            "manuscript_id": "smoke-manuscript",
            "source_asset_id": "asset-original",
            "file_name": "manuscript.docx",
            "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }
    )
    _ = build_screening_plan()
    _ = build_editing_plan()
    _ = build_proofreading_draft_plan()
    _ = build_proofreading_final_plan()
    _ = compare_toc_and_body_headings([], [])
    _ = extract_pdf_heading_sets(
        "placeholder.pdf",
        adapters=PdfHeadingExtractionAdapters(
            toc=NullTocExtractor(),
            body=NullBodyExtractor(),
        ),
    )

    print("[worker] smoke boot OK")


def load_env_defaults(file_path: Path) -> None:
    if not file_path.exists():
        return

    for line in file_path.read_text(encoding="utf-8").splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#") or "=" not in trimmed:
            continue

        key, value = trimmed.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")

    return value


def require_optional_value(name: str) -> None:
    value = os.environ.get(name)
    if value is not None and not value.strip():
        raise RuntimeError(f"Environment variable {name} must not be empty when set")


def assert_tcp_reachable(label: str, endpoint: str) -> None:
    parsed = urlparse(endpoint)
    hostname = parsed.hostname
    port = parsed.port or default_port_for_scheme(parsed.scheme)

    if not hostname or not port:
        raise RuntimeError(f"{label} endpoint is invalid: {endpoint}")

    with socket.create_connection((hostname, port), timeout=2.5):
        return


def default_port_for_scheme(scheme: str) -> int:
    if scheme in {"postgresql", "postgres"}:
        return 5432
    if scheme == "redis":
        return 6379
    if scheme == "http":
        return 80
    if scheme == "https":
        return 443

    raise RuntimeError(f"Unsupported scheme for smoke boot: {scheme}")


class NullTocExtractor:
    def extract_toc_headings(self, pdf_path: str) -> list[dict]:
        return []


class NullBodyExtractor:
    def extract_body_headings(self, pdf_path: str) -> list[dict]:
        return []


if __name__ == "__main__":
    main()
