import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { WorkbenchCoreStrip } from "../../app/workbench-core-strip.tsx";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import {
  createHarnessDatasetsWorkbenchController,
  type HarnessDatasetsWorkbenchController,
} from "./harness-datasets-controller.ts";
import type {
  HarnessDatasetExportFormat,
  HarnessDatasetVersionViewModel,
  HarnessDatasetsWorkbenchOverview,
  QuickProofreadingGoldSetInput,
} from "./types.ts";

if (typeof document !== "undefined") {
  void import("./harness-datasets-workbench.css");
}

const defaultController = createHarnessDatasetsWorkbenchController(
  createBrowserHttpClient(),
);

export interface HarnessDatasetsWorkbenchPageProps {
  controller?: HarnessDatasetsWorkbenchController;
  initialOverview?: HarnessDatasetsWorkbenchOverview | null;
  embedded?: boolean;
}

export function HarnessDatasetsWorkbenchPage({
  controller = defaultController,
  initialOverview = null,
  embedded = false,
}: HarnessDatasetsWorkbenchPageProps) {
  const [overview, setOverview] = useState<HarnessDatasetsWorkbenchOverview | null>(
    initialOverview,
  );
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">(
    initialOverview ? "ready" : "idle",
  );
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [quickGoldSetJson, setQuickGoldSetJson] = useState(
    JSON.stringify(
      {
        expectedIssues: [
          {
            id: "expected-issue-1",
            severity: "critical",
            issueType: "sample_size_consistency",
            layerId: "context_consistency",
            quote: "n=120",
          },
        ],
        criticalRecallThreshold: 1,
        falsePositiveReviewThreshold: 0.2,
        requiredLayers: ["context_consistency"],
      },
      null,
      2,
    ),
  );

  useEffect(() => {
    if (initialOverview != null) {
      return;
    }

    void loadOverview();
  }, [controller, initialOverview]);

  if (loadStatus === "error" && !overview) {
    return (
      <article className="workbench-placeholder" role="alert">
        <h2>Harness 控制 / 数据与样本</h2>
        <p>{errorMessage ?? "暂时无法载入 Harness 数据样本台。"}</p>
      </article>
    );
  }

  if (!overview) {
    return (
      <article className="workbench-placeholder" role="status">
        <h2>Harness 控制 / 数据与样本</h2>
        <p>正在载入金标准草稿、已发布版本与评分规则关联...</p>
      </article>
    );
  }

  return (
    <section className={`harness-datasets-workbench${embedded ? " is-embedded" : ""}`}>
      {embedded ? null : (
        <header className="harness-datasets-hero">
          <div className="harness-datasets-hero-copy">
            <p className="harness-datasets-eyebrow">Harness 控制</p>
            <h2>Harness 控制 / 数据与样本</h2>
            <p>
              统一整理高质量样本、评分规则与本地导出，不再作为单独难理解的孤立栏目。
            </p>
            <WorkbenchCoreStrip variant="secondary" />
          </div>
          {statusMessage ? (
            <p className="harness-datasets-status" role="status">
              {statusMessage}
            </p>
          ) : null}
        </header>
      )}

      {embedded && statusMessage ? (
        <p className="harness-datasets-status" role="status">
          {statusMessage}
        </p>
      ) : null}

      {embedded ? (
        <section className="harness-datasets-embedded-banner">
          <strong>Harness 数据与样本</strong>
          <p className="harness-datasets-copy">
            当前数据集视图仍然属于同一个 Harness 工作区，用于在运行治理链路里直接核对样本、规则和导出状态。
          </p>
        </section>
      ) : null}

      <section className="harness-datasets-embedded-banner">
        <strong>Medical proofreading Gold Set</strong>
        <p className="harness-datasets-copy">
          Use proofreading gold sets to pin expected issues, context consistency
          checks, statistics/table assertions, and false positive/false negative
          review thresholds before a model or rule change is promoted.
        </p>
        <p className="harness-datasets-copy">
          Operator flow: Family → Version → Case → Assertion → Publish.
          Required validation: source asset, expected issues, published rubric,
          de-identification, human review.
        </p>
        <p className="harness-datasets-copy">
          Import/export guidance: JSON for reviewer handoff, JSONL for batch
          evaluation.
        </p>
      </section>

      {errorMessage ? (
        <p className="harness-datasets-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <section className="harness-datasets-summary">
        <article className="harness-datasets-summary-card">
          <span>待整理版本</span>
          <strong>{overview.draftVersions.length}</strong>
        </article>
        <article className="harness-datasets-summary-card">
          <span>已发布版本</span>
          <strong>{overview.publishedVersions.length}</strong>
        </article>
        <article className="harness-datasets-summary-card">
          <span>已发布规则</span>
          <strong>
            {overview.rubrics.filter((rubric) => rubric.status === "published").length}
          </strong>
        </article>
        <article className="harness-datasets-summary-card harness-datasets-summary-card-wide">
          <span>本地导出目录</span>
          <strong>{overview.exportRootDir}</strong>
        </article>
      </section>

      <div className="harness-datasets-layout">
        <article className="harness-datasets-panel">
          <div className="harness-datasets-panel-header">
            <h3>快速创建 Proofreading Gold Set</h3>
            <span>管理员入口</span>
          </div>
          <form className="harness-datasets-stack" onSubmit={handleQuickGoldSetSubmit}>
            <label>
              <span>Gold Set 名称</span>
              <input name="name" defaultValue="Proofreading issue detection gold set" />
            </label>
            <label>
              <span>稿件类型</span>
              <select name="manuscriptType" defaultValue="clinical_study">
                <option value="clinical_study">临床研究</option>
                <option value="review">综述</option>
                <option value="case_report">病例报告</option>
              </select>
            </label>
            <label>
              <span>来源类型</span>
              <select name="sourceKind" defaultValue="reviewed_case_snapshot">
                <option value="reviewed_case_snapshot">已复核案例快照</option>
                <option value="human_final_asset">人工终稿资产</option>
                <option value="evaluation_evidence_pack">评测证据包</option>
              </select>
            </label>
            <label>
              <span>来源 ID</span>
              <input name="sourceId" defaultValue="snapshot-1" />
            </label>
            <label>
              <span>稿件 ID</span>
              <input name="manuscriptId" defaultValue="manuscript-1" />
            </label>
            <label>
              <span>预期问题 JSON</span>
              <textarea
                name="expectedStructuredOutput"
                rows={8}
                value={quickGoldSetJson}
                onChange={(event) => setQuickGoldSetJson(event.currentTarget.value)}
              />
            </label>
            <button type="submit" disabled={isBusy}>
              创建并发布 Gold Set
            </button>
          </form>
        </article>

        <article className="harness-datasets-panel">
          <div className="harness-datasets-panel-header">
            <h3>待整理队列</h3>
            <span>{overview.draftVersions.length} 个草稿版本</span>
          </div>
          {overview.draftVersions.length > 0 ? (
            <div className="harness-datasets-stack">
              {overview.draftVersions.map((version) => (
                <HarnessDatasetVersionCard key={version.id} version={version} />
              ))}
            </div>
          ) : (
            <p className="harness-datasets-empty">
              当前没有待整理的样本草稿版本。
            </p>
          )}
        </article>

        <article className="harness-datasets-panel">
          <div className="harness-datasets-panel-header">
            <h3>已发布版本</h3>
            <span>{overview.publishedVersions.length} 个已发布版本</span>
          </div>
          <p className="harness-datasets-note">
            本地导出目录：{overview.exportRootDir}
          </p>
          {overview.publishedVersions.length > 0 ? (
            <div className="harness-datasets-stack">
              {overview.publishedVersions.map((version) => (
                <HarnessDatasetVersionCard
                  key={version.id}
                  version={version}
                  actions={
                    <div className="harness-datasets-actions">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleExport(version.id, "json")}
                      >
                        导出 JSON
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleExport(version.id, "jsonl")}
                      >
                        导出 JSONL
                      </button>
                    </div>
                  }
                />
              ))}
            </div>
          ) : (
            <p className="harness-datasets-empty">
              当前还没有可导出的已发布样本版本。
            </p>
          )}
        </article>
      </div>
    </section>
  );

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

  async function handleExport(
    goldSetVersionId: string,
    format: HarnessDatasetExportFormat,
  ) {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await controller.exportGoldSetVersionAndReload({
        goldSetVersionId,
        format,
      });
      setOverview(result.overview);
      setLoadStatus("ready");
      setStatusMessage(
        `${format.toUpperCase()} 导出已保存到 ${result.exportResult.outputPath}。`,
      );
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleQuickGoldSetSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const formData = new FormData(event.currentTarget);
      const expectedStructuredOutput = JSON.parse(quickGoldSetJson) as Record<
        string,
        unknown
      >;
      const input: QuickProofreadingGoldSetInput = {
        name: readRequiredFormValue(formData, "name"),
        manuscriptType: readRequiredFormValue(
          formData,
          "manuscriptType",
        ) as QuickProofreadingGoldSetInput["manuscriptType"],
        sourceKind: readRequiredFormValue(
          formData,
          "sourceKind",
        ) as QuickProofreadingGoldSetInput["sourceKind"],
        sourceId: readRequiredFormValue(formData, "sourceId"),
        manuscriptId: readRequiredFormValue(formData, "manuscriptId"),
        expectedStructuredOutput,
        publicationNotes: "Created from Harness datasets workbench quick form.",
      };
      const nextOverview = await controller.createProofreadingGoldSetAndReload(input);
      setOverview(nextOverview);
      setLoadStatus("ready");
      setStatusMessage("Proofreading Gold Set 已创建并发布。");
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }
}

