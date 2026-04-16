import {
  formatWorkbenchHash,
  resolveWorkbenchLocation,
} from "../../app/workbench-routing.ts";
import type { AuthRole } from "../auth/index.ts";

if (typeof document !== "undefined") {
  void import("./learning-review-workbench.css");
}

export interface LearningReviewWorkbenchPageProps {
  actorRole?: AuthRole;
  prefilledManuscriptId?: string;
}

export interface LearningReviewCompatibilityHandoffContext {
  manuscriptId?: string | null;
  reviewedCaseSnapshotId?: string | null;
}

export function LearningReviewWorkbenchPage({
  actorRole = "knowledge_reviewer",
  prefilledManuscriptId,
}: LearningReviewWorkbenchPageProps) {
  const handoffContext = resolveLearningReviewCompatibilityContext(prefilledManuscriptId);
  const handoffHash = createLearningReviewCompatibilityHandoffHash(handoffContext);

  return (
    <section className="learning-review-compat" data-mode="learning-review-compat">
      <article className="learning-review-compat-card">
        <p className="learning-review-eyebrow">兼容跳转</p>
        <h1>质量优化入口已迁移</h1>
        <p className="learning-review-compat-copy">
          质量优化现在位于规则中心的回流工作区。旧的 `learning-review` 页面仅保留为兼容落点，用于承接旧链接并把你带到新的默认入口。
        </p>

        <div className="learning-review-compat-summary">
          <span className="learning-review-compat-chip">
            当前角色：{formatActorRoleLabel(actorRole)}
          </span>
          {handoffContext.manuscriptId ? (
            <span className="learning-review-compat-chip">
              稿件：{handoffContext.manuscriptId}
            </span>
          ) : null}
          {handoffContext.reviewedCaseSnapshotId ? (
            <span className="learning-review-compat-chip">
              快照：{handoffContext.reviewedCaseSnapshotId}
            </span>
          ) : null}
        </div>

        <div className="learning-review-compat-actions">
          <a className="learning-review-link-button" href={handoffHash}>
            打开规则中心回流工作区
          </a>
        </div>

        <p className="learning-review-compat-note">
          后续的回流候选批准、驳回和转成规则草稿，都在规则中心内完成。
        </p>
      </article>
    </section>
  );
}

export function createLearningReviewCompatibilityHandoffHash(
  input: LearningReviewCompatibilityHandoffContext = {},
): string {
  const manuscriptId = normalizeContextValue(input.manuscriptId);
  const reviewedCaseSnapshotId = normalizeContextValue(input.reviewedCaseSnapshotId);

  return formatWorkbenchHash("template-governance", {
    templateGovernanceView: "rule-ledger",
    ruleCenterMode: "learning",
    manuscriptId,
    reviewedCaseSnapshotId,
  });
}

function resolveLearningReviewCompatibilityContext(
  prefilledManuscriptId?: string,
): LearningReviewCompatibilityHandoffContext {
  const manuscriptIdFromProps = normalizeContextValue(prefilledManuscriptId);
  if (typeof window === "undefined") {
    return {
      ...(manuscriptIdFromProps ? { manuscriptId: manuscriptIdFromProps } : {}),
    };
  }

  const routeState = resolveWorkbenchLocation(window.location.hash);
  return {
    manuscriptId:
      manuscriptIdFromProps ?? normalizeContextValue(routeState.manuscriptId) ?? undefined,
    reviewedCaseSnapshotId:
      normalizeContextValue(routeState.reviewedCaseSnapshotId) ?? undefined,
  };
}

function normalizeContextValue(value: string | null | undefined): string | undefined {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : undefined;
}

function formatActorRoleLabel(role: AuthRole): string {
  switch (role) {
    case "admin":
      return "管理员";
    case "screener":
      return "初筛员";
    case "editor":
      return "编辑";
    case "proofreader":
      return "校对员";
    case "knowledge_reviewer":
      return "知识审核员";
    case "user":
    default:
      return "普通用户";
  }
}
