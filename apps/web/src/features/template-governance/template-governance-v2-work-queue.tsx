import type { TemplateGovernanceV2SectionData } from "./template-governance-v2-data.ts";
import type { TemplateGovernanceV2RouteState } from "./template-governance-v2-types.ts";

export interface TemplateGovernanceV2WorkQueueProps {
  data: TemplateGovernanceV2SectionData | null;
  routeState: TemplateGovernanceV2RouteState;
  onSelectItem: (input: {
    selectedKind: TemplateGovernanceV2RouteState["selectedKind"];
    selectedId: string;
    panel: TemplateGovernanceV2RouteState["panel"];
  }) => void;
}

export function TemplateGovernanceV2WorkQueue({
  data,
  routeState,
  onSelectItem,
}: TemplateGovernanceV2WorkQueueProps) {
  if (!data) {
    return (
      <section data-v2-queue-section={routeState.section}>
        <p className="template-governance-empty">正在加载...</p>
      </section>
    );
  }

  if (data.section === "rules") {
    return (
      <section data-v2-queue-section="rules">
        <table className="rule-center-v2__queue-table">
          <thead>
            <tr>
              <th>规则</th>
              <th>类型</th>
              <th>模块</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {data.ledger.rows.map((row) => (
              <tr
                key={row.id}
                className={row.id === data.ledger.selectedRowId ? "is-selected" : undefined}
              >
                <td>
                  <button
                    type="button"
                    onClick={() =>
                      onSelectItem({
                        selectedKind: "rule-ledger-row",
                        selectedId: row.id,
                        panel: "rule-detail",
                      })
                    }
                  >
                    {row.title}
                  </button>
                </td>
                <td>{row.asset_kind}</td>
                <td>{row.module_label}</td>
                <td>{row.publish_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  if (data.section === "templates") {
    const rows =
      data.subtype === "large"
        ? data.ledger.templates.map((template) => ({
            id: template.id,
            title: template.name,
            status: template.status,
            selected: template.id === data.ledger.selectedTemplateId,
          }))
        : data.overview.journalTemplateProfiles.map((template) => ({
            id: template.id,
            title: template.journal_name,
            status: template.status,
            selected: template.id === data.overview.selectedJournalTemplateId,
          }));

    return (
      <section data-v2-queue-section="templates" data-v2-subtype={data.subtype}>
        {rows.map((row) => (
          <article
            key={row.id}
            className={`rule-center-v2__queue-row${row.selected ? " is-selected" : ""}`}
          >
            <button
              type="button"
              onClick={() =>
                onSelectItem({
                  selectedKind: "template",
                  selectedId: row.id,
                  panel: "template-detail",
                })
              }
            >
              <strong>{row.title}</strong>
            </button>
            <small>{row.status}</small>
          </article>
        ))}
      </section>
    );
  }

  if (data.section === "packages") {
    return (
      <section data-v2-queue-section="packages" data-v2-subtype={data.subtype}>
        {data.ledger.modules.map((module) => (
          <article
            key={module.id}
            className={`rule-center-v2__queue-row${
              module.id === data.ledger.selectedModuleId ? " is-selected" : ""
            }`}
          >
            <button
              type="button"
              onClick={() =>
                onSelectItem({
                  selectedKind: "package",
                  selectedId: module.id,
                  panel: "package-detail",
                })
              }
            >
              <strong>{module.name}</strong>
            </button>
            <small>{module.status}</small>
          </article>
        ))}
      </section>
    );
  }

  if (data.section === "extraction") {
    return (
      <section data-v2-queue-section="extraction">
        {data.ledger.tasks.map((task) => (
          <article
            key={task.id}
            className={`rule-center-v2__queue-row${
              task.id === data.ledger.selectedTaskId ? " is-selected" : ""
            }`}
          >
            <button
              type="button"
              onClick={() =>
                onSelectItem({
                  selectedKind: "extraction-task",
                  selectedId: task.id,
                  panel: "extraction-detail",
                })
              }
            >
              <strong>{task.task_name}</strong>
            </button>
            <small>{task.status}</small>
          </article>
        ))}
      </section>
    );
  }

  if (data.section === "recovery") {
    const rows = [
      ...data.candidates.map((candidate) => ({
        id: candidate.id,
        title: candidate.title ?? candidate.id,
        status: candidate.status,
        selectedKind: "learning-candidate" as const,
        panel: "candidate-detail" as const,
      })),
      ...data.reviewItems.map((item) => ({
        id: item.id,
        title: item.title ?? item.id,
        status: item.review_status,
        selectedKind: "review-item" as const,
        panel: "review-item-detail" as const,
      })),
    ];

    return (
      <section data-v2-queue-section="recovery">
        {rows.map((item) => (
          <article
            key={`${item.selectedKind}:${item.id}`}
            className={`rule-center-v2__queue-row${
              routeState.selectedKind === item.selectedKind &&
              routeState.selectedId === item.id
                ? " is-selected"
                : ""
            }`}
          >
            <button
              type="button"
              onClick={() =>
                onSelectItem({
                  selectedKind: item.selectedKind,
                  selectedId: item.id,
                  panel: item.panel,
                })
              }
            >
              <strong>{item.title}</strong>
            </button>
            <small>{item.status}</small>
          </article>
        ))}
      </section>
    );
  }

  if (data.section === "release") {
    return (
      <section data-v2-queue-section="release">
        {data.overview.ruleSets.map((ruleSet) => (
          <article
            key={ruleSet.id}
            className={`rule-center-v2__queue-row${
              ruleSet.id === data.overview.selectedRuleSetId ? " is-selected" : ""
            }`}
          >
            <button
              type="button"
              onClick={() =>
                onSelectItem({
                  selectedKind: "rule-set",
                  selectedId: ruleSet.id,
                  panel: "release-check",
                })
              }
            >
              <strong>{`${ruleSet.module} v${ruleSet.version_no}`}</strong>
            </button>
            <small>{ruleSet.status}</small>
          </article>
        ))}
      </section>
    );
  }

  if (data.section === "advanced") {
    return (
      <section data-v2-queue-section="advanced">
        <article className="rule-center-v2__queue-row">
          <strong>高级兼容</strong>
          <small>classic</small>
        </article>
      </section>
    );
  }

  if (data.section === "ai-intake") {
    return (
      <section data-v2-queue-section="ai-intake">
        <label className="rule-center-v2__field">
          <span>AI 录入</span>
          <textarea name="rule-ai-intake" rows={6} />
        </label>
      </section>
    );
  }

  return (
    <section data-v2-queue-section="dashboard">
      <div className="rule-center-v2__metric-strip">
        <article>
          <strong>{data.overview.ruleSets.length}</strong>
          <span>规则集</span>
        </article>
        <article>
          <strong>{data.overview.templateFamilies.length}</strong>
          <span>模板族</span>
        </article>
        <article>
          <strong>{data.overview.journalTemplateProfiles.length}</strong>
          <span>期刊模板</span>
        </article>
      </div>
    </section>
  );
}
