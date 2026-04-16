import type { Dispatch, FormEvent, SetStateAction } from "react";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import type {
  TemplateGovernanceContentModuleLedgerViewModel,
  TemplateGovernanceContentModuleRuleSummary,
} from "./template-governance-controller.ts";
import { TemplateGovernanceLedgerToolbar } from "./template-governance-ledger-toolbar.tsx";
import {
  TemplateGovernanceContentModuleForm,
  type TemplateGovernanceContentModuleFormValues,
} from "./template-governance-content-module-form.tsx";
import { TemplateGovernanceLedgerSearchPage } from "./template-governance-ledger-search-page.tsx";
import type { TemplateGovernanceLedgerSearchState } from "./template-governance-ledger-types.ts";
import {
  createTemplateGovernanceNavigationItems,
  type TemplateGovernanceNavigationItem,
} from "./template-governance-navigation.ts";
import {
  formatTemplateGovernanceGovernedAssetStatusLabel,
  formatTemplateGovernanceManuscriptTypeLabel,
  formatTemplateGovernanceModuleLabel,
} from "./template-governance-display.ts";

export interface TemplateGovernanceContentModuleLedgerPageProps {
  ledgerKind: "general" | "medical_specialized";
  viewModel: TemplateGovernanceContentModuleLedgerViewModel;
  formMode?: "create" | "edit" | null;
  formValues?: Partial<TemplateGovernanceContentModuleFormValues>;
  searchState?: TemplateGovernanceLedgerSearchState;
  searchValue?: string;
  isBusy?: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  navigationItems?: readonly TemplateGovernanceNavigationItem[];
  selectedRuleKey?: string | null;
  onSearchValueChange?: (value: string) => void;
  onSearchSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  onOpenCreateForm?: () => void;
  onArchiveSelected?: () => void;
  onJoinTemplate?: () => void;
  onSelectModule?: (moduleId: string) => void;
  onSelectRule?: (ruleKey: string) => void;
  onOpenEditForm?: () => void;
  onOpenSelectedRuleEdit?: () => void;
  onFormChange?: Dispatch<SetStateAction<TemplateGovernanceContentModuleFormValues>>;
  onFormCancel?: () => void;
  onFormSubmit?: () => void;
}

