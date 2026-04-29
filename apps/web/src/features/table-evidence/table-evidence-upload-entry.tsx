import type { DragEvent } from "react";
import { useState } from "react";
import {
  createTableEvidenceFromDocxUpload,
  type CreateTableEvidenceFromDocxUploadResponse,
  type TableEvidenceHttpClient,
} from "./table-evidence-api.ts";
import { TableEvidenceTableList } from "./table-evidence-table-list.tsx";

export interface TableEvidenceUploadEntryProps {
  client: TableEvidenceHttpClient;
  onCreated?: (response: CreateTableEvidenceFromDocxUploadResponse) => void;
  onSelectTable?: (tableId: string) => void;
  selectedTableId?: string;
}

export function TableEvidenceUploadEntry({
  client,
  onCreated,
  onSelectTable,
  selectedTableId,
}: TableEvidenceUploadEntryProps) {
  const [response, setResponse] = useState<CreateTableEvidenceFromDocxUploadResponse | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function uploadFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setErrorMessage("仅支持 .docx 文件");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    try {
      const fileContentBase64 = await fileToBase64(file);
      const result = await createTableEvidenceFromDocxUpload(client, {
        fileName: file.name,
        mimeType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileContentBase64,
      });
      setResponse(result.body);
      onCreated?.(result.body);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "上传失败");
    } finally {
      setIsUploading(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      void uploadFile(file);
    }
  }

  return (
    <section className="table-evidence-panel table-evidence-upload-entry">
      <h3>上传 Word 表格证据</h3>
      <div
        className="table-evidence-dropzone"
        data-upload-busy={isUploading ? "true" : "false"}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          data-table-evidence-upload-input="true"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) {
              void uploadFile(file);
            }
          }}
          type="file"
        />
      </div>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {response ? (
        <TableEvidenceTableList
          asset={response.asset}
          onSelectTable={onSelectTable}
          revisions={response.revisions}
          selectedTableId={selectedTableId}
          tables={response.tables}
        />
      ) : null}
    </section>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("文件读取失败"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] ?? "" : result);
    };
    reader.readAsDataURL(file);
  });
}
