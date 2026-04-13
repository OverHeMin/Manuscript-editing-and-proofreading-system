export type TemplateGovernanceLedgerDensity = "compact" | "comfortable";

export interface TemplateGovernanceLedgerSearchRow {
  id: string;
  primary: string;
  secondary?: string;
  cells: string[];
}

export interface TemplateGovernanceLedgerSearchState {
  mode: "idle" | "results";
  query: string;
  title: string;
  rows: TemplateGovernanceLedgerSearchRow[];
}