export function TemplateGovernanceContentModuleLedgerPage({
  ledgerKind,
  viewModel,
  formMode = null,
  formValues,
  searchState = {
    mode: "idle",
    query: "",
    title: "",
    rows: [],
  },
  searchValue = "",
  isBusy = false,
  statusMessage = null,
  errorMessage = null,
  navigationItems,
  selectedRuleKey,
  onSearchValueChange,
  onSearchSubmit,
  onOpenCreateForm,
  onArchiveSelected,
  onJoinTemplate,
  onSelectModule,
  onSelectRule,
  onOpenEditForm,
  onOpenSelectedRuleEdit,
  onFormChange,
  onFormCancel,
  onFormSubmit,
}: TemplateGovernanceContentModuleLedgerPageProps) {
  const pageTitle = ledgerKind === "general" ? "通用包台账" : "医学专用包台账";
  const selectedModule = viewModel.selectedModule;
  const resolvedSelectedRule =
    resolveSelectedRule(viewModel.selectedModuleRules, selectedRuleKey) ?? null;
  const selectedModuleRuleCount =
    selectedModule?.default_rule_count ?? viewModel.selectedModuleRules.length;
  const advancedEditorHref = formatWorkbenchHash("template-governance", {
    templateGovernanceView: "classic",
    ruleCenterMode: "authoring",
  });
  const ruleLedgerHref = formatWorkbenchHash("template-governance", {
    templateGovernanceView: "rule-ledger",
    ruleCenterMode: "authoring",
  });

  return (
    <section className="template-governance-content-module-ledger-page">
      <TemplateGovernanceLedgerToolbar
        title={pageTitle}
        subtitle={
          ledgerKind === "general"
            ? "把跨稿件类型可复用的规则与说明沉淀为通用包，再统一挂到大模板。"
            : "把医学专用解释、证据与风险边界整理为医学专用包，再按场景复用。"
        }
        navigationItems={
          navigationItems ??
          createTemplateGovernanceNavigationItems(
            ledgerKind === "general"
              ? "general-package-ledger"
              : "medical-package-ledger",
          )
        }
        searchValue={searchValue}
        searchPlaceholder={`搜索${pageTitle}`}
        onSearchValueChange={onSearchValueChange}
        onSearchSubmit={onSearchSubmit}
        actions={
          <>
            <button type="button" onClick={onOpenCreateForm}>
              新增{ledgerKind === "general" ? "通用包" : "医学包"}
            </button>
            <button type="button" onClick={onArchiveSelected}>
              删除
            </button>
            <button type="button" onClick={onJoinTemplate}>
              加入大模板
            </button>
          </>
        }
      />
      {statusMessage ? <p className="template-governance-status">{statusMessage}</p> : null}
      {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}

      <div className="template-governance-ledger-kpi-strip">
        <article className="template-governance-ledger-kpi">
          <span>包总数</span>
          <strong>{viewModel.summary.totalCount}</strong>
        </article>
        <article className="template-governance-ledger-kpi">
          <span>草稿数</span>
          <strong>{viewModel.summary.draftCount}</strong>
        </article>
        <article className="template-governance-ledger-kpi">
          <span>已发布数</span>
          <strong>{viewModel.summary.publishedCount}</strong>
        </article>
      </div>

      <article className="template-governance-card template-governance-ledger-section">
        <header className="template-governance-ledger-section-header">
          <h2>规则包使用说明</h2>
          <p>规则包负责沉淀可复用的治理组合，默认规则才是包里真正会被查看、编辑和挂载的具体规则。</p>
        </header>
        <div className="template-governance-rule-hint-list">
          <article className="template-governance-rule-hint-card">
            <strong>规则包是复用容器</strong>
            <p>它负责把同一类规则归在一起，方便后续统一挂到大模板或不同稿件族场景里复用。</p>
          </article>
          <article className="template-governance-rule-hint-card">
            <strong>默认规则是包里的具体规则</strong>
            <p>查看、校对、修改正文、图表证据和绑定范围时，真正编辑的是默认规则，而不是规则包标题本身。</p>
          </article>
          <article className="template-governance-rule-hint-card">
            <strong>先选规则包，再看默认规则，再决定是否编辑</strong>
            <p>这样能先确认当前包的复用范围，再避免把规则内容和包级摘要、适用边界混在一起修改。</p>
          </article>
        </div>
        <div className="template-governance-actions">
          <a className="template-governance-link-button" href={advancedEditorHref}>
            打开旧版高级工作台
          </a>
        </div>
      </article>

      <article className="template-governance-card template-governance-ledger-section">
        <header className="template-governance-ledger-section-header">
          <h2>{pageTitle}</h2>
          <p>表格优先展示所有录入的规则包，再决定是否进入编辑表单。</p>
        </header>
        <div className="template-governance-ledger-table-shell">
          <table className="template-governance-ledger-table">
            <thead>
              <tr>
                <th>包名称</th>
                <th>{ledgerKind === "general" ? "包分类" : "医学场景"}</th>
                <th>适用稿件</th>
                <th>适用模块</th>
                {ledgerKind === "medical_specialized" ? <th>证据/风险</th> : null}
                <th>默认规则数</th>
                <th>大模板使用数</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {viewModel.modules.length ? (
                viewModel.modules.map((module) => (
                  <tr
                    key={module.id}
                    className={
                      module.id === viewModel.selectedModuleId
                        ? "template-governance-ledger-row is-selected"
                        : "template-governance-ledger-row"
                    }
                  >
                    <td>
                      <button
                        type="button"
                        className="template-governance-ledger-row-button"
                        onClick={() => onSelectModule?.(module.id)}
                      >
                        {module.name}
                      </button>
                    </td>
                    <td>{module.category}</td>
                    <td>
                      {module.manuscript_type_scope
                        .map((item) => formatTemplateGovernanceManuscriptTypeLabel(item))
                        .join(" / ")}
                    </td>
                    <td>
                      {module.execution_module_scope
                        .map((item) => formatTemplateGovernanceModuleLabel(item))
                        .join(" / ")}
                    </td>
                    {ledgerKind === "medical_specialized" ? (
                      <td>
                        {module.evidence_level ?? "未知"} / {module.risk_level ?? "未设定"}
                      </td>
                    ) : null}
                    <td>{module.default_rule_count ?? 0} 条</td>
                    <td>{module.template_usage_count}</td>
                    <td>
                      {formatTemplateGovernanceGovernedAssetStatusLabel(module.status)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={ledgerKind === "medical_specialized" ? 8 : 7}>
                    当前还没有规则包记录。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
      <TemplateGovernanceLedgerSearchPage searchState={searchState} />

      {selectedModule ? (
        <article className="template-governance-card template-governance-ledger-section">
          <header className="template-governance-ledger-section-header">
            <h2>当前规则包</h2>
            <p>选中后查看摘要、边界与复用情况，再决定是否加入大模板。</p>
          </header>
          <div className="template-governance-detail-grid">
            <div>
              <span>名称</span>
              <p>{selectedModule.name}</p>
            </div>
            <div>
              <span>类别</span>
              <p>{selectedModule.category}</p>
            </div>
            <div>
              <span>默认规则数</span>
              <p>{selectedModuleRuleCount} 条</p>
            </div>
            <div className="template-governance-field-full">
              <span>摘要</span>
              <p>{selectedModule.summary}</p>
            </div>
          </div>
          <div className="template-governance-actions">
            <button type="button" onClick={onJoinTemplate}>
              加入大模板
            </button>
            <button type="button" onClick={onOpenEditForm}>
              编辑规则包
            </button>
          </div>

          <section className="template-governance-card template-governance-ledger-section">
            <header className="template-governance-ledger-section-header">
              <h2>默认规则</h2>
              <p>
                这里展示当前规则包已绑定的默认规则，当前共绑定 {selectedModuleRuleCount} 条，
                先把包内规则看清楚，再决定是否进入规则台账继续补齐或修改。
              </p>
            </header>

            {viewModel.selectedModuleRules.length ? (
              <>
                <div className="template-governance-actions">
                  <a className="template-governance-link-button" href={ruleLedgerHref}>
                    在规则台账查看全部默认规则
                  </a>
                  <a className="template-governance-link-button" href={advancedEditorHref}>
                    打开旧版高级工作台
                  </a>
                </div>
                <ul className="template-governance-list">
                  {viewModel.selectedModuleRules.map((rule) => {
                    const ruleKey = `${rule.assetId}:${rule.revisionId}`;
                    const isSelected =
                      resolvedSelectedRule != null &&
                      resolvedSelectedRule.assetId === rule.assetId &&
                      resolvedSelectedRule.revisionId === rule.revisionId;

                    return (
                      <li key={ruleKey}>
                        <button
                          type="button"
                          className={`template-governance-list-button${
                            isSelected ? " is-active" : ""
                          }`}
                          onClick={() => onSelectRule?.(ruleKey)}
                        >
                          <span>{rule.title}</span>
                          <small>
                            {formatRuleStatusLabel(rule.status)} ·{" "}
                            {formatTemplateGovernanceModuleLabel(rule.moduleScope)}
                          </small>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {resolvedSelectedRule ? (
                  <article className="template-governance-card">
                    <header className="template-governance-ledger-section-header">
                      <h2>规则详情</h2>
                      <p>查看默认规则正文、证据块与绑定范围，确认后再进入编辑。</p>
                    </header>
                    <div className="template-governance-detail-grid">
                      <div>
                        <span>规则名称</span>
                        <p>{resolvedSelectedRule.title}</p>
                      </div>
                      <div>
                        <span>状态</span>
                        <p>{formatRuleStatusLabel(resolvedSelectedRule.status)}</p>
                      </div>
                      <div>
                        <span>适用模块</span>
                        <p>{formatTemplateGovernanceModuleLabel(resolvedSelectedRule.moduleScope)}</p>
                      </div>
                      <div>
                        <span>适用稿件</span>
                        <p>{formatManuscriptTypesLabel(resolvedSelectedRule.manuscriptTypes)}</p>
                      </div>
                      <div className="template-governance-field-full">
                        <span>规则正文</span>
                        <p>{resolvedSelectedRule.canonicalText ?? "当前规则还没有正文。"}</p>
                      </div>
                      <div className="template-governance-field-full">
                        <span>绑定范围</span>
                        <p>
                          {resolvedSelectedRule.bindings.length
                            ? resolvedSelectedRule.bindings
                                .map((binding) => binding.binding_target_label)
                                .join(" / ")
                            : "当前规则还没有绑定范围。"}
                        </p>
                      </div>
                    </div>

                    {resolvedSelectedRule.contentBlocks.length ? (
                      <div className="template-governance-detail-grid">
                        {resolvedSelectedRule.contentBlocks.map((block) => (
                          <div
                            key={block.id}
                            className="template-governance-field-full"
                          >
                            <span>{formatRuleBlockTitle(block.block_type)}</span>
                            {renderRuleBlock(block)}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="template-governance-actions">
                      <button type="button" onClick={onOpenSelectedRuleEdit}>
                        编辑默认规则
                      </button>
                    </div>
                  </article>
                ) : null}
              </>
            ) : (
              <>
                <p className="template-governance-empty">
                  当前规则包还没有绑定默认规则。
                </p>
                <div className="template-governance-actions">
                  <a className="template-governance-link-button" href={ruleLedgerHref}>
                    前往规则台账补齐默认规则
                  </a>
                  <a className="template-governance-link-button" href={advancedEditorHref}>
                    打开旧版高级工作台
                  </a>
                </div>
              </>
            )}
          </section>
        </article>
      ) : null}

      {formMode ? (
        <TemplateGovernanceContentModuleForm
          ledgerKind={ledgerKind}
          mode={formMode}
          initialValues={formValues}
          isBusy={isBusy}
          onChange={onFormChange}
          onCancel={onFormCancel}
          onSubmit={onFormSubmit}
        />
      ) : null}
    </section>
  );
}

function resolveSelectedRule(
  rules: readonly TemplateGovernanceContentModuleRuleSummary[],
  selectedRuleKey: string | null | undefined,
): TemplateGovernanceContentModuleRuleSummary | null {
  if (!rules.length) {
    return null;
  }

  if (!selectedRuleKey) {
    return rules[0] ?? null;
  }

  return rules.find((rule) => `${rule.assetId}:${rule.revisionId}` === selectedRuleKey) ?? rules[0] ?? null;
}

function renderRuleBlock(block: TemplateGovernanceContentModuleRuleSummary["contentBlocks"][number]) {
  if (block.block_type === "table_block") {
    const rows = Array.isArray(block.content_payload.rows)
      ? (block.content_payload.rows as unknown[][])
      : [];

    if (!rows.length) {
      return <p>当前表格块还没有数据。</p>;
    }

    return (
      <div className="template-governance-ledger-table-shell">
        <table className="template-governance-ledger-table">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${block.id}:${rowIndex}`}>
                {(Array.isArray(row) ? row : []).map((cell, cellIndex) => (
                  <td key={`${block.id}:${rowIndex}:${cellIndex}`}>
                    {typeof cell === "string" ? cell : String(cell ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.block_type === "image_block") {
    return (
      <>
        <p>
          {typeof block.content_payload.file_name === "string"
            ? block.content_payload.file_name
            : "未命名图片"}
        </p>
        {typeof block.content_payload.caption === "string" ? (
          <p>{block.content_payload.caption}</p>
        ) : null}
        {typeof block.content_payload.storage_key === "string" ? (
          <p>{block.content_payload.storage_key}</p>
        ) : null}
      </>
    );
  }

  const label =
    typeof block.content_payload.label === "string" ? block.content_payload.label : "";
  const text =
    typeof block.content_payload.text === "string" ? block.content_payload.text : "";

  return <p>{label ? `${label}：${text}` : text || "当前文本块还没有内容。"}</p>;
}

function formatRuleBlockTitle(
  blockType: TemplateGovernanceContentModuleRuleSummary["contentBlocks"][number]["block_type"],
): string {
  switch (blockType) {
    case "text_block":
      return "文本内容";
    case "table_block":
      return "表格内容";
    case "image_block":
      return "图片内容";
    default:
      return blockType;
  }
}

function formatManuscriptTypesLabel(value: readonly string[] | "any"): string {
  if (value === "any" || value.length === 0) {
    return "全部稿件";
  }

  return value
    .map((item) => formatTemplateGovernanceManuscriptTypeLabel(item))
    .join(" / ");
}

function formatRuleStatusLabel(value: string): string {
  switch (value) {
    case "approved":
      return "已通过";
    case "pending_review":
      return "待审核";
    case "draft":
      return "草稿";
    case "superseded":
      return "已替代";
    case "archived":
      return "已归档";
    default:
      return value;
  }
}
