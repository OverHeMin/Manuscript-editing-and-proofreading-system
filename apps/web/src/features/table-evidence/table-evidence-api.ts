import type {
  TableCorrectionPatch,
  TableEvidenceAsset,
  TableEvidenceBinding,
  TableEvidenceBindingRole,
  TableEvidenceBindingTargetType,
  TableEvidenceRevision,
  TableEvidenceSourceFile,
  TableSourceSnapshot,
} from "./table-evidence-types.ts";

export interface TableEvidenceHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export interface CreateTableEvidenceFromDocxUploadInput {
  fileName: string;
  mimeType: string;
  fileContentBase64: string;
}

export interface CreateTableEvidenceFromDocxUploadResponse {
  sourceFile: TableEvidenceSourceFile;
  asset: TableEvidenceAsset;
  assets: TableEvidenceAsset[];
  revisions: TableEvidenceRevision[];
  tables: TableSourceSnapshot[];
}

export interface SaveTableEvidenceCorrectionPatchInput {
  patch: TableCorrectionPatch;
}

export interface ConfirmTableEvidenceRevisionInput {
  confirmations: {
    invisibleCharsConfirmed?: boolean;
    specialSymbolsConfirmed?: boolean;
  };
}

export interface BindTableEvidenceRevisionInput {
  revisionId: string;
  targetType: TableEvidenceBindingTargetType;
  targetId: string;
  bindingRole: TableEvidenceBindingRole;
}

export function createTableEvidenceFromDocxUpload(
  client: TableEvidenceHttpClient,
  input: CreateTableEvidenceFromDocxUploadInput,
) {
  return client.request<CreateTableEvidenceFromDocxUploadResponse>({
    method: "POST",
    url: "/api/v1/table-evidence/assets/from-docx-upload",
    body: {
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileContentBase64: input.fileContentBase64,
    },
  });
}

export function saveTableEvidenceCorrectionPatch(
  client: TableEvidenceHttpClient,
  revisionId: string,
  input: SaveTableEvidenceCorrectionPatchInput,
) {
  return client.request<TableEvidenceRevision>({
    method: "POST",
    url: `/api/v1/table-evidence/revisions/${revisionId}/patch`,
    body: {
      patch: input.patch,
    },
  });
}

export function confirmTableEvidenceRevision(
  client: TableEvidenceHttpClient,
  revisionId: string,
  input: ConfirmTableEvidenceRevisionInput,
) {
  return client.request<TableEvidenceRevision>({
    method: "POST",
    url: `/api/v1/table-evidence/revisions/${revisionId}/confirm`,
    body: {
      confirmations: {
        invisibleCharsConfirmed: input.confirmations.invisibleCharsConfirmed,
        specialSymbolsConfirmed: input.confirmations.specialSymbolsConfirmed,
      },
    },
  });
}

export function bindTableEvidenceRevision(
  client: TableEvidenceHttpClient,
  input: BindTableEvidenceRevisionInput,
) {
  return client.request<TableEvidenceBinding>({
    method: "POST",
    url: "/api/v1/table-evidence/bindings",
    body: {
      revisionId: input.revisionId,
      targetType: input.targetType,
      targetId: input.targetId,
      bindingRole: input.bindingRole,
    },
  });
}
