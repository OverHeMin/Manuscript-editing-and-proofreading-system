from pathlib import Path
import shutil
import subprocess


DOC_MIME_TYPES = {"application/msword"}
DOCX_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}
DOCX_MIME_TYPE = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)


class UnsupportedDocumentFormatError(ValueError):
    pass


def sniff_document_type(file_name: str, mime_type: str) -> str:
    suffix = Path(file_name).suffix.lower()

    if suffix == ".docx":
        return "docx"

    if suffix == ".doc":
        return "doc"

    if mime_type in DOCX_MIME_TYPES:
        return "docx"

    if mime_type in DOC_MIME_TYPES:
        return "doc"

    raise UnsupportedDocumentFormatError(
        f"Unsupported document format for {file_name} ({mime_type})."
    )


def build_normalized_file_name(file_name: str) -> str:
    stem = Path(file_name).stem
    return f"{stem}.normalized.docx"


def build_normalized_storage_key(
    manuscript_id: str, source_asset_id: str, file_name: str
) -> str:
    return (
        f"normalized/{manuscript_id}/{source_asset_id}/"
        f"{build_normalized_file_name(file_name)}"
    )


def resolve_libreoffice_binary(tooling: dict | None = None) -> str | None:
    tooling = tooling or {}
    explicit_binary = tooling.get("libreoffice_binary")

    if explicit_binary:
        return explicit_binary

    return shutil.which("soffice") or shutil.which("libreoffice")


def build_libreoffice_command(
    binary: str, source_path: str, output_dir: str
) -> list[str]:
    return [
        binary,
        "--headless",
        "--convert-to",
        "docx",
        "--outdir",
        output_dir,
        source_path,
    ]


def run_libreoffice_conversion(
    source_path: str,
    output_dir: str,
    tooling: dict | None = None,
    runner=subprocess.run,
) -> dict:
    binary = resolve_libreoffice_binary(tooling)

    if not binary:
        return {
            "status": "tool_unavailable",
            "backend": "libreoffice",
            "output_path": None,
        }

    command = build_libreoffice_command(binary, source_path, output_dir)
    completed = runner(command, capture_output=True, text=True, check=False)

    if completed.returncode != 0:
        return {
            "status": "failed",
            "backend": "libreoffice",
            "output_path": None,
            "error": completed.stderr.strip() or completed.stdout.strip(),
            "command": command,
        }

    output_path = (
        Path(output_dir) / f"{Path(source_path).stem}.docx"
    ).as_posix()

    return {
        "status": "converted",
        "backend": "libreoffice",
        "output_path": output_path,
        "command": command,
    }


def build_normalization_job(request: dict, tooling: dict | None = None) -> dict:
    tooling = tooling or {}
    source_type = sniff_document_type(
        request["file_name"],
        request["mime_type"],
    )
    normalized_file_name = build_normalized_file_name(request["file_name"])
    conversion_required = source_type == "doc"
    libreoffice_available = bool(tooling.get("libreoffice_available", False))
    warnings: list[str] = []

    if conversion_required and libreoffice_available:
        conversion_status = "queued"
        conversion_backend = "libreoffice"
    elif conversion_required:
        conversion_status = "tool_unavailable"
        conversion_backend = "libreoffice"
        warnings.append(
            "LibreOffice unavailable; doc to docx normalization deferred."
        )
    else:
        conversion_status = "not_required"
        conversion_backend = None

    preview_status = "ready" if not conversion_required else "pending_normalization"

    return {
        "manuscript_id": request["manuscript_id"],
        "source_asset_id": request["source_asset_id"],
        "source_type": source_type,
        "current_type": source_type,
        "target_type": "docx",
        "derived_asset": {
            "asset_type": "normalized_docx",
            "parent_asset_id": request["source_asset_id"],
            "file_name": normalized_file_name,
            "mime_type": DOCX_MIME_TYPE,
            "storage_key": build_normalized_storage_key(
                request["manuscript_id"],
                request["source_asset_id"],
                request["file_name"],
            ),
        },
        "conversion": {
            "required": conversion_required,
            "backend": conversion_backend,
            "status": conversion_status,
        },
        "preview": {
            "viewer": "onlyoffice",
            "status": preview_status,
            "source_asset_type": "normalized_docx",
            "mime_type": DOCX_MIME_TYPE,
        },
        "warnings": warnings,
    }
