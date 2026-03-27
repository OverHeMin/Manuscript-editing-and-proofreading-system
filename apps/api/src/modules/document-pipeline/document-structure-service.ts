export interface DocumentStructureSection {
  order: number;
  heading: string;
  level?: number;
  paragraph_index?: number;
  page_no?: number;
}

export interface DocumentStructureWorkerResult {
  status: "ready" | "partial" | "needs_manual_review";
  parser: "python_docx" | "mammoth" | "other";
  sections: DocumentStructureSection[];
  warnings: string[];
}

export interface DocumentStructureWorkerAdapter {
  extract(input: {
    manuscriptId: string;
    assetId: string;
    fileName: string;
  }): Promise<DocumentStructureWorkerResult>;
}

export interface ExtractDocumentStructureInput {
  manuscriptId: string;
  assetId: string;
  fileName: string;
}

export interface DocumentStructureSnapshot {
  manuscript_id: string;
  asset_id: string;
  file_name: string;
  status: DocumentStructureWorkerResult["status"];
  parser: DocumentStructureWorkerResult["parser"];
  sections: DocumentStructureSection[];
  warnings: string[];
}

export interface DocumentStructureServiceOptions {
  adapter: DocumentStructureWorkerAdapter;
}

export class DocumentStructureService {
  private readonly adapter: DocumentStructureWorkerAdapter;

  constructor(options: DocumentStructureServiceOptions) {
    this.adapter = options.adapter;
  }

  async extract(
    input: ExtractDocumentStructureInput,
  ): Promise<DocumentStructureSnapshot> {
    const result = await this.adapter.extract(input);

    return {
      manuscript_id: input.manuscriptId,
      asset_id: input.assetId,
      file_name: input.fileName,
      status: result.status,
      parser: result.parser,
      sections: result.sections.map((section) => ({ ...section })),
      warnings: [...result.warnings],
    };
  }
}
