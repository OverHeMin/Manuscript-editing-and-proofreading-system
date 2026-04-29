import { useMemo, useState } from "react";
import type {
  TableEvidenceAsset,
  TableEvidenceRevision,
} from "./table-evidence-types.ts";

export interface TableEvidencePickerItem {
  asset: TableEvidenceAsset;
  revision: TableEvidenceRevision;
}

export interface TableEvidencePickerProps {
  items: TableEvidencePickerItem[];
  initialQuery?: string;
  onPick: (selection: { assetId: string; revisionId: string }) => void;
}

export function TableEvidencePicker({
  items,
  initialQuery = "",
  onPick,
}: TableEvidencePickerProps) {
  const [query, setQuery] = useState(initialQuery);
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items
      .filter((item) => item.revision.confirmation_status === "confirmed")
      .filter((item) => {
        if (!normalizedQuery) {
          return true;
        }
        return `${item.asset.title} ${item.asset.source_file_name}`
          .toLowerCase()
          .includes(normalizedQuery);
      });
  }, [items, query]);

  return (
    <section className="table-evidence-panel table-evidence-picker">
      <h3>选择已确认表格证据</h3>
      <label>
        搜索
        <input
          data-table-evidence-picker-search="true"
          onChange={(event) => setQuery(event.currentTarget.value)}
          value={query}
        />
      </label>
      <ul>
        {visibleItems.map((item) => (
          <li key={`${item.asset.id}:${item.revision.id}`} data-asset-id={item.asset.id}>
            <button
              type="button"
              data-revision-id={item.revision.id}
              onClick={() => onPick({ assetId: item.asset.id, revisionId: item.revision.id })}
            >
              {item.asset.title}
            </button>
            <span>{item.asset.source_file_name}</span>
            <span>{resolveConfirmationLabel(item.revision.confirmation_status)}</span>
            <time dateTime={item.asset.updated_at}>{formatTimestamp(item.asset.updated_at)}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}

function resolveConfirmationLabel(status: TableEvidenceRevision["confirmation_status"]): string {
  if (status === "confirmed") {
    return "已确认";
  }
  if (status === "needs_review") {
    return "需复核";
  }
  return "待确认";
}

function formatTimestamp(value: string): string {
  return value.replace("T", " ").replace(".000Z", "Z");
}
