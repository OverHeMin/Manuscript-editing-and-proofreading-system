from .contracts import (
    AcademicStructureAdvisoryResult,
    AdapterStatus,
    DocumentEnhancementAuditReport,
    PrivacyAdvisoryResult,
    PrivacyFinding,
)
from .academic_structure import build_academic_structure_advisory
from .privacy import build_privacy_advisory

__all__ = [
    "AcademicStructureAdvisoryResult",
    "AdapterStatus",
    "DocumentEnhancementAuditReport",
    "PrivacyAdvisoryResult",
    "PrivacyFinding",
    "build_academic_structure_advisory",
    "build_privacy_advisory",
]
