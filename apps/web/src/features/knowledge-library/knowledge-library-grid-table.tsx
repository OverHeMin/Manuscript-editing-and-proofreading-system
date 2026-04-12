import type { KnowledgeLibrarySummaryViewModel } from "./types.ts";

export interface KnowledgeLibraryGridTableProps {
  items: readonly KnowledgeLibrarySummaryViewModel[];
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
}

export function KnowledgeLibraryGridTable({
  items,
  selectedAssetId,
  onSelectAsset,
}: KnowledgeLibraryGridTableProps) {
  return (
    <section className="knowledge-library-panel knowledge-library-grid-panel">
      <header className="knowledge-library-panel-header">
        <div>
          <h2>多维知识台账</h2>
          <p>像表格一样浏览知识条目，先看摘要、模块、贡献账号和语义层，再决定是否展开右侧抽屉。</p>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="knowledge-library-empty">当前筛选下没有知识记录。</p>
      ) : null}

      <div className="knowledge-library-grid-table" role="table" aria-label="知识台账">
        <div className="knowledge-library-grid-row knowledge-library-grid-row-head" role="row">
          <span role="columnheader">知识条目</span>
          <span role="columnheader">摘要</span>
          <span role="columnheader">适用模块</span>
          <span role="columnheader">内容概览</span>
          <span role="columnheader">贡献账号</span>
          <span role="columnheader">语义层</span>
        </div>

        {items.map((item) => {
          const isActive = item.id === selectedAssetId;
          return (
            <button
              key={item.id}
              type="button"
              role="row"
              className={`knowledge-library-grid-row knowledge-library-grid-row-button${isActive ? " is-active" : ""}`}
              onClick={() => onSelectAsset(item.id)}
            >
              <span role="cell" className="knowledge-library-grid-cell-main">
                <strong>{item.title}</strong>
                <small>
                  {formatRevisionStatus(item.status)} 路 {formatKnowledgeKind(item.knowledge_kind)}
                </small>
              </span>
              <span role="cell">{item.summary ?? "暂未填写摘要"}</span>
              <span role="cell">
                <strong>{formatModuleScope(item.module_scope)}</strong>
                <small>{formatManuscriptTypes(item.manuscript_types)}</small>
              </span>
              <span role="cell">
                <strong>{item.content_block_count} 个内容块</strong>
                <small>{item.selected_revision_id ?? "未选择版本"}</small>
              </span>
              <span role="cell">
                <strong>{item.contributor_label ?? "待接入贡献账号"}</strong>
                <small>
                  {item.updated_at ? `最近更新 ${formatTimestampLabel(item.updated_at)}` : "等待首次提交"}
                </small>
              </span>
              <span role="cell">
                <strong>{formatSemanticStatus(item.semantic_status)}</strong>
                <small>{item.updated_at ? formatTimestampLabel(item.updated_at) : "暂无时间戳"}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function formatKnowledgeKind(kind: KnowledgeLibrarySummaryViewModel["knowledge_kind"]): string {
  switch (kind) {
    case "rule":
      return "规则";
    case "case_pattern":
      return "案例模式";
    case "checklist":
      return "核查清单";
    case "prompt_snippet":
      return "提示片段";
    case "reference":
      return "参考资料";
    case "other":
    default:
      return "其他";
  }
}

function formatModuleScope(
  moduleScope: KnowledgeLibrarySummaryViewModel["module_scope"],
): string {
  switch (moduleScope) {
    case "screening":
      return "初筛";
    case "editing":
      return "编辑";
    case "proofreading":
      return "校对";
    case "manual":
      return "人工处理";
    case "learning":
      return "学习回流";
    case "any":
    default:
      return "全部模块";
  }
}

function formatManuscriptTypes(
  manuscriptTypes: KnowledgeLibrarySummaryViewModel["manuscript_types"],
): string {
  if (manuscriptTypes === "any") {
    return "全部稿件";
  }

  return manuscriptTypes.map(formatManuscriptType).join("、");
}

function formatManuscriptType(manuscriptType: string): string {
  switch (manuscriptType) {
    case "clinical_study":
      return "临床研究";
    case "basic_research":
      return "基础研究";
    case "review":
      return "综述";
    case "meta_analysis":
      return "Meta 分析";
    case "case_report":
      return "病例报告";
    case "guideline":
      return "指南解读";
    default:
      return manuscriptType;
  }
}

function formatRevisionStatus(status: KnowledgeLibrarySummaryViewModel["status"]): string {
  switch (status) {
    case "draft":
      return "草稿";
    case "pending_review":
      return "待审核";
    case "approved":
      return "已通过";
    case "superseded":
      return "已替换";
    case "archived":
      return "已归档";
    default:
      return status;
  }
}

function formatSemanticStatus(
  status: KnowledgeLibrarySummaryViewModel["semantic_status"],
): string {
  switch (status) {
    case "confirmed":
      return "已确认";
    case "pending_confirmation":
      return "待确认";
    case "stale":
      return "待刷新";
    case "not_generated":
    default:
      return "未生成";
  }
}

function formatTimestampLabel(timestamp: string): string {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return timestamp;
  }

  return timestamp.slice(0, 10);
}
