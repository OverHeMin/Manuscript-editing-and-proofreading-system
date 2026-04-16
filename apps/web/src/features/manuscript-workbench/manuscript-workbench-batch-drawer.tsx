import type { ReactNode } from "react";
import type { ManuscriptWorkbenchMode } from "./manuscript-workbench-controller.ts";

export interface ManuscriptWorkbenchBatchDrawerProps {
  mode: Exclude<ManuscriptWorkbenchMode, "submission">;
  sectionCount: number;
  children: ReactNode;
}

export function ManuscriptWorkbenchBatchDrawer({
  mode,
  sectionCount: _sectionCount,
  children,
}: ManuscriptWorkbenchBatchDrawerProps) {
  return (
    <aside
      className="manuscript-workbench-batch-drawer"
      data-batch-slab="bounded"
      data-batch-mode={mode}
    >
      <header className="manuscript-workbench-batch-drawer-header">
        <div>
          <span className="manuscript-workbench-section-eyebrow">辅助抽屉</span>
          <h3>批量处理</h3>
          <p>{resolveDrawerDescription(mode)}</p>
        </div>
      </header>

      <div className="manuscript-workbench-batch-drawer-body">
        {children}
      </div>
    </aside>
  );
}

function resolveDrawerDescription(mode: Exclude<ManuscriptWorkbenchMode, "submission">): string {
  if (mode === "screening") {
    return "批量接稿、辅助配置与导出动作统一放在抽屉里，避免影响初筛主判断。";
  }

  if (mode === "editing") {
    return "模板上下文、执行入口与导出工具放在侧边，中央区域持续聚焦当前稿件。";
  }

  return "校对草稿、终稿确认与交付工具保留在侧边抽屉，减少页面堆叠。";
}
