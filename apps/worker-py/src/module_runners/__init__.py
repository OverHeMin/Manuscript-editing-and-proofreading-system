"""Minimal module runner contracts for manuscript processing modules."""

from .contracts import ModuleRunPlan
from .editing import build_editing_plan
from .proofreading import build_proofreading_draft_plan, build_proofreading_final_plan
from .screening import build_screening_plan

__all__ = [
    "ModuleRunPlan",
    "build_screening_plan",
    "build_editing_plan",
    "build_proofreading_draft_plan",
    "build_proofreading_final_plan",
]
