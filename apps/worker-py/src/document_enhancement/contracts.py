from dataclasses import dataclass
from pathlib import Path
from typing import Any


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
class AuditHistoryEntry:
    created_at: str
    document_path: str
    artifact_file: str
    artifact_path: str
    privacy_status: str
    academic_structure_status: str


@dataclass(frozen=True)
class AuditHistoryListingResult:
    status: str
    output_dir: Path | None
    index_path: Path | None
    items: list[AuditHistoryEntry]
    notes: list[str]


@dataclass(frozen=True)
class AuditReplayResult:
    status: str
    artifact_path: Path | None
    report: dict[str, Any] | None
    notes: list[str]


@dataclass(frozen=True)
class RetentionCandidate:
    created_at: str
    document_path: str
    artifact_path: str
    age_days: int | None
    recommendation: str
    reason: str


@dataclass(frozen=True)
class RetentionAuditResult:
    status: str
    output_dir: Path | None
    index_path: Path | None
    evaluated_item_count: int
    keep_count: int
    cleanup_review_count: int
    candidates: list[RetentionCandidate]
    notes: list[str]


@dataclass(frozen=True)
class DocumentEnhancementAuditReport:
    document_path: str
    privacy: PrivacyAdvisoryResult
    academic_structure: AcademicStructureAdvisoryResult
    artifact: ArtifactWriteResult | None
    notes: list[str]
