import type { TemplateGovernanceLedgerSearchState } from "./template-governance-ledger-types.ts";

export interface TemplateGovernanceLedgerSearchPageProps {
  searchState: TemplateGovernanceLedgerSearchState;
}

export function TemplateGovernanceLedgerSearchPage({
  searchState,
}: TemplateGovernanceLedgerSearchPageProps) {
  if (searchState.mode !== "results") {
    return null;
  }

  return (
    <section className="template-governance-ledger-search-page">
      <header className="template-governance-card">
        <h2>{searchState.title}</h2>
        <p>当前搜索词：{searchState.query || "未填写"}</p>
      </header>
      <div className="template-governance-ledger-table-shell">
        <table className="template-governance-ledger-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>摘要</th>
              <th>更多字段</th>
            </tr>
          </thead>
          <tbody>
            {searchState.rows.length ? (
              searchState.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.primary}</td>
                  <td>{row.secondary ?? "未补充"}</td>
                  <td>{row.cells.join(" / ") || "无"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3}>没有命中记录，可以调整关键词后再试。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
