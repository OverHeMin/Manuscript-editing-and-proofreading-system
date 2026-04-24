import type { KnowledgeBindingTargetsViewModel, KnowledgeItemViewModel } from "./index.ts";

export interface KnowledgeBindingSummary {
  label: string;
  values: string[];
}

export function buildKnowledgeBindingSummaries(
  item: Pick<KnowledgeItemViewModel, "binding_targets" | "template_bindings">,
): KnowledgeBindingSummary[] {
  const bindingTargets = item.binding_targets;
  const summaries: KnowledgeBindingSummary[] = [
    createKnowledgeBindingSummary("模板族", bindingTargets?.template_family_ids),
    createKnowledgeBindingSummary("模块模板", bindingTargets?.module_template_ids),
    createKnowledgeBindingSummary("期刊模板", bindingTargets?.journal_template_ids),
    createKnowledgeBindingSummary("通用包", bindingTargets?.general_package_ids),
    createKnowledgeBindingSummary("医学专用包", bindingTargets?.medical_package_ids),
  ].filter((value): value is KnowledgeBindingSummary => value != null);

  if (summaries.length > 0) {
    return summaries;
  }

  const templateBindings = normalizeBindingValues(item.template_bindings);
  return templateBindings.length > 0
    ? [{ label: "模板", values: templateBindings }]
    : [];
}

export function formatKnowledgeBindingSummary(summary: KnowledgeBindingSummary): string {
  return `${summary.label}: ${summary.values.join("、")}`;
}

export function createKnowledgeBindingTargetsFromRevisionBindings(
  bindings: ReadonlyArray<{
    binding_kind: string;
    binding_target_id: string;
  }>,
): KnowledgeBindingTargetsViewModel | undefined {
  const templateFamilyIds = collectBindingTargets(bindings, "template_family");
  const moduleTemplateIds = collectBindingTargets(bindings, "module_template");
  const journalTemplateIds = collectBindingTargets(bindings, "journal_template");
  const generalPackageIds = collectBindingTargets(bindings, "general_package");
  const medicalPackageIds = collectBindingTargets(bindings, "medical_package");

  if (
    templateFamilyIds.length === 0 &&
    moduleTemplateIds.length === 0 &&
    journalTemplateIds.length === 0 &&
    generalPackageIds.length === 0 &&
    medicalPackageIds.length === 0
  ) {
    return undefined;
  }

  return {
    ...(templateFamilyIds.length > 0 ? { template_family_ids: templateFamilyIds } : {}),
    ...(moduleTemplateIds.length > 0 ? { module_template_ids: moduleTemplateIds } : {}),
    ...(journalTemplateIds.length > 0 ? { journal_template_ids: journalTemplateIds } : {}),
    ...(generalPackageIds.length > 0 ? { general_package_ids: generalPackageIds } : {}),
    ...(medicalPackageIds.length > 0 ? { medical_package_ids: medicalPackageIds } : {}),
  };
}

function createKnowledgeBindingSummary(
  label: string,
  values: readonly string[] | undefined,
): KnowledgeBindingSummary | null {
  const normalizedValues = normalizeBindingValues(values);
  return normalizedValues.length > 0 ? { label, values: normalizedValues } : null;
}

function collectBindingTargets(
  bindings: ReadonlyArray<{
    binding_kind: string;
    binding_target_id: string;
  }>,
  bindingKind: string,
): string[] {
  return normalizeBindingValues(
    bindings
      .filter((binding) => binding.binding_kind === bindingKind)
      .map((binding) => binding.binding_target_id),
  );
}

function normalizeBindingValues(values: readonly string[] | undefined): string[] {
  const deduped = new Set<string>();

  for (const value of values ?? []) {
    const normalized = value.trim();
    if (normalized.length === 0) {
      continue;
    }

    deduped.add(normalized);
  }

  return [...deduped];
}
