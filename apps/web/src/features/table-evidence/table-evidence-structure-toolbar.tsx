import type { TableEvidenceCellSnapshot } from "./table-evidence-types.ts";

export interface TableEvidenceStructureToolbarProps {
  cell?: TableEvidenceCellSnapshot;
}

export function TableEvidenceStructureToolbar({ cell }: TableEvidenceStructureToolbarProps) {
  return (
    <section className="table-evidence-toolbar" aria-label="结构工具栏">
      <button
        type="button"
        data-structure-action="merge-right"
        disabled
      >
        合并右侧
      </button>
      <button
        type="button"
        data-structure-action="split"
        disabled
      >
        拆分
      </button>
      <button
        type="button"
        data-structure-action="insert-row-after"
        disabled
      >
        下移一行
      </button>
      <button
        type="button"
        data-structure-action="delete-column-shift"
        disabled
      >
        左移一列
      </button>
      <span data-structure-toolbar-state="disabled">
        {cell ? "需要完整结构编辑后启用" : "请选择单元格"}
      </span>
    </section>
  );
}
