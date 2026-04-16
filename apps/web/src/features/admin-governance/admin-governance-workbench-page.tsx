import { useEffect, useState } from "react";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type { ResolvedExecutionBundleViewModel } from "../execution-governance/index.ts";
import { formatExecutionResolutionModelSourceLabel } from "../execution-governance/index.ts";
import {
  createAdminGovernanceWorkbenchController,
  type AdminGovernanceLandingOverview,
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

  const aiAccess = overview.landing.aiAccess;
  const harness = overview.landing.harness;
  const selectedModel =
    initialExecutionPreview == null
      ? null
      : formatModelDisplayName(initialExecutionPreview.resolved_model);
  const alerts = buildGovernanceAlerts(overview.landing, initialExecutionPreview);

  return (
    <section className="admin-governance-workbench">
      <div className="admin-governance-heading">
        <div className="admin-governance-heading-copy">
          <p className="admin-governance-kicker">轻量入口</p>
          <h2>管理总览</h2>
          <p>只保留跨系统治理入口和只读体征，深度配置请进入对应专页。</p>
        </div>
        {errorMessage ? <p className="admin-governance-error">{errorMessage}</p> : null}
      </div>

      <section className="admin-governance-entry-grid">
        <EntryCard
          title="AI 接入"
          description="维护 API Key、模型接入、模块绑定与温度策略，不再和账号管理混放。"
          href={formatWorkbenchHash("system-settings", {
            settingsSection: "ai-access",
          })}
          actionLabel="进入 AI 接入"
          chips={[
            `已接入 ${aiAccess.totalConnections} 个连接`,
            `已启用 ${aiAccess.enabledConnections} 个连接`,
            `生产可用 ${aiAccess.prodReadyModels} 个模型`,
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
            `${harness.evaluationSuiteCount} 个评测套件`,
            `${harness.runtimeBindingCount} 个运行绑定`,
            `${harness.adapterHealthCount} 条适配器健康记录`,
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
              href: formatWorkbenchHash("evaluation-workbench", {
                harnessSection: "datasets",
              }),
            },
          ]}
        />
      </section>

      <section className="admin-governance-summary">
        <SummaryCard label="已启用连接" value={aiAccess.enabledConnections} />
        <SummaryCard label="生产模型" value={aiAccess.prodReadyModels} />
        <SummaryCard label="Harness 适配器" value={harness.adapterHealthCount} />
        <SummaryCard label="当前提醒" value={alerts.length} />
      </section>

      <section className="admin-governance-snapshot-grid">
        <article className="admin-governance-panel">
          <div className="admin-governance-panel-header">
            <h3>AI 接入快照</h3>
            <span>快速判断连接、模型与回退链是否健康</span>
          </div>
          <ul className="admin-governance-list admin-governance-list-dense">
            {aiAccess.connections.slice(0, 4).map((connection) => (
              <li key={connection.id} className="admin-governance-asset-row">
                <span>{connection.name}</span>
                <small>
                  {connection.provider_kind} · {connection.compatibility_mode} ·{" "}
                  {formatConnectionTestStatus(connection.last_test_status)}
                </small>
              </li>
            ))}
          </ul>
          {aiAccess.connections.length === 0 ? (
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
            <SnapshotRow label="评测套件" value={`${harness.evaluationSuiteCount} 个`} />
            <SnapshotRow label="运行绑定" value={`${harness.runtimeBindingCount} 个`} />
            <SnapshotRow
              label="适配器健康"
              value={
                harness.adapterHealthCount > 0
                  ? `${harness.adapterHealthCount} 条记录`
                  : "暂无健康记录"
              }
            />
            <SnapshotRow
              label="最近 Judge 校准"
              value={
                harness.latestJudgeCalibrationBatchOutcome
                  ? `${harness.latestJudgeCalibrationBatchOutcome.execution_id} · ${harness.latestJudgeCalibrationBatchOutcome.status}`
                  : "暂无批次"
              }
            />
          </div>

          {harness.adapterHealth.length > 0 ? (
            <ul className="admin-governance-list admin-governance-list-dense">
              {harness.adapterHealth.slice(0, 3).map((record) => (
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
            <h3>当前提醒</h3>
            <span>先看该拿出来的风险，再决定是否进入细节页</span>
          </div>
          <ul className="admin-governance-list admin-governance-list-dense">
            {alerts.map((alert) => (
              <li key={alert} className="admin-governance-asset-row">
                <span>{alert}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
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
  landing: AdminGovernanceLandingOverview,
  executionPreview: ResolvedExecutionBundleViewModel | null,
) {
  const alerts = [...landing.warnings];

  if (executionPreview?.warnings.length) {
    alerts.push(
      `当前治理预览存在 ${executionPreview.warnings.length} 条预警：${executionPreview.warnings
        .map((warning) => warning.code)
        .join(", ")}。`,
    );
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

function formatModelDisplayName(
  model: Pick<ResolvedExecutionBundleViewModel["resolved_model"], "id" | "provider" | "model_name">,
) {
  return `${model.provider} / ${model.model_name} (${model.id})`;
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
