from __future__ import annotations

from dataclasses import dataclass
import importlib.util
import os
from typing import Callable, Mapping


AdapterRunner = Callable[[dict], list[dict]]
ModuleChecker = Callable[[str], bool]
RunnerFactory = Callable[[], AdapterRunner]

ADVISORY_ACTION_MAP = {
    "auto_fix": "suggest_fix",
    "suggest_fix": "suggest_fix",
    "manual_review": "manual_review",
    "block": "manual_review",
}


@dataclass(frozen=True)
class ThirdPartyAdapterSpec:
    adapter_id: str
    display_name: str
    package_name: str
    enable_env: str


@dataclass
class ThirdPartyAdapterRegistration:
    adapter_id: str
    display_name: str
    package_name: str
    configured: bool
    available: bool
    enabled: bool
    advisory_only: bool = True
    execution_mode: str = "disabled"
    runner: AdapterRunner | None = None

    def to_metadata(self) -> dict:
        return {
            "adapter_id": self.adapter_id,
            "display_name": self.display_name,
            "package_name": self.package_name,
            "configured": self.configured,
            "available": self.available,
            "enabled": self.enabled,
            "advisory_only": self.advisory_only,
            "execution_mode": self.execution_mode,
        }


class AdapterRegistry:
    def __init__(self, registrations: list[ThirdPartyAdapterRegistration]):
        self._registrations = list(registrations)

    def list_adapters(self) -> list[dict]:
        return [registration.to_metadata() for registration in self._registrations]

    def enabled_adapters(self) -> list[ThirdPartyAdapterRegistration]:
        return [
            registration
            for registration in self._registrations
            if registration.enabled and registration.runner is not None
        ]


DEFAULT_ADAPTER_SPECS = (
    ThirdPartyAdapterSpec(
        adapter_id="autocorrect",
        display_name="AutoCorrect",
        package_name="autocorrect",
        enable_env="MANUSCRIPT_QUALITY_ENABLE_AUTOCORRECT",
    ),
    ThirdPartyAdapterSpec(
        adapter_id="pycorrector",
        display_name="pycorrector",
        package_name="pycorrector",
        enable_env="MANUSCRIPT_QUALITY_ENABLE_PYCORRECTOR",
    ),
)


def build_adapter_registry(
    *,
    env: Mapping[str, str] | None = None,
    module_checker: ModuleChecker | None = None,
    runner_factories: Mapping[str, RunnerFactory] | None = None,
) -> AdapterRegistry:
    effective_env = env or os.environ
    effective_module_checker = module_checker or module_is_available
    factories = dict(runner_factories or {})
    registrations: list[ThirdPartyAdapterRegistration] = []

    for spec in DEFAULT_ADAPTER_SPECS:
        configured = _is_truthy(effective_env.get(spec.enable_env))
        available = effective_module_checker(spec.package_name)
        runner_factory = factories.get(spec.adapter_id)
        runner = (
            runner_factory()
            if configured and available and runner_factory is not None
            else None
        )

        if runner is not None:
            execution_mode = "enabled"
        elif configured and available:
            execution_mode = "metadata_only"
        elif configured:
            execution_mode = "unavailable"
        else:
            execution_mode = "disabled"

        registrations.append(
            ThirdPartyAdapterRegistration(
                adapter_id=spec.adapter_id,
                display_name=spec.display_name,
                package_name=spec.package_name,
                configured=configured,
                available=available,
                enabled=runner is not None,
                execution_mode=execution_mode,
                runner=runner,
            )
        )

    return AdapterRegistry(registrations)


def module_is_available(package_name: str) -> bool:
    return importlib.util.find_spec(package_name) is not None


def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False

    return value.strip().lower() in {"1", "true", "yes", "on"}
