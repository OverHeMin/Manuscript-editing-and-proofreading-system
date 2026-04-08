export type WorkbenchCoreStripPillarId =
  | "screening"
  | "editing"
  | "proofreading"
  | "knowledge";

export type WorkbenchCoreStripVariant = "primary" | "supporting" | "secondary";

export interface WorkbenchCoreStripProps {
  activePillarId?: WorkbenchCoreStripPillarId | null;
  variant?: WorkbenchCoreStripVariant;
  heading?: string;
  description?: string;
}

const coreStripPillars: ReadonlyArray<{
  id: WorkbenchCoreStripPillarId;
  label: string;
  summary: string;
}> = [
  {
    id: "screening",
    label: "初筛",
    summary: "接稿质控",
  },
  {
    id: "editing",
    label: "编辑",
    summary: "正文修订",
  },
  {
    id: "proofreading",
    label: "校对",
    summary: "终稿收口",
  },
  {
    id: "knowledge",
    label: "知识库",
    summary: "证据沉淀",
  },
];

export function WorkbenchCoreStrip({
  activePillarId = null,
  variant = "primary",
  heading,
  description,
}: WorkbenchCoreStripProps) {
  const resolvedHeading = heading ?? resolveDefaultHeading(variant);
  const resolvedDescription = description ?? resolveDefaultDescription(variant);
  const variantClassName =
    variant === "supporting"
      ? " is-supporting"
      : variant === "secondary"
        ? " is-secondary"
        : "";

  return (
    <section
      className={`workbench-core-strip${variantClassName}`}
      aria-label={resolvedHeading}
    >
      <div className="workbench-core-strip-heading">
        <span className="workbench-core-strip-eyebrow">{resolvedHeading}</span>
        <p>{resolvedDescription}</p>
      </div>
      <div className="workbench-core-strip-grid">
        {coreStripPillars.map((pillar) => {
          const isActive = pillar.id === activePillarId;

          return (
            <article
              key={pillar.id}
              className={`workbench-core-strip-card${isActive ? " is-active" : ""}`}
            >
              <span className="workbench-core-strip-card-kicker">
                {resolveCardKicker(variant, isActive)}
              </span>
              <strong>{pillar.label}</strong>
              <small>{pillar.summary}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function resolveDefaultHeading(variant: WorkbenchCoreStripVariant): string {
  if (variant === "supporting") {
    return "协同与回写";
  }

  if (variant === "secondary") {
    return "管理区";
  }

  return "核心四大工作台";
}

function resolveDefaultDescription(variant: WorkbenchCoreStripVariant): string {
  if (variant === "supporting") {
    return "让复核、批准与知识回写保持在同一条辅助链路中，但不遮住四个核心工作台。";
  }

  if (variant === "secondary") {
    return "让治理、配置与只读观察停留在辅助控制面，不抢核心工作台注意力。";
  }

  return "突出初筛、编辑、校对与知识库，让当前焦点和上下游关系一眼可见。";
}

function resolveCardKicker(
  variant: WorkbenchCoreStripVariant,
  isActive: boolean,
): string {
  if (isActive) {
    if (variant === "supporting") {
      return "回写落点";
    }

    if (variant === "secondary") {
      return "治理关联";
    }

    return "当前焦点";
  }

  if (variant === "supporting") {
    return "关联核心工作台";
  }

  if (variant === "secondary") {
    return "辅助控制项";
  }

  return "核心栏目";
}
