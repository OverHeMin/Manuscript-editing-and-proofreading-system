import type { ReactNode } from "react";
import type { KnowledgeAssetDetailViewModel } from "./types.ts";

export interface KnowledgeLibraryRecordDrawerProps {
  detail: KnowledgeAssetDetailViewModel | null;
  selectedAssetId: string | null;
  selectedRevisionId: string | null;
  reviewHash?: string | null;
  onSelectRevision: (revisionId: string) => void;
  children?: ReactNode;
}

export function KnowledgeLibraryRecordDrawer({
  detail,
  selectedAssetId,
  selectedRevisionId,
  reviewHash = null,
  onSelectRevision,
  children,
}: KnowledgeLibraryRecordDrawerProps) {
  const selectedRevision = detail?.selected_revision ?? null;
  const approvedRevision = detail?.current_approved_revision ?? null;
  const contributorLabel =
    selectedRevision?.contributor_label ?? detail?.asset.contributor_label ?? null;

  return (
    <aside className="knowledge-library-panel knowledge-library-record-drawer">
      <header className="knowledge-library-panel-header">
        <div>
          <h2>记录抽屉</h2>
          <p>左侧保留台账，右侧集中处理当前知识条目的版本、内容和语义层。</p>
        </div>
        {reviewHash ? (
          <a className="knowledge-library-link" href={reviewHash}>
            打开审核台
          </a>
        ) : null}
      </header>

      {detail == null || selectedRevision == null ? (
        <p className="knowledge-library-empty">从左侧台账选择一条知识记录后，即可在这里继续编辑。</p>
      ) : (
        <>
          <div className="knowledge-library-editor-meta">
            <span>
              当前条目：<strong>{selectedAssetId ?? "新建草稿"}</strong>
            </span>
            <span>
              当前版本：<strong>{selectedRevisionId ?? "未选择"}</strong>
            </span>
            <span>
              已发布版本：<strong>{approvedRevision?.id ?? "暂无"}</strong>
            </span>
            <span>
              贡献账号：<strong>{contributorLabel ?? "待接入贡献账号"}</strong>
            </span>
          </div>

          <section className="knowledge-library-drawer-section">
            <header className="knowledge-library-panel-header">
              <div>
                <h3>版本时间线</h3>
                <p>不离开台账即可回看已发布版本、当前草稿和审核交接记录。</p>
              </div>
            </header>

            <ol className="knowledge-library-revision-list">
              {detail.revisions.map((revision) => {
                const isActive = revision.id === selectedRevisionId;

                return (
                  <li key={revision.id}>
                    <button
                      type="button"
                      className={`knowledge-library-revision-item${isActive ? " is-active" : ""}`}
                      onClick={() => onSelectRevision(revision.id)}
                    >
                      <strong>{revision.title}</strong>
                      <span>{revision.id}</span>
                      <small>
                        版本 {revision.revision_no} 路 {formatRevisionStatus(revision.status)}
                      </small>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          {children}
        </>
      )}
    </aside>
  );
}

function formatRevisionStatus(
  status: KnowledgeAssetDetailViewModel["selected_revision"]["status"],
): string {
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
