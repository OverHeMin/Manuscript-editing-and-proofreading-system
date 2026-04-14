import type {
  TemplateGovernanceRuleLedgerCategory,
  TemplateGovernanceRuleLedgerRow,
  TemplateGovernanceRuleLedgerSummary,
  TemplateGovernanceRuleLedgerViewModel,
} from "./template-governance-ledger-types.ts";

export const templateGovernanceRuleLedgerCategoryOrder: readonly TemplateGovernanceRuleLedgerCategory[] =
  [
    "all",
    "rule",
    "large_template",
    "journal_template",
    "general_package",
    "medical_package",
    "recycled_candidate",
  ];

export function createEmptyTemplateGovernanceRuleLedgerViewModel(): TemplateGovernanceRuleLedgerViewModel {
  return {
    category: "all",
    rows: [],
    selectedRowId: null,
    selectedRow: null,
    searchQuery: "",
    summary: createRuleLedgerSummary([]),
  };
}

export function createTemplateGovernanceRuleLedgerViewModel(input: {
  rows: readonly TemplateGovernanceRuleLedgerRow[];
  category?: TemplateGovernanceRuleLedgerCategory;
  searchQuery?: string;
  selectedRowId?: string | null;
}): TemplateGovernanceRuleLedgerViewModel {
  const category = input.category ?? "all";
  const searchQuery = input.searchQuery?.trim() ?? "";
  const rows = filterTemplateGovernanceRuleLedgerRows(input.rows, {
    category,
    searchQuery,
  });
  const selectedRowId = resolveSelectedRuleLedgerRowId(rows, input.selectedRowId);
  const selectedRow = rows.find((row) => row.id === selectedRowId) ?? null;

  return {
    category,
    rows,
    selectedRowId,
    selectedRow,
    searchQuery,
    summary: createRuleLedgerSummary(input.rows),
  };
}

export function selectTemplateGovernanceRuleLedgerRow(
  viewModel: TemplateGovernanceRuleLedgerViewModel,
  selectedRowId: string | null,
): TemplateGovernanceRuleLedgerViewModel {
  const resolvedSelectedRowId = resolveSelectedRuleLedgerRowId(
    viewModel.rows,
    selectedRowId,
  );

  return {
    ...viewModel,
    selectedRowId: resolvedSelectedRowId,
    selectedRow:
      viewModel.rows.find((row) => row.id === resolvedSelectedRowId) ?? null,
  };
}

export function filterTemplateGovernanceRuleLedgerRows(
  rows: readonly TemplateGovernanceRuleLedgerRow[],
  input: {
    category: TemplateGovernanceRuleLedgerCategory;
    searchQuery?: string;
  },
): TemplateGovernanceRuleLedgerRow[] {
  const query = input.searchQuery?.trim().toLowerCase() ?? "";

  return rows.filter((row) => {
    if (input.category !== "all" && row.asset_kind !== input.category) {
      return false;
    }

    if (query.length === 0) {
      return true;
    }

    return [
      row.title,
      row.module_label,
      row.manuscript_type_label,
      row.semantic_status,
      row.publish_status,
      row.contributor_label,
      row.updated_at ?? "",
    ].some((value) => value.toLowerCase().includes(query));
  });
}

function resolveSelectedRuleLedgerRowId(
  rows: readonly TemplateGovernanceRuleLedgerRow[],
  preferredRowId: string | null | undefined,
): string | null {
  if (preferredRowId && rows.some((row) => row.id === preferredRowId)) {
    return preferredRowId;
  }

  return rows[0]?.id ?? null;
}

function createRuleLedgerSummary(
  rows: readonly TemplateGovernanceRuleLedgerRow[],
): TemplateGovernanceRuleLedgerSummary {
  return {
    totalCount: rows.length,
    visibleCount: rows.length,
    draftCount: rows.filter((row) => row.publish_status === "草稿").length,
    publishedCount: rows.filter((row) => row.publish_status === "已发布").length,
  };
}
