import type {
  EditorialRuleConfidencePolicy,
  EditorialRuleExecutionMode,
  EditorialRuleProjectionKind,
} from "./editorial-rule-record.ts";

export type EditorialRuleExecutionPosture = "auto" | "guarded" | "inspect_only";
export type EditorialRulePreviewStrategy = "text_transform" | "finding_only";

export interface EditorialRuleObjectCatalogEntry {
  key: string;
  label: string;
  default_execution_posture: EditorialRuleExecutionPosture;
  preview_strategy: EditorialRulePreviewStrategy;
  projection_kinds: readonly EditorialRuleProjectionKind[];
}

const DEFAULT_PROJECTION_KINDS = [
  "rule",
  "checklist",
  "prompt_snippet",
] as const satisfies readonly EditorialRuleProjectionKind[];

const catalogEntries: Record<string, EditorialRuleObjectCatalogEntry> = {
  title: createCatalogEntry("title", "Title", "guarded"),
  author_line: createCatalogEntry("author_line", "Author Line", "guarded"),
  abstract: createCatalogEntry("abstract", "Abstract", "guarded"),
  keyword: createCatalogEntry("keyword", "Keyword", "guarded"),
  heading_hierarchy: createCatalogEntry("heading_hierarchy", "Heading Hierarchy", "guarded"),
  terminology: createCatalogEntry("terminology", "Terminology", "guarded"),
  numeric_unit: createCatalogEntry("numeric_unit", "Numeric Unit", "guarded"),
  statistical_expression: createCatalogEntry(
    "statistical_expression",
    "Statistical Expression",
    "guarded",
  ),
  table: createCatalogEntry("table", "Table", "inspect_only", [
    "rule",
    "checklist",
  ]),
  figure: createCatalogEntry("figure", "Figure", "inspect_only", [
    "rule",
    "checklist",
  ]),
  reference: createCatalogEntry("reference", "Reference", "guarded"),
  statement: createCatalogEntry("statement", "Statement", "guarded"),
  manuscript_structure: createCatalogEntry(
    "manuscript_structure",
    "Manuscript Structure",
    "guarded",
  ),
  journal_column: createCatalogEntry("journal_column", "Journal Column", "guarded"),
};

export function listEditorialRuleObjectCatalog(): EditorialRuleObjectCatalogEntry[] {
  return Object.values(catalogEntries).sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

export function getEditorialRuleObjectCatalogEntry(
  ruleObject: string,
): EditorialRuleObjectCatalogEntry {
  return (
    catalogEntries[ruleObject] ??
    createCatalogEntry(ruleObject, ruleObject, "guarded")
  );
}

export function deriveEditorialRuleExecutionPosture(input: {
  rule_object: string;
  execution_mode: EditorialRuleExecutionMode;
  confidence_policy: EditorialRuleConfidencePolicy;
}): EditorialRuleExecutionPosture {
  if (input.execution_mode === "inspect") {
    return "inspect_only";
  }

  const catalogEntry = getEditorialRuleObjectCatalogEntry(input.rule_object);
  if (catalogEntry.default_execution_posture === "inspect_only") {
    return "inspect_only";
  }

  if (
    input.execution_mode === "apply" &&
    input.confidence_policy === "always_auto"
  ) {
    return "auto";
  }

  return "guarded";
}

function createCatalogEntry(
  key: string,
  label: string,
  defaultExecutionPosture: EditorialRuleExecutionPosture,
  projectionKinds: readonly EditorialRuleProjectionKind[] = DEFAULT_PROJECTION_KINDS,
): EditorialRuleObjectCatalogEntry {
  return {
    key,
    label,
    default_execution_posture: defaultExecutionPosture,
    preview_strategy:
      defaultExecutionPosture === "inspect_only"
        ? "finding_only"
        : "text_transform",
    projection_kinds: projectionKinds,
  };
}
