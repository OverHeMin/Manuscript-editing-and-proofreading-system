from .contracts import ModuleRunPlan


def build_proofreading_draft_plan() -> ModuleRunPlan:
    return ModuleRunPlan(
        module="proofreading",
        output_asset_type="proofreading_draft_report",
        requires_human_confirmation=True,
    )


def build_proofreading_final_plan() -> ModuleRunPlan:
    return ModuleRunPlan(
        module="proofreading",
        output_asset_type="final_proof_annotated_docx",
        requires_human_confirmation=False,
    )
