export type DocumentPreviewStatus = "ready" | "pending_normalization";

export interface DocumentPreviewViewModel {
  manuscript_id: string;
  source_asset_id?: string;
  normalized_asset_type: "normalized_docx";
  viewer: "onlyoffice";
  status: DocumentPreviewStatus;
  mime_type: string;
  file_name: string;
  storage_key: string;
  warnings: string[];
}

export interface DocumentNormalizationExecutionViewModel {
  plan: {
    manuscript_id: string;
    derived_asset: {
      asset_type: "normalized_docx";
      file_name: string;
      storage_key: string;
      mime_type: string;
    };
  };
  normalized_asset?: {
    id: string;
    asset_type: "normalized_docx";
    file_name?: string;
    storage_key: string;
  };
  preview: {
    viewer: "onlyoffice";
    status: DocumentPreviewStatus;
    source_asset_id?: string;
    mime_type: string;
    warnings: string[];
  };
}
