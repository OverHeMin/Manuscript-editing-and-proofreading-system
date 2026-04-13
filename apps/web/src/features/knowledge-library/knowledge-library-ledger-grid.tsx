import type { KnowledgeLibraryLedgerDensity } from "./knowledge-library-ledger-toolbar.tsx";

export type KnowledgeLibraryLedgerColumnKey =
  | "title"
  | "answer"
  | "category"
  | "detail"
  | "attachments"
  | "semanticStatus"
  | "contributor"
  | "date"
  | "semanticSummary"
  | "retrievalTerms"
  | "aliases"
  | "scenarios"
  | "riskTags";

export interface KnowledgeLibraryLedgerRow {
  id: string;
  title: string;
  answer: string;
  category: string;
  detail: string;
  attachments: string;
  semanticStatus: string;
  contributor: string;
  date: string;
  semanticSummary: string;
  retrievalTerms: string;
  aliases: string;
  scenarios: string;
  riskTags: string;
}

export interface KnowledgeLibraryLedgerColumnDefinition {
  key: KnowledgeLibraryLedgerColumnKey;
  label: string;
  minWidth: number;
  pinned?: boolean;
}

export type KnowledgeLibraryLedgerColumnWidthMap = Record<
  KnowledgeLibraryLedgerColumnKey,
  number
>;

export const KNOWLEDGE_LIBRARY_LEDGER_COLUMNS: readonly KnowledgeLibraryLedgerColumnDefinition[] =
  [
    { key: "title", label: "名称 / 关键词", minWidth: 240, pinned: true },
    { key: "answer", label: "答案", minWidth: 320, pinned: true },
    { key: "category", label: "类别", minWidth: 140 },
    { key: "detail", label: "详情", minWidth: 220 },
    { key: "attachments", label: "图片 / 附件", minWidth: 180 },
    { key: "semanticStatus", label: "AI状态", minWidth: 140 },
    { key: "contributor", label: "贡献人", minWidth: 140 },
    { key: "date", label: "日期", minWidth: 120 },
    { key: "semanticSummary", label: "语义摘要", minWidth: 220 },
    { key: "retrievalTerms", label: "检索词", minWidth: 220 },
    { key: "aliases", label: "别名 / 同义词", minWidth: 220 },
    { key: "scenarios", label: "适用场景", minWidth: 220 },
    { key: "riskTags", label: "风险标签", minWidth: 180 },
  ] as const;

export interface KnowledgeLibraryLedgerGridProps {
  rows: readonly KnowledgeLibraryLedgerRow[];
  density: KnowledgeLibraryLedgerDensity;
  selectedAssetId: string | null;
  columnWidths: KnowledgeLibraryLedgerColumnWidthMap;
  onSelectAsset: (assetId: string) => void;
  onEditAsset: (assetId: string) => void;
  onColumnResizeStart: (key: KnowledgeLibraryLedgerColumnKey, startX: number) => void;
}

export function KnowledgeLibraryLedgerGrid({
  rows,
  density,
  selectedAssetId,
  columnWidths,
  onSelectAsset,
  onEditAsset,
  onColumnResizeStart,
}: KnowledgeLibraryLedgerGridProps) {
  const stickyOffsets = computeStickyOffsets(columnWidths);

  return (
    <section className="knowledge-library-ledger-grid" aria-label="多维知识台账">
      <div className="knowledge-library-ledger-grid__scroll">
        <table className={`knowledge-library-ledger-grid__table is-${density}`}>
          <thead>
            <tr>
              {KNOWLEDGE_LIBRARY_LEDGER_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  style={{
                    width: `${columnWidths[column.key]}px`,
                    minWidth: `${column.minWidth}px`,
                    left: column.pinned ? `${stickyOffsets[column.key] ?? 0}px` : undefined,
                  }}
                  data-pinned={column.pinned ? "true" : undefined}
                  data-column={column.key}
                >
                  <span>{column.label}</span>
                  <button
                    type="button"
                    className="knowledge-library-ledger-grid__resize-handle"
                    aria-label={`调整${column.label}列宽`}
                    onPointerDown={(event) =>
                      onColumnResizeStart(column.key, event.clientX)
                    }
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="knowledge-library-ledger-grid__empty"
                  colSpan={KNOWLEDGE_LIBRARY_LEDGER_COLUMNS.length}
                >
                  暂无知识记录。
                </td>
              </tr>
            ) : null}

            {rows.map((row) => {
              const isSelected = row.id === selectedAssetId;
              return (
                <tr
                  key={row.id}
                  className={isSelected ? "is-selected" : undefined}
                  onClick={() => onSelectAsset(row.id)}
                  onDoubleClick={() => onEditAsset(row.id)}
                >
                  {KNOWLEDGE_LIBRARY_LEDGER_COLUMNS.map((column) => (
                    <td
                      key={column.key}
                      style={{
                        width: `${columnWidths[column.key]}px`,
                        minWidth: `${column.minWidth}px`,
                        left: column.pinned ? `${stickyOffsets[column.key] ?? 0}px` : undefined,
                      }}
                      data-pinned={column.pinned ? "true" : undefined}
                    >
                      {formatGridValue(row[column.key])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function computeStickyOffsets(
  columnWidths: KnowledgeLibraryLedgerColumnWidthMap,
): Partial<Record<KnowledgeLibraryLedgerColumnKey, number>> {
  const offsets: Partial<Record<KnowledgeLibraryLedgerColumnKey, number>> = {};
  let currentOffset = 0;

  for (const column of KNOWLEDGE_LIBRARY_LEDGER_COLUMNS) {
    if (!column.pinned) {
      continue;
    }

    offsets[column.key] = currentOffset;
    currentOffset += columnWidths[column.key];
  }

  return offsets;
}

function formatGridValue(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "—";
}
