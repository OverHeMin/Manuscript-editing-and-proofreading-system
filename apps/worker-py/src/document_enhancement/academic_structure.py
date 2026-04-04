import os
from collections.abc import Mapping
from pathlib import Path
from shutil import which

from .contracts import AcademicStructureAdvisoryResult, AdapterStatus


def build_academic_structure_advisory(
    document_path: str,
    text_layer: str = "unknown",
    environment: Mapping[str, str] | None = None,
) -> AcademicStructureAdvisoryResult:
    document_kind = resolve_document_kind(document_path)
    adapters = resolve_structure_adapters(environment)

    if document_kind != "pdf":
        return AcademicStructureAdvisoryResult(
            status="not_required",
            document_kind=document_kind,
            recommended_path=[],
            notes=[
                "This advisory slice does not require OCR for non-PDF inputs.",
                "Academic-structure enhancement stays operator-owned and optional.",
            ],
            adapters=adapters,
        )

    if text_layer == "present":
        grobid_ready = adapter_is_configured(adapters, "grobid_local")
        return AcademicStructureAdvisoryResult(
            status="ready" if grobid_ready else "degraded",
            document_kind=document_kind,
            recommended_path=["grobid_local"],
            notes=[
                "A text layer is already present, so OCR is not the primary next step.",
                "This report is advisory-only and does not launch structure extraction.",
            ],
            adapters=adapters,
        )

    recommended_path = ["ocrmypdf_local", "paddleocr_local", "grobid_local"]
    ready_names = {
        adapter.name for adapter in adapters if adapter.status == "configured"
    }
    status = (
        "ready"
        if {"grobid_local"} <= ready_names
        and ({"ocrmypdf_local"} & ready_names or {"paddleocr_local"} & ready_names)
        else "degraded"
    )

    return AcademicStructureAdvisoryResult(
        status=status,
        document_kind=document_kind,
        recommended_path=recommended_path,
        notes=[
            "PDF text-layer status suggests OCR or structure enhancement may be needed.",
            "Missing adapters degrade to advisory evidence instead of blocking worker flows.",
        ],
        adapters=adapters,
    )


def resolve_structure_adapters(
    environment: Mapping[str, str] | None = None,
) -> list[AdapterStatus]:
    if environment is None:
        env = os.environ
        allow_system_lookup = True
    else:
        env = environment
        allow_system_lookup = False

    return [
        resolve_command_adapter(
            name="ocrmypdf_local",
            configured_value=env.get("OCRMYPDF_BINARY"),
            fallback_command="ocrmypdf",
            allow_system_lookup=allow_system_lookup,
        ),
        resolve_command_adapter(
            name="paddleocr_local",
            configured_value=env.get("PADDLEOCR_BINARY"),
            fallback_command="paddleocr",
            allow_system_lookup=allow_system_lookup,
        ),
        resolve_url_adapter(
            name="grobid_local",
            configured_value=env.get("GROBID_URL"),
        ),
    ]


def resolve_document_kind(document_path: str) -> str:
    suffix = Path(document_path).suffix.lower()
    if suffix.startswith("."):
        suffix = suffix[1:]

    return suffix or "unknown"


def resolve_command_adapter(
    name: str,
    configured_value: str | None,
    fallback_command: str,
    allow_system_lookup: bool,
) -> AdapterStatus:
    if configured_value and configured_value.strip():
        return AdapterStatus(
            name=name,
            status="configured",
            detail=configured_value.strip(),
        )

    if allow_system_lookup:
        resolved = which(fallback_command)
        if resolved:
            return AdapterStatus(name=name, status="configured", detail=resolved)

    return AdapterStatus(name=name, status="not_configured")


def resolve_url_adapter(name: str, configured_value: str | None) -> AdapterStatus:
    if configured_value and configured_value.strip():
        return AdapterStatus(
            name=name,
            status="configured",
            detail=configured_value.strip(),
        )

    return AdapterStatus(name=name, status="not_configured")


def adapter_is_configured(adapters: list[AdapterStatus], name: str) -> bool:
    return any(adapter.name == name and adapter.status == "configured" for adapter in adapters)
