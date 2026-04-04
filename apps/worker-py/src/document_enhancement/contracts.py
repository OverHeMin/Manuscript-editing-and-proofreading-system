from dataclasses import dataclass
from pathlib import Path


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
class ArtifactWriteResult:
    status: str
    output_dir: Path | None
    artifact_path: Path | None
    index_path: Path | None
    notes: list[str]


@dataclass(frozen=True)
class DocumentEnhancementAuditReport:
    document_path: str
    privacy: PrivacyAdvisoryResult
    academic_structure: AcademicStructureAdvisoryResult
    artifact: ArtifactWriteResult | None
    notes: list[str]
