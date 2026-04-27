import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { JobViewModel } from "../manuscripts/index.ts";
import type { ModuleJobViewModel } from "../screening/index.ts";
import type {
  ManuscriptWorkbenchMode,
  ManuscriptWorkbenchWorkspace,
} from "./manuscript-workbench-controller.ts";

type AnyWorkbenchJob = JobViewModel | ModuleJobViewModel;
type MainlineMode = Exclude<ManuscriptWorkbenchMode, "submission">;
type CurrentCardStatus = "queued" | "running" | "completed" | "failed" | "not_started";

export interface ManuscriptWorkbenchCurrentCardProps {
  mode: MainlineMode;
  workspace: ManuscriptWorkbenchWorkspace | null;
  latestJob: AnyWorkbenchJob | null;
  metaSummary: string;
}

export function ManuscriptWorkbenchCurrentCard({
  mode,
  workspace,
  latestJob,
  metaSummary,
}: ManuscriptWorkbenchCurrentCardProps) {
  const status = resolveCurrentCardStatus(mode, workspace, latestJob);
  const statusLabel = resolveCurrentCardStatusLabel(status);
  const progressValue = resolveCurrentCardProgressValue(status);

  return (
    <Card className="manuscript-workbench-current-card">
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <CardDescription>当前稿件</CardDescription>
            <CardTitle className="line-clamp-2 text-sm">
              {workspace?.manuscript.title ?? "未打开稿件"}
            </CardTitle>
          </div>
          <Badge variant={resolveCurrentCardBadgeVariant(status)}>{statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 p-3 pt-0">
        <div className="grid gap-1">
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-[#8b7341]">
            <span>{resolveCurrentCardProgressLabel(status)}</span>
            <span>{progressValue}%</span>
          </div>
          <Progress
            value={progressValue}
            className={status === "running" ? "manuscript-workbench-progress-running" : undefined}
          />
        </div>
        <p className="m-0 text-xs leading-5 text-[#625648]">{metaSummary}</p>
      </CardContent>
    </Card>
  );
}

function resolveCurrentCardStatus(
  mode: MainlineMode,
  workspace: ManuscriptWorkbenchWorkspace | null,
  latestJob: AnyWorkbenchJob | null,
): CurrentCardStatus {
  const status =
    latestJob?.module === mode
      ? latestJob.status
      : workspace?.manuscript.module_execution_overview?.[mode]?.latest_job?.status;

  if (status === "queued") return "queued";
  if (status === "running") return "running";
  if (status === "completed") return "completed";
  if (status === "failed" || status === "cancelled") return "failed";
  return "not_started";
}

function resolveCurrentCardStatusLabel(status: CurrentCardStatus): string {
  if (status === "queued") return "排队中";
  if (status === "running") return "处理中";
  if (status === "completed") return "已完成";
  if (status === "failed") return "需处理";
  return "未开始";
}

function resolveCurrentCardBadgeVariant(
  status: CurrentCardStatus,
): "default" | "success" | "warning" | "danger" {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "running" || status === "queued") return "warning";
  return "default";
}

function resolveCurrentCardProgressValue(status: CurrentCardStatus): number {
  if (status === "completed") return 100;
  if (status === "running") return 62;
  if (status === "queued") return 28;
  if (status === "failed") return 100;
  return 8;
}

function resolveCurrentCardProgressLabel(status: CurrentCardStatus): string {
  if (status === "completed") return "模块进度";
  if (status === "running") return "实时处理中";
  if (status === "queued") return "等待执行";
  if (status === "failed") return "需要处理";
  return "准备状态";
}
