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
class CleanupPlanAction:
    created_at: str
    document_path: str
    artifact_path: str
    age_days: int | None
    action: str
    reason: str
    manual_steps: list[str]


@dataclass(frozen=True)
class CleanupPlanResult:
    status: str
    output_dir: Path | None
    index_path: Path | None
    plan_path: Path | None
    evaluated_item_count: int
    planned_action_count: int
    actions: list[CleanupPlanAction]
    notes: list[str]


@dataclass(frozen=True)
class IndexConsistencyIssue:
    issue_type: str
    artifact_path: str | None
    index_position: int | None
    detail: str
    recommended_action: str


@dataclass(frozen=True)
class IndexConsistencyAuditResult:
    status: str
    output_dir: Path | None
    index_path: Path | None
    evaluated_entry_count: int
    issue_count: int
    issues: list[IndexConsistencyIssue]
    notes: list[str]


@dataclass(frozen=True)
class RepairHandoffItem:
    handoff_type: str
    sources: list[str]
    document_path: str | None
    artifact_path: str | None
    summary: str
    manual_steps: list[str]


@dataclass(frozen=True)
class RepairHandoffResult:
    status: str
    output_dir: Path | None
    index_path: Path | None
    handoff_path: Path | None
    cleanup_action_count: int
    consistency_issue_count: int
    actionable_item_count: int
    items: list[RepairHandoffItem]
    notes: list[str]


@dataclass(frozen=True)
class OperatorSummaryResult:
    status: str
    output_dir: Path | None
    index_path: Path | None
    summary_path: Path | None
    indexed_artifact_count: int
    recent_history: list[AuditHistoryEntry]
    privacy_status_counts: dict[str, int]
    academic_structure_status_counts: dict[str, int]
    retention_review_count: int
    cleanup_action_count: int
    consistency_issue_count: int
    attention_item_count: int
    attention_items: list[RepairHandoffItem]
    next_steps: list[str]
    notes: list[str]


@dataclass(frozen=True)
class DocumentEnhancementAuditReport:
    document_path: str
    privacy: PrivacyAdvisoryResult
    academic_structure: AcademicStructureAdvisoryResult
    artifact: ArtifactWriteResult | None
    notes: list[str]
