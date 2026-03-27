export type PdfConsistencyIssueType =
  | "toc_missing_in_body"
  | "body_missing_in_toc"
  | "toc_level_mismatch"
  | "toc_numbering_mismatch"
  | "toc_order_mismatch"
  | "toc_page_mismatch"
  | "needs_manual_review";

export interface PdfConsistencyIssueContent {
  issue_type: PdfConsistencyIssueType;
  toc_heading?: Record<string, unknown>;
  body_heading?: Record<string, unknown>;
}

export interface PdfConsistencyIssueRecord extends PdfConsistencyIssueContent {
  id: string;
  manuscript_id: string;
  report_asset_id: string;
  sequence_no: number;
  created_at: string;
}
