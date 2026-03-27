from dataclasses import dataclass


@dataclass(frozen=True)
class ModuleRunPlan:
    module: str
    output_asset_type: str
    requires_human_confirmation: bool
