import re
from collections.abc import Mapping

from .contracts import AdapterStatus, PrivacyAdvisoryResult, PrivacyFinding


HEURISTIC_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("email", re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)),
    ("phone", re.compile(r"(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)")),
    ("identifier", re.compile(r"\b\d{17}[\dXx]\b")),
)


def build_privacy_advisory(
    text: str | None,
    environment: Mapping[str, str] | None = None,
) -> PrivacyAdvisoryResult:
    adapters = resolve_presidio_adapters(environment)

    if text is None or not text.strip():
        return PrivacyAdvisoryResult(
            status="degraded",
            findings=[],
            notes=[
                "No extracted text was provided, so the privacy advisory remains a manual-review-only signal.",
                "Human de-identification review remains authoritative for governed reuse.",
            ],
            adapters=adapters,
        )

    findings: list[PrivacyFinding] = []
    for category, pattern in HEURISTIC_PATTERNS:
        findings.extend(
            PrivacyFinding(category=category, match=match.group(0))
            for match in pattern.finditer(text)
        )

    if findings:
        return PrivacyAdvisoryResult(
            status="needs_review",
            findings=findings,
            notes=[
                "Heuristic local markers suggest manual privacy review before governed reuse.",
                "This advisory does not replace human de-identification approval.",
            ],
            adapters=adapters,
        )

    return PrivacyAdvisoryResult(
        status="advisory_only",
        findings=[],
        notes=[
            "No heuristic markers were found in the provided text.",
            "This remains an advisory precheck and not a final privacy gate.",
        ],
        adapters=adapters,
    )


def resolve_presidio_adapters(
    environment: Mapping[str, str] | None = None,
) -> list[AdapterStatus]:
    env = environment or {}
    return [
        build_configured_adapter(
            name="presidio_analyzer",
            configured_value=env.get("PRESIDIO_ANALYZER_URL"),
        ),
        build_configured_adapter(
            name="presidio_anonymizer",
            configured_value=env.get("PRESIDIO_ANONYMIZER_URL"),
        ),
    ]


def build_configured_adapter(name: str, configured_value: str | None) -> AdapterStatus:
    if configured_value and configured_value.strip():
        return AdapterStatus(name=name, status="configured", detail=configured_value.strip())

    return AdapterStatus(name=name, status="not_configured")
