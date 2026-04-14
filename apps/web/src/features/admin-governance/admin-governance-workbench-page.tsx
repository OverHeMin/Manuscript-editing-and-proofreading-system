import { useEffect, useState } from "react";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type { ResolvedExecutionBundleViewModel } from "../execution-governance/index.ts";
import { formatExecutionResolutionModelSourceLabel } from "../execution-governance/index.ts";
import {
  createAdminGovernanceWorkbenchController,
  type AdminGovernanceOverview,
  type AdminGovernanceWorkbenchController,
} from "./admin-governance-controller.ts";

if (typeof document !== "undefined") {
  void import("./admin-governance-workbench.css");
}

const defaultController = createAdminGovernanceWorkbenchController(
  createBrowserHttpClient(),
);

export interface AdminGovernanceWorkbenchPageProps {
  actorRole?: AuthRole;
  controller?: AdminGovernanceWorkbenchController;
  initialOverview?: AdminGovernanceOverview | null;
  initialExecutionPreview?: ResolvedExecutionBundleViewModel | null;
  initialErrorMessage?: string | null;
}

export function AdminGovernanceWorkbenchPage({
  controller = defaultController,
  initialOverview = null,
  initialExecutionPreview = null,
  initialErrorMessage = null,
}: AdminGovernanceWorkbenchPageProps) {
  const [overview, setOverview] = useState<AdminGovernanceOverview | null>(initialOverview);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">(
    initialErrorMessage ? "error" : initialOverview ? "ready" : "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage);

  useEffect(() => {
    if (initialOverview != null) {
      return;
    }

    void loadOverview();
  }, [controller, initialOverview]);

  async function loadOverview() {
    setLoadStatus("loading");
    setErrorMessage(null);

    try {
      const nextOverview = await controller.loadOverview();
      setOverview(nextOverview);
      setLoadStatus("ready");
    } catch (error) {
      setLoadStatus("error");
      setErrorMessage(toErrorMessage(error));
    }
  }

  if (!overview && loadStatus !== "error") {
    return (
      <article className="workbench-placeholder" role="status">
        <h2>正在加载管理总览</h2>
        <p>正在汇总 AI 接入、Harness 控制与治理资产状态。</p>
      </article>
    );
  }

  if (!overview) {
    return (
      <article className="workbench-placeholder" role="alert">
        <h2>管理总览暂不可用</h2>
        <p>{errorMessage ?? "暂时无法加载管理区数据。"}</p>
      </article>
    );
  }

  const aiConnections = overview.aiProviderConnections ?? [];
  const modelEntries = overview.modelRegistryEntries ?? [];
  const qualityPackages = overview.qualityPackages ?? [];
  const evaluationSuites = overview.evaluationSuites ?? [];
  const runtimeBindings = overview.runtimeBindings ?? [];
  const executionProfiles = overview.executionProfiles ?? [];
  const templateFamilies = overview.templateFamilies ?? [];
  const harnessAdapterHealth = overview.harnessAdapterHealth ?? [];
  const toolGatewayTools = overview.toolGatewayTools ?? [];
  const agentProfiles = overview.agentProfiles ?? [];
  const sandboxProfiles = overview.sandboxProfiles ?? [];
  const agentExecutionLogs = overview.agentExecutionLogs ?? [];
  const enabledConnections = aiConnections.filter((connection) => connection.enabled).length;
  const prodReadyModels = modelEntries.filter((model) => model.is_prod_allowed).length;
  const publishedQualityPackages = qualityPackages.filter(
    (record) => record.status === "published",
  ).length;
  const selectedModel =
    initialExecutionPreview == null
      ? null
      : resolveModelDisplayName(modelEntries, initialExecutionPreview.resolved_model.id);

  return (
    <section className="admin-governance-workbench">
      <header className="admin-governance-hero">
        <div className="admin-governance-hero-copy">
          <p className="admin-governance-eyebrow">管理区</p>
          <h2>管理总览</h2>
          <p>
            把高频治理入口拿出来，把复杂配置收进专页。AI 接入、账号与权限、Harness
            控制都从这里快速进入。
          </p>
          <p>
            规则、模板与校对策略已统一收口到规则中心，管理区只保留真正的后台治理入口。
          </p>
          {errorMessage ? <p className="admin-governance-error">{errorMessage}</p> : null}
        </div>
      </header>

      <section className="admin-governance-entry-grid">
        <EntryCard
          title="AI 接入"
          description="维护 API Key、模型接入、模块绑定与温度策略，不再和账号管理混放。"
          href={formatWorkbenchHash("system-settings", {
            settingsSection: "ai-access",
          })}
          actionLabel="进入 AI 接入"
          chips={[
            `已接入 ${aiConnections.length} 个连接`,
            `已启用 ${enabledConnections} 个连接`,
            `生产可用 ${prodReadyModels} 个模型`,
          ]}
        />
        <EntryCard
          title="账号与权限"
          description="集中处理账号、角色与访问范围，避免和 AI 接入参数重复。"
          href={formatWorkbenchHash("system-settings", {
            settingsSection: "accounts",
          })}
          actionLabel="进入账号与权限"
          chips={["账号独立子页", "角色治理", "访问范围"]}
        />
        <EntryCard
          title="Harness 控制"
          description="评测运行、数据样本与结果对照统一收口，避免形成低频孤岛栏目。"
          href={formatWorkbenchHash("evaluation-workbench", {
            harnessSection: "overview",
          })}
          actionLabel="进入 Harness 控制"
          chips={[
            `${evaluationSuites.length} 个评测套件`,
            `${runtimeBindings.length} 个运行绑定`,
            `${harnessAdapterHealth.length} 条适配器健康记录`,
          ]}
          links={[
            {
              label: "评测运行",
              href: formatWorkbenchHash("evaluation-workbench", {
                harnessSection: "runs",
              }),
            },
            {
              label: "数据/样本",
              href: formatWorkbenchHash("harness-datasets"),
            },
          ]}
        />
        <EntryCard
          title="规则中心"
          description="规则、模板与校对策略已迁入协作与回收区，避免继续堆在管理页。"
          href={formatWorkbenchHash("template-governance", {
            templateGovernanceView: "authoring",
            ruleCenterMode: "authoring",
          })}
          actionLabel="打开规则中心"
          chips={[
            `${templateFamilies.length} 个模板族`,
            `${executionProfiles.length} 条执行画像`,
            `${publishedQualityPackages} 个已发布质量包`,
          ]}
        />
      </section>

      <section className="admin-governance-summary">
        <SummaryCard label="AI 连接" value={aiConnections.length} />
        <SummaryCard label="模型条目" value={modelEntries.length} />
        <SummaryCard label="运行绑定" value={runtimeBindings.length} />
        <SummaryCard label="评测套件" value={evaluationSuites.length} />
        <SummaryCard label="质量包" value={qualityPackages.length} />
        <SummaryCard label="Agent 运行" value={agentExecutionLogs.length} />
      </section>

      <section className="admin-governance-snapshot-grid">
        <article className="admin-governance-panel">
          <div className="admin-governance-panel-header">
            <h3>AI 接入快照</h3>
            <span>快速判断连接、模型与回退链是否健康</span>
          </div>
          <ul className="admin-governance-list admin-governance-list-dense">
            {aiConnections.slice(0, 4).map((connection) => (
              <li key={connection.id} className="admin-governance-asset-row">
                <span>{connection.name}</span>
                <small>
                  {connection.provider_kind} · {connection.compatibility_mode} ·{" "}
                  {formatConnectionTestStatus(connection.last_test_status)}
                </small>
              </li>
            ))}
          </ul>
          {aiConnections.length === 0 ? (
            <p className="admin-governance-empty">尚未配置 AI 连接，请先到 AI 接入页添加。</p>
          ) : null}

          {initialExecutionPreview ? (
            <div className="admin-governance-snapshot-stack">
              <SnapshotRow label="当前生效模型" value={selectedModel ?? "未命名模型"} />
              <SnapshotRow
                label="当前生效连接"
                value={initialExecutionPreview.resolved_connection
                  ? `${initialExecutionPreview.resolved_connection.name} (${initialExecutionPreview.resolved_connection.id})`
                  : "未分配"}
              />
              <SnapshotRow
                label="来源"
                value={`${formatExecutionResolutionModelSourceLabel(
                  initialExecutionPreview.model_source,
                )} (${initialExecutionPreview.model_source})`}
              />
              <SnapshotRow
                label="回退模型"
                value={
                  initialExecutionPreview.fallback_chain
                    .map((model) => formatModelDisplayName(model))
                    .join(" -> ") || "无"
                }
              />
              <SnapshotRow
                label="预览预警"
                value={
                  initialExecutionPreview.warnings.map((warning) => warning.code).join(", ") ||
                  "无"
                }
              />
              <SnapshotRow
                label="连通提醒"
                value={
                  initialExecutionPreview.provider_readiness.issues
                    .map((issue) => issue.code)
                    .join(", ") || "无"
                }
              />
            </div>
          ) : null}
        </article>

        <article className="admin-governance-panel">
          <div className="admin-governance-panel-header">
            <h3>Harness 运行体征</h3>
            <span>让高阶控制保持可见，但不抢第一页</span>
          </div>
          <div className="admin-governance-snapshot-stack">
            <SnapshotRow label="评测套件" value={`${evaluationSuites.length} 个`} />
            <SnapshotRow label="运行绑定" value={`${runtimeBindings.length} 个`} />
            <SnapshotRow
              label="适配器健康"
              value={
                harnessAdapterHealth.length > 0
                  ? `${harnessAdapterHealth.length} 条记录`
                  : "暂无健康记录"
              }
            />
            <SnapshotRow
              label="最近 Judge 校准"
              value={
                overview.latestJudgeCalibrationBatchOutcome
                  ? `${overview.latestJudgeCalibrationBatchOutcome.execution_id} · ${overview.latestJudgeCalibrationBatchOutcome.status}`
                  : "暂无批次"
              }
            />
          </div>

          {harnessAdapterHealth.length > 0 ? (
            <ul className="admin-governance-list admin-governance-list-dense">
              {harnessAdapterHealth.slice(0, 3).map((record) => (
                <li key={record.adapter.id} className="admin-governance-asset-row">
                  <span>{record.adapter.display_name}</span>
                  <small>
                    {record.adapter.kind} · {record.adapter.execution_mode} · 最近状态{" "}
                    {record.latest_status}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-governance-empty">
              Harness 详情已收口到 Harness 控制页，这里只保留总览快照。
            </p>
          )}
        </article>

        <article className="admin-governance-panel">
          <div className="admin-governance-panel-header">
            <h3>治理资产快照</h3>
            <span>模板、执行画像与工具策略只保留摘要</span>
          </div>
          <div className="admin-governance-snapshot-stack">
            <SnapshotRow label="模板族" value={`${templateFamilies.length} 个`} />
            <SnapshotRow label="执行画像" value={`${executionProfiles.length} 条`} />
            <SnapshotRow label="质量包" value={`${qualityPackages.length} 个`} />
            <SnapshotRow label="工具网关" value={`${toolGatewayTools.length} 个`} />
            <SnapshotRow label="沙箱配置" value={`${sandboxProfiles.length} 个`} />
            <SnapshotRow label="Agent 档案" value={`${agentProfiles.length} 个`} />
          </div>
          <p className="admin-governance-empty">
            具体规则、模板与校对策略请前往规则中心，管理页不再承担长编辑链路。
          </p>
        </article>

        <article className="admin-governance-panel">
          <div className="admin-governance-panel-header">
            <h3>当前提醒</h3>
            <span>先看该拿出来的风险，再决定是否进入细节页</span>
          </div>
          <ul className="admin-governance-list admin-governance-list-dense">
            {buildGovernanceAlerts(overview, initialExecutionPreview).map((alert) => (
              <li key={alert} className="admin-governance-asset-row">
                <span>{alert}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <details className="admin-governance-detail-shell">
        <summary>查看治理资产明细</summary>
        <div className="admin-governance-detail-grid">
          <article className="admin-governance-panel">
            <div className="admin-governance-panel-header">
              <h3>模板与执行明细</h3>
              <span>只保留摘要，编辑动作已迁往对应专页</span>
            </div>
            <ul className="admin-governance-list admin-governance-list-dense">
              {templateFamilies.slice(0, 5).map((family) => (
                <li key={family.id} className="admin-governance-asset-row">
                  <span>{family.name}</span>
                  <small>
                    {formatManuscriptTypeLabel(family.manuscript_type)} · {family.status}
                  </small>
                </li>
              ))}
            </ul>
            {templateFamilies.length === 0 ? (
              <p className="admin-governance-empty">当前没有模板族记录。</p>
            ) : null}
          </article>

          <article className="admin-governance-panel">
            <div className="admin-governance-panel-header">
              <h3>AI 路由摘要</h3>
              <span>便于先判断是否需要进入 AI 接入页</span>
            </div>
            <div className="admin-governance-snapshot-stack">
              <SnapshotRow
                label="系统默认模型"
                value={resolveModelDisplayName(
                  modelEntries,
                  overview.modelRoutingPolicy.system_default_model_id,
                )}
              />
              <SnapshotRow
                label="模块默认数"
                value={`${countAssignedModuleDefaults(
                  overview.modelRoutingPolicy.module_defaults,
                )} 项`}
              />
              <SnapshotRow label="路由策略版本" value={`${overview.routingPolicies.length} 组`} />
              <SnapshotRow
                label="生产可用模型"
                value={`${prodReadyModels} 个`}
              />
            </div>
          </article>

          <article className="admin-governance-panel">
            <div className="admin-governance-panel-header">
              <h3>最近运行摘要</h3>
              <span>只看队列体征，不在这里展开深度排障</span>
            </div>
            <ul className="admin-governance-list admin-governance-list-dense">
              {agentExecutionLogs.slice(0, 5).map((log) => (
                <li key={log.id} className="admin-governance-asset-row">
                  <span>
                    {formatModuleLabel(log.module)} · 稿件 {log.manuscript_id}
                  </span>
                  <small>
                    {log.status} · 运行时 {log.runtime_id} · 绑定 {log.runtime_binding_id}
                  </small>
                </li>
              ))}
            </ul>
            {agentExecutionLogs.length === 0 ? (
              <p className="admin-governance-empty">最近还没有 Agent 运行记录。</p>
            ) : null}
          </article>
        </div>
      </details>
    </section>
  );
}

function EntryCard(props: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  chips: string[];
  links?: Array<{ label: string; href: string }>;
}) {
  return (
    <article className="admin-governance-link-card">
      <div className="admin-governance-link-copy">
        <p className="admin-governance-link-kicker">入口</p>
        <h3>{props.title}</h3>
        <p>{props.description}</p>
      </div>
      <ul className="admin-governance-chip-list">
        {props.chips.map((chip) => (
          <li key={chip}>{chip}</li>
        ))}
      </ul>
      <div className="admin-governance-link-actions">
        <a className="workbench-secondary-action admin-governance-link-action" href={props.href}>
          {props.actionLabel}
        </a>
        {props.links?.map((link) => (
          <a
            key={link.href}
            className="admin-governance-inline-link"
            href={link.href}
          >
            {link.label}
          </a>
        ))}
      </div>
    </article>
  );
}

function SummaryCard(props: { label: string; value: number }) {
  return (
    <article className="admin-governance-summary-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </article>
  );
}

function SnapshotRow(props: { label: string; value: string }) {
  return (
    <div className="admin-governance-snapshot-row">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function buildGovernanceAlerts(
  overview: AdminGovernanceOverview,
  executionPreview: ResolvedExecutionBundleViewModel | null,
) {
  const alerts: string[] = [];
  const connections = overview.aiProviderConnections ?? [];
  const qualityPackages = overview.qualityPackages ?? [];

  if (connections.length === 0) {
    alerts.push("尚未配置 AI 连接，需先在 AI 接入页完成接入。");
  }

  const unknownConnections = connections.filter(
    (connection) => connection.last_test_status === "unknown",
  );
  if (unknownConnections.length > 0) {
    alerts.push(`有 ${unknownConnections.length} 个 AI 连接尚未完成连通性测试。`);
  }

  if (qualityPackages.every((record) => record.status !== "published")) {
    alerts.push("还没有已发布质量包，Harness 对照结果的落地依据会偏弱。");
  }

  if (executionPreview?.warnings.length) {
    alerts.push(
      `当前治理预览存在 ${executionPreview.warnings.length} 条预警：${executionPreview.warnings
        .map((warning) => warning.code)
        .join(", ")}。`,
    );
  }

  if (overview.harnessAdapterHealth?.some((record) => record.latest_degradation_reason)) {
    alerts.push("Harness 适配器存在降级记录，建议进入 Harness 控制页进一步查看。");
  }

  if (alerts.length === 0) {
    alerts.push("当前没有需要前台立刻处理的全局提醒。");
  }

  return alerts;
}

function formatConnectionTestStatus(status: string | null | undefined) {
  switch (status) {
    case "passed":
      return "连通正常";
    case "failed":
      return "连通失败";
    case "unknown":
    default:
      return "待测试";
  }
}

function formatManuscriptTypeLabel(value: string) {
  switch (value) {
    case "clinical_study":
      return "临床研究";
    case "review":
      return "综述";
    case "case_report":
      return "病例报告";
    case "guideline_interpretation":
      return "指南解读";
    default:
      return value;
  }
}

function formatModuleLabel(value: string) {
  switch (value) {
    case "screening":
      return "初筛";
    case "editing":
      return "编辑";
    case "proofreading":
      return "校对";
    default:
      return value;
  }
}

function countAssignedModuleDefaults(
  moduleDefaults: Record<string, string | null | undefined>,
) {
  return Object.values(moduleDefaults).filter((value) => value != null && value.length > 0).length;
}

function formatModelDisplayName(
  model: Pick<ResolvedExecutionBundleViewModel["resolved_model"], "id" | "provider" | "model_name">,
) {
  return `${model.provider} / ${model.model_name} (${model.id})`;
}

function resolveModelDisplayName(
  models: readonly Pick<ResolvedExecutionBundleViewModel["resolved_model"], "id" | "provider" | "model_name">[],
  modelId: string | undefined | null,
) {
  if (!modelId) {
    return "未分配";
  }

  const model = models.find((candidate) => candidate.id === modelId);
  return model ? formatModelDisplayName(model) : modelId;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof BrowserHttpClientError) {
    const responseBody = error.responseBody;
    if (responseBody && typeof responseBody === "object") {
      const message = (responseBody as Record<string, unknown>).message;
      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }
    }

    return `请求失败（${error.status}）。`;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return "请求失败。";
}