function HarnessDatasetVersionCard(props: {
  version: HarnessDatasetVersionViewModel;
  actions?: ReactNode;
}) {
  const { version, actions } = props;
  const releaseFreezeStatus = describeReleaseFreezeStatus(version);
  const assertionSummary = summarizeGoldSetAssertions(version);

  return (
    <article className="harness-datasets-card">
      <header className="harness-datasets-card-header">
        <div>
          <h4>{version.familyName}</h4>
          <p>
            {formatModuleLabel(version.familyScope.module)} · v{version.versionNo} · {formatVersionStatusLabel(version.status)}
          </p>
        </div>
        <div className="harness-datasets-gates">
          <span>
            脱敏校验：
            {version.deidentificationGatePassed ? "已通过" : "待完成"}
          </span>
          <span>
            人工复核：{version.humanReviewGatePassed ? "已通过" : "待完成"}
          </span>
        </div>
      </header>

      <p className="harness-datasets-copy">
        关注重点：{formatMeasureFocusLabel(version.familyScope.measureFocus)} · 稿件类型：
        {version.familyScope.manuscriptTypes.map(formatManuscriptTypeLabel).join("、")}
      </p>
      <p className="harness-datasets-copy">
        评分规则：{describeRubricAssignment(version)}
      </p>
      <p className="harness-datasets-copy">样本条目：{version.itemCount}</p>
      {assertionSummary ? (
        <div className="harness-datasets-provenance">
          <strong>Content-level assertions</strong>
          <p className="harness-datasets-copy">
            {`Expected issues: ${assertionSummary.expectedIssueCount}`}
            {assertionSummary.criticalRecallThreshold !== undefined
              ? ` · critical recall: ${formatPercent(assertionSummary.criticalRecallThreshold)}`
              : ""}
            {assertionSummary.falsePositiveReviewThreshold !== undefined
              ? ` · false positive review: ${formatPercent(assertionSummary.falsePositiveReviewThreshold)}`
              : ""}
          </p>
          {assertionSummary.requiredLayers.length > 0 ? (
            <p className="harness-datasets-copy">
              Required layers: {assertionSummary.requiredLayers.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
      {releaseFreezeStatus != null ? (
        <div className="harness-datasets-provenance">
          <strong>{releaseFreezeStatus.label}</strong>
          <p className="harness-datasets-copy">{releaseFreezeStatus.copy}</p>
        </div>
      ) : null}

      <div className="harness-datasets-provenance">
        <strong>来源追溯</strong>
        <ul className="harness-datasets-list">
          {version.sourceProvenance.map((source) => (
            <li key={`${source.sourceKind}:${source.sourceId}`}>
              <span>
                {formatSourceKindLabel(source.sourceKind)}: {source.sourceId}
              </span>
              <small>
                {formatManuscriptTypeLabel(source.manuscriptType)} · {source.manuscriptId}
                {source.riskTags?.length
                  ? ` · ${source.riskTags.map(formatRiskTagLabel).join("、")}`
                  : ""}
              </small>
            </li>
          ))}
        </ul>
      </div>

      {version.publications.length > 0 ? (
        <div className="harness-datasets-publications">
          <strong>导出记录</strong>
          <ul className="harness-datasets-list">
            {version.publications.map((publication) => (
              <li key={publication.id}>
                <span>
                  {publication.exportFormat.toUpperCase()} ·{" "}
                  {formatPublicationStatusLabel(publication.status)}
                </span>
                <small>{publication.outputUri ?? "暂无本地路径记录"}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {actions}
    </article>
  );
}

function describeRubricAssignment(version: HarnessDatasetVersionViewModel) {
  if (version.rubricAssignment.status === "missing") {
    return "需要人工指定";
  }

  return `${version.rubricAssignment.rubricName ?? "已分配规则"} v${
    version.rubricAssignment.rubricVersionNo ?? "?"
  }（${formatVersionStatusLabel(version.rubricAssignment.status)}）`;
}

function summarizeGoldSetAssertions(version: HarnessDatasetVersionViewModel):
  | {
      expectedIssueCount: number;
      criticalRecallThreshold?: number;
      falsePositiveReviewThreshold?: number;
      requiredLayers: string[];
    }
  | null {
  const summaries = version.sourceProvenance
    .map((source) => asAssertionObject(source.expectedStructuredOutput))
    .filter((value): value is Record<string, unknown> => value !== null);

  if (summaries.length === 0) {
    return null;
  }

  return {
    expectedIssueCount: summaries.reduce(
      (total, summary) =>
        total +
        (Array.isArray(summary.expectedIssues) ? summary.expectedIssues.length : 0),
      0,
    ),
    criticalRecallThreshold: maxOptionalNumber(
      summaries.map((summary) => summary.criticalRecallThreshold),
    ),
    falsePositiveReviewThreshold: maxOptionalNumber(
      summaries.map((summary) => summary.falsePositiveReviewThreshold),
    ),
    requiredLayers: Array.from(
      new Set(
        summaries.flatMap((summary) =>
          Array.isArray(summary.requiredLayers)
            ? summary.requiredLayers.filter(
                (entry): entry is string =>
                  typeof entry === "string" && entry.trim().length > 0,
              )
            : [],
        ),
      ),
    ),
  };
}

function asAssertionObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function maxOptionalNumber(values: unknown[]): number | undefined {
  const numbers = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  return numbers.length > 0 ? Math.max(...numbers) : undefined;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function describeReleaseFreezeStatus(version: HarnessDatasetVersionViewModel) {
  if (version.status !== "published") {
    return null;
  }

  if (version.rubricAssignment.status !== "published") {
    return {
      label: "发布冻结未就绪",
      copy: "发布冻结未就绪：缺少已发布的评分规则。",
    };
  }

  if (!version.deidentificationGatePassed) {
    return {
      label: "发布冻结未就绪",
      copy: "发布冻结未就绪：脱敏校验尚未完成。",
    };
  }

  if (!version.humanReviewGatePassed) {
    return {
      label: "发布冻结未就绪",
      copy: "发布冻结未就绪：人工复核尚未完成。",
    };
  }

  return {
    label: "发布冻结已就绪",
    copy: "发布冻结已就绪，可用于清单记录与导出引用。",
  };
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

function formatVersionStatusLabel(value: string) {
  switch (value) {
    case "draft":
      return "草稿";
    case "published":
      return "已发布";
    case "archived":
      return "已归档";
    default:
      return value;
  }
}

function formatPublicationStatusLabel(value: string) {
  switch (value) {
    case "succeeded":
      return "成功";
    case "failed":
      return "失败";
    default:
      return value;
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
    case "meta_analysis":
      return "Meta 分析";
    case "guideline_interpretation":
      return "指南解读";
    default:
      return value;
  }
}

function formatMeasureFocusLabel(value: string) {
  switch (value) {
    case "issue detection":
      return "问题识别";
    case "conformance":
      return "规范一致性";
    case "triage":
      return "分诊判断";
    case "deidentification":
      return "脱敏校验";
    case "human review":
      return "人工复核";
    default:
      return value;
  }
}

function formatSourceKindLabel(value: string) {
  switch (value) {
    case "reviewed_case_snapshot":
      return "已复核案例快照";
    case "human_final_asset":
      return "人工终稿资产";
    case "evaluation_evidence_pack":
      return "评测证据包";
    default:
      return value;
  }
}

function formatRiskTagLabel(value: string) {
  switch (value) {
    case "terminology":
      return "术语";
    default:
      return value;
  }
}

function readRequiredFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`请填写 ${key}。`);
  }

  return value.trim();
}

function toErrorMessage(error: unknown) {
  if (error instanceof BrowserHttpClientError) {
    const body =
      typeof error.responseBody === "string"
        ? error.responseBody
        : JSON.stringify(error.responseBody);
    return `Harness 数据操作失败：HTTP ${error.status} ${body}`;
  }

  return error instanceof Error && error.message.trim()
    ? error.message
    : "Harness 数据页发生未知错误。";
}

