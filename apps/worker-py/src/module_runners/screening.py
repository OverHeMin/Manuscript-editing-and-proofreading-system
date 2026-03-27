from .contracts import ModuleRunPlan


def build_screening_plan() -> ModuleRunPlan:
    return ModuleRunPlan(
        module="screening",
        output_asset_type="screening_report",
        requires_human_confirmation=False,
    )
