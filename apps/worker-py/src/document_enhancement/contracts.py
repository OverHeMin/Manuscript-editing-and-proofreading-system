from dataclasses import dataclass


@dataclass(frozen=True)
class AdapterStatus:
    name: str
    status: str
    detail: str | None = None


@dataclass(frozen=True)
class PrivacyFinding:
    category: str
    match: str


@dataclass(frozen=True)
class PrivacyAdvisoryResult:
    status: str
    findings: list[PrivacyFinding]
    notes: list[str]
    adapters: list[AdapterStatus]


@dataclass(frozen=True)
class AcademicStructureAdvisoryResult:
    status: str
    document_kind: str
    recommended_path: list[str]
    notes: list[str]
    adapters: list[AdapterStatus]


@dataclass(frozen=True)
class DocumentEnhancementAuditReport:
    document_path: str
    privacy: PrivacyAdvisoryResult
    academic_structure: AcademicStructureAdvisoryResult
    notes: list[str]
