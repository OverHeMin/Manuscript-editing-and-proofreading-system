from .contracts import ModuleRunPlan


def build_editing_plan() -> ModuleRunPlan:
    return ModuleRunPlan(
        module="editing",
        output_asset_type="edited_docx",
        requires_human_confirmation=False,
    )
