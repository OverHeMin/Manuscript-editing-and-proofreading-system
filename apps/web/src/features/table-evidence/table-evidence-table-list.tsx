import type {
  TableEvidenceAsset,
  TableEvidenceRevision,
  TableSourceSnapshot,
} from "./table-evidence-types.ts";

export interface TableEvidenceTableListProps {
  asset?: TableEvidenceAsset;
  revisions?: TableEvidenceRevision[];
  tables: TableSourceSnapshot[];
  selectedTableId?: string;
  onSelectTable?: (tableId: string) => void;
}

export function TableEvidenceTableList({
  asset,
  revisions = [],
  tables,
  selectedTableId,
  onSelectTable,
}: TableEvidenceTableListProps) {
  return (
    <section className="table-evidence-panel table-evidence-table-list">
      <h3>解析表格</h3>
      {asset ? (
        <p>
          {asset.title} / {asset.source_file_name}
        </p>
      ) : null}
      {tables.length === 0 ? (
        <p data-table-list-empty="true">暂无已解析表格</p>
      ) : (
        <ul>
          {tables.map((table, index) => (
            <li key={table.table_id}>
              <button
                type="button"
                data-selected={table.table_id === selectedTableId ? "true" : undefined}
                data-table-id={table.table_id}
                onClick={() => onSelectTable?.(table.table_id)}
              >
                表格 {index + 1}: {table.row_count} x {table.column_count}
              </button>
              {table.warnings.length > 0 ? (
                <span data-table-warning-count={table.warnings.length}>需复核</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {revisions.length > 0 ? <p data-revision-count={revisions.length}>版本 {revisions.length}</p> : null}
    </section>
  );
}
