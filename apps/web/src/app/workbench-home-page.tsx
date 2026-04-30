import type {
  AuthRole,
  WorkbenchEntry,
  WorkbenchShellTargetDescriptor,
} from "../features/auth/index.ts";
import { type WorkbenchNavigationTarget } from "./workbench-navigation.ts";
import { formatWorkbenchHash } from "./workbench-routing.ts";

export interface WorkbenchHomePageProps {
  entries: readonly WorkbenchEntry[];
  role: AuthRole;
  onNavigate(target: WorkbenchNavigationTarget): void;
}

export function WorkbenchHomePage({
  entries,
  role,
  onNavigate,
}: WorkbenchHomePageProps) {
  const cards = buildWorkbenchHomeCards(entries, role);

  return (
    <section
      className="workbench-home-page"
      data-card-count={cards.length}
      aria-label="工作台入口"
    >
      <div className="workbench-home-grid">
        {cards.map((card) => (
          <a
            key={card.key}
            className="workbench-home-card"
            href={card.href}
            data-tone={card.tone}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(card.target);
            }}
          >
            <span className="workbench-home-visual" aria-hidden="true">
              {card.symbol}
            </span>
            <span className="workbench-home-title">{card.label}</span>
            <span className="workbench-home-copy">{card.description}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

interface WorkbenchHomeCard {
  key: string;
  label: string;
  description: string;
  symbol: string;
  tone: string;
  href: string;
  target: WorkbenchNavigationTarget;
}

type WorkbenchHomeTarget = Pick<
  WorkbenchShellTargetDescriptor,
  | "key"
  | "workbenchId"
  | "label"
  | "settingsSection"
  | "harnessSection"
  | "harnessMode"
>;

function buildWorkbenchHomeCards(
  entries: readonly WorkbenchEntry[],
  role: AuthRole,
): WorkbenchHomeCard[] {
  const entryIds = new Set(entries.map((entry) => entry.id));

  return HOME_CARD_TARGETS.flatMap((target) => {
    if (!entryIds.has(target.workbenchId)) {
      return [];
    }

    if (target.workbenchId === "manuscript-harness" && role !== "admin") {
      return [];
    }

    return [{
      key: target.key,
      label: target.label,
      description: resolveWorkbenchHomeCardDescription(target),
      symbol: resolveWorkbenchHomeCardSymbol(target),
      tone: resolveWorkbenchHomeCardTone(target),
      href: formatWorkbenchHash(target.workbenchId, {
        settingsSection: target.settingsSection,
        harnessSection: target.harnessSection,
        harnessMode: target.harnessMode,
      }),
      target: {
        workbenchId: target.workbenchId,
        settingsSection: target.settingsSection,
        harnessSection: target.harnessSection,
        harnessMode: target.harnessMode,
      },
    }];
  });
}

const HOME_CARD_TARGETS: readonly WorkbenchHomeTarget[] = [
  {
    key: "core-screening",
    workbenchId: "screening",
    label: "初筛",
  },
  {
    key: "core-editing",
    workbenchId: "editing",
    label: "编辑",
  },
  {
    key: "core-proofreading",
    workbenchId: "proofreading",
    label: "校对",
  },
  {
    key: "core-knowledge-library",
    workbenchId: "knowledge-library",
    label: "知识库",
  },
  {
    key: "support-knowledge-review",
    workbenchId: "knowledge-review",
    label: "知识审核",
  },
  {
    key: "support-rule-center",
    workbenchId: "template-governance",
    label: "规则中心",
  },
  {
    key: "management-ai-access",
    workbenchId: "system-settings",
    label: "AI 接入",
    settingsSection: "ai-access",
  },
  {
    key: "management-harness",
    workbenchId: "evaluation-workbench",
    label: "Harness 控制",
    harnessMode: "ab_acceptance",
  },
  {
    key: "management-manuscript-harness",
    workbenchId: "manuscript-harness",
    label: "稿件 Harness",
  },
  {
    key: "management-accounts",
    workbenchId: "system-settings",
    label: "账号与权限",
    settingsSection: "accounts",
  },
  {
    key: "home-submission",
    workbenchId: "submission",
    label: "我的稿件",
  },
];

function resolveWorkbenchHomeCardDescription(
  item: (typeof HOME_CARD_TARGETS)[number],
): string {
  switch (item.key) {
    case "core-screening":
      return "接入稿件，完成来稿风险和完整度初筛。";
    case "core-editing":
      return "按模板修订正文，整理可交接编辑稿。";
    case "core-proofreading":
      return "进入深度校对，生成可核对终稿。";
    case "core-knowledge-library":
      return "沉淀医学知识、术语和可复用依据。";
    case "support-knowledge-review":
      return "审核知识修订，让候选内容进入正式库。";
    case "support-rule-center":
      return "维护模板、规则包和回流候选。";
    case "management-ai-access":
      return "配置模型供应商、路由和执行默认值。";
    case "management-harness":
      return "查看回归、验收和样本验证工作流。";
    case "management-manuscript-harness":
      return "按单篇稿件追踪验证和回归证据。";
    case "management-accounts":
      return "管理账号、角色和访问范围。";
    case "home-submission":
      return "上传稿件并查看个人处理进度。";
    default:
      return "进入对应工作页面。";
  }
}

function resolveWorkbenchHomeCardSymbol(
  item: (typeof HOME_CARD_TARGETS)[number],
): string {
  switch (item.key) {
    case "core-screening":
      return "筛";
    case "core-editing":
      return "编";
    case "core-proofreading":
      return "校";
    case "core-knowledge-library":
      return "知";
    case "support-knowledge-review":
      return "审";
    case "support-rule-center":
      return "规";
    case "management-ai-access":
      return "AI";
    case "management-harness":
      return "H";
    case "management-manuscript-harness":
      return "验";
    case "management-accounts":
      return "权";
    case "home-submission":
      return "稿";
    default:
      return "入";
  }
}

function resolveWorkbenchHomeCardTone(
  item: (typeof HOME_CARD_TARGETS)[number],
): string {
  if (item.key.startsWith("core-")) {
    return "core";
  }

  if (item.key.startsWith("management-")) {
    return "management";
  }

  return "supporting";
}
