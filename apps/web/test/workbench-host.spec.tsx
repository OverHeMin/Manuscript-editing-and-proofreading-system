import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildAuthSessionViewModel,
  type AuthRole,
} from "../src/features/auth/index.ts";

function buildSession(role: AuthRole) {
  return buildAuthSessionViewModel({
    userId: `${role}-1`,
    username: `${role}.user`,
    displayName: `${role} display`,
    role,
  });
}

function countOccurrences(text: string, needle: string): number {
  if (needle.length === 0) {
    return 0;
  }

  let count = 0;
  let index = 0;
  while (true) {
    const nextIndex = text.indexOf(needle, index);
    if (nextIndex === -1) {
      return count;
    }

    count += 1;
    index = nextIndex + needle.length;
  }
}

function extractGovernanceNavSection(markup: string): string {
  const marker = "workbench-nav-group--governance";
  const start = markup.indexOf(marker);
  assert.notEqual(start, -1, "expected governance nav group to be rendered");

  const nextGroup = markup.indexOf("workbench-nav-group--", start + marker.length);
  return nextGroup === -1 ? markup.slice(start) : markup.slice(start, nextGroup);
}

async function renderWorkbenchHostAtHash(hash: string): Promise<string> {
  const previousWindow = globalThis.window;
  globalThis.window = {
    location: { hash } as Location,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    matchMedia: () =>
      ({
        matches: false,
        media: "(max-width: 1024px)",
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as MediaQueryList,
  } as unknown as Window & typeof globalThis;

  try {
    const hostModule = await import("../src/app/workbench-host.tsx");
    return renderToStaticMarkup(
      <hostModule.WorkbenchHost session={buildSession("admin")} />,
    );
  } finally {
    if (typeof previousWindow === "undefined") {
      // `window` is undefined in this test runtime by default.
      delete (globalThis as { window?: Window }).window;
    } else {
      globalThis.window = previousWindow;
    }
  }
}

test("admin defaults to screening workbench", () => {
  const session = buildSession("admin");

  assert.equal(session.defaultWorkbench, "screening");
});

test("workbench host runtime render forwards settingsSection=ai-access into active shell state", async () => {
  const markup = await renderWorkbenchHostAtHash(
    "#system-settings?settingsSection=ai-access",
  );

  assert.match(markup, /system-settings-workbench/u);
  assert.match(markup, /\u0041\u0049 \u63a5\u5165/u);
  assert.match(
    markup,
    /workbench-nav-button is-active[\s\S]*?\u0041\u0049 \u63a5\u5165/u,
  );
});

test("workbench host runtime render shows split settings target label in header focus card", async () => {
  const markup = await renderWorkbenchHostAtHash(
    "#system-settings?settingsSection=accounts",
  );

  assert.match(
    markup,
    /workbench-header-focus-card[\s\S]*?<strong>\u8d26\u53f7\u4e0e\u6743\u9650<\/strong>/u,
  );
  assert.match(
    markup,
    /workbench-nav-button is-active[\s\S]*?\u8d26\u53f7\u4e0e\u6743\u9650/u,
  );
  assert.match(markup, /system-settings-workbench[\s\S]*?<h2>\u8d26\u53f7\u4e0e\u6743\u9650<\/h2>/u);
});

test("workbench host runtime render forwards harnessSection=runs into evaluation first-view focus", async () => {
  const markup = await renderWorkbenchHostAtHash(
    "#evaluation-workbench?harnessSection=runs",
  );

  assert.match(markup, /evaluation-workbench/u);
  assert.match(markup, /Harness/u);
  assert.match(markup, /workbench-nav-button is-active[\s\S]*?Harness/u);
});

test("workbench host runtime render keeps datasets alias on datasets surface while governance nav stays at four entries", async () => {
  const markup = await renderWorkbenchHostAtHash(
    "#evaluation-workbench?harnessSection=datasets",
  );

  const governanceSection = extractGovernanceNavSection(markup);

  assert.match(markup, /Harness 控制 \/ 数据与样本/u);
  assert.match(governanceSection, /workbench-nav-button is-active[\s\S]*?Harness/u);
  assert.equal(
    countOccurrences(governanceSection, "workbench-nav-button-label"),
    4,
  );
});

test("workbench host runtime render keeps direct harness-datasets focus card label", async () => {
  const markup = await renderWorkbenchHostAtHash("#harness-datasets");

  assert.match(markup, /Harness 数据集/u);
  assert.match(
    markup,
    /workbench-header-focus-card[\s\S]*?<strong>Harness \u6570\u636e\u96c6<\/strong>/u,
  );
});

test("knowledge reviewer defaults to knowledge library", () => {
  const session = buildSession("knowledge_reviewer");

  assert.equal(session.defaultWorkbench, "knowledge-library");
});

test("workbench host runtime render routes knowledge ledger hashes to the ledger page shell", async () => {
  const markup = await renderWorkbenchHostAtHash(
    "#knowledge-library?knowledgeView=ledger&assetId=knowledge-42&revisionId=knowledge-42-revision-2",
  );

  assert.match(markup, /knowledge-library-ledger-page/u);
  assert.match(markup, /knowledge-library-ledger-grid/u);
  assert.match(markup, /knowledge-library-ledger-toolbar/u);
  assert.doesNotMatch(markup, /knowledge-library-record-drawer/u);
  assert.match(markup, /workbench-header/u);
  assert.match(markup, /workbench-nav/u);
});

test("workbench host defaults bare knowledge library hashes to the main page", async () => {
  const markup = await renderWorkbenchHostAtHash(
    "#knowledge-library?assetId=knowledge-42&revisionId=knowledge-42-revision-2",
  );

  assert.match(markup, /knowledge-library-workbench-page/u);
  assert.match(markup, /workbench-header/u);
  assert.match(markup, /workbench-nav/u);
});

test("workbench host runtime render routes rule center overview hashes to the overview page", async () => {
  const markup = await renderWorkbenchHostAtHash(
    "#template-governance?templateGovernanceView=overview",
  );

  assert.match(markup, /template-governance-overview-page/u);
  assert.match(markup, /待确认提取候选/u);
  assert.doesNotMatch(markup, /rule-package-workbench-columns/u);
});

test("workbench host defaults bare rule center hashes to the overview page", async () => {
  const markup = await renderWorkbenchHostAtHash("#template-governance");

  assert.match(markup, /template-governance-overview-page/u);
  assert.match(markup, /template-governance-overview-entries/u);
  assert.doesNotMatch(markup, /rule-package-workbench-columns/u);
});

test("workbench host runtime render routes rule center extraction hashes to the extraction ledger entry surface", async () => {
  const markup = await renderWorkbenchHostAtHash(
    "#template-governance?templateGovernanceView=extraction-ledger",
  );

  assert.match(markup, /template-governance-extraction-ledger-page/u);
  assert.match(markup, /新建提取任务/u);
  assert.doesNotMatch(markup, /rule-package-workbench-columns/u);
});

test("workbench host runtime render routes rule center overview hashes to the overview page", async () => {
  const markup = await renderWorkbenchHostAtHash(
    "#template-governance?templateGovernanceView=overview",
  );

  assert.match(markup, /template-governance-overview-page/u);
  assert.match(markup, /待确认提取候选/u);
  assert.doesNotMatch(markup, /rule-package-workbench-columns/u);
});

test("workbench host runtime render routes rule center extraction hashes to the extraction ledger entry surface", async () => {
  const markup = await renderWorkbenchHostAtHash(
    "#template-governance?templateGovernanceView=extraction-ledger",
  );

  assert.match(markup, /template-governance-extraction-ledger-page/u);
  assert.match(markup, /新建提取任务/u);
  assert.doesNotMatch(markup, /rule-package-workbench-columns/u);
});

test("admin navigation model aligns to the final IA groups and management target labels", async () => {
  const navigationModule = await import("../src/app/workbench-navigation.ts").catch(
    () => null,
  );

  assert.ok(navigationModule, "expected workbench-navigation module to exist");

  const groups = navigationModule.buildWorkbenchNavigationGroups(
    buildSession("admin").availableWorkbenchEntries,
  );

  assert.deepEqual(
    groups.map((group: { id: string }) => group.id),
    ["core-workbench", "supporting-workbench", "governance"],
  );
  assert.deepEqual(
    groups.map((group: { label: string }) => group.label),
    ["核心流程", "协作与回收区", "管理区"],
  );
  assert.deepEqual(
    groups.map((group: { prominence: string }) => group.prominence),
    ["primary", "supporting", "secondary"],
  );
  assert.deepEqual(
    groups[0]?.items.map((item: { id: string }) => item.id),
    ["screening", "editing", "proofreading", "knowledge-library"],
  );
  assert.deepEqual(
    groups[1]?.items.map((item: { id: string }) => item.id),
    ["knowledge-review", "learning-review", "template-governance"],
  );
  assert.deepEqual(
    groups[2]?.items.map((item: { label: string }) => item.label),
    [
      "管理总览",
      "AI 接入",
      "账号与权限",
      "Harness 控制",
    ],
  );
  assert.equal(
    groups[1]?.items.find((item: { id: string; label: string }) => item.id === "template-governance")
      ?.label,
    "规则中心",
  );
});

test("general user navigation model hides management navigation", async () => {
  const navigationModule = await import("../src/app/workbench-navigation.ts").catch(
    () => null,
  );

  assert.ok(navigationModule, "expected workbench-navigation module to exist");

  const groups = navigationModule.buildWorkbenchNavigationGroups(
    buildSession("user").availableWorkbenchEntries,
  );

  assert.deepEqual(
    groups.map((group: { id: string }) => group.id),
    ["general"],
  );
  assert.equal(groups.some((group: { label: string }) => group.label === "管理区"), false);
  assert.deepEqual(
    groups[0]?.items.map((item: { id: string }) => item.id),
    ["submission"],
  );
});

test("operator navigation keeps each public-beta desk on its own mainline surface", async () => {
  const navigationModule = await import("../src/app/workbench-navigation.ts").catch(
    () => null,
  );

  assert.ok(navigationModule, "expected workbench-navigation module to exist");

  const screenerGroups = navigationModule.buildWorkbenchNavigationGroups(
    buildSession("screener").availableWorkbenchEntries,
  );
  const editorGroups = navigationModule.buildWorkbenchNavigationGroups(
    buildSession("editor").availableWorkbenchEntries,
  );
  const proofreaderGroups = navigationModule.buildWorkbenchNavigationGroups(
    buildSession("proofreader").availableWorkbenchEntries,
  );

  assert.deepEqual(
    screenerGroups.map((group: { id: string }) => group.id),
    ["core-workbench"],
  );
  assert.deepEqual(
    screenerGroups[0]?.items.map((item: { id: string }) => item.id),
    ["screening"],
  );
  assert.deepEqual(
    editorGroups.map((group: { id: string }) => group.id),
    ["core-workbench"],
  );
  assert.deepEqual(
    editorGroups[0]?.items.map((item: { id: string }) => item.id),
    ["editing"],
  );
  assert.deepEqual(
    proofreaderGroups.map((group: { id: string }) => group.id),
    ["core-workbench"],
  );
  assert.deepEqual(
    proofreaderGroups[0]?.items.map((item: { id: string }) => item.id),
    ["proofreading"],
  );
});

test("knowledge reviewer navigation excludes manuscript desks and governance entries", async () => {
  const navigationModule = await import("../src/app/workbench-navigation.ts").catch(
    () => null,
  );

  assert.ok(navigationModule, "expected workbench-navigation module to exist");

  const groups = navigationModule.buildWorkbenchNavigationGroups(
    buildSession("knowledge_reviewer").availableWorkbenchEntries,
  );

  assert.deepEqual(
    groups.map((group: { id: string }) => group.id),
    ["core-workbench", "supporting-workbench"],
  );
  assert.deepEqual(
    groups[0]?.items.map((item: { id: string }) => item.id),
    ["knowledge-library"],
  );
  assert.deepEqual(
    groups[1]?.items.map((item: { id: string }) => item.id),
    ["knowledge-review", "learning-review"],
  );
  assert.equal(
    groups.some((group: { id: string }) => group.id === "governance"),
    false,
  );
});

test("navigation menu renders grouped admin navigation with final IA labels and management entries", async () => {
  const navigationModule = await import("../src/app/workbench-navigation.ts");
  const menuModule = await import("../src/app/workbench-navigation-menu.tsx").catch(
    () => null,
  );

  assert.ok(menuModule, "expected workbench-navigation-menu module to exist");

  const groups = navigationModule.buildWorkbenchNavigationGroups(
    buildSession("admin").availableWorkbenchEntries,
  );

  const html = renderToStaticMarkup(
    <menuModule.WorkbenchNavigationMenu
      groups={groups}
      activeTargetKey={navigationModule.getWorkbenchNavigationTargetKey({
        workbenchId: "template-governance",
      })}
      onNavigate={() => undefined}
    />,
  );

  assert.match(html, /核心流程/u);
  assert.match(html, /协作与回收区/u);
  assert.match(html, /管理区/u);
  assert.match(html, /规则中心/u);
  assert.match(html, /质量优化/u);
  assert.match(html, /管理总览/u);
  assert.match(html, /AI 接入/u);
  assert.match(html, /账号与权限/u);
  assert.match(html, /Harness 控制/u);
  assert.match(html, /4 \u9879/u);
  assert.match(html, /3 \u9879/u);
  assert.match(html, /\u77e5\u8bc6\u5e93/u);
  assert.match(html, /\u77e5\u8bc6\u5ba1\u6838/u);
  assert.match(html, /is-active/);
});

test("workbench routing formats and resolves knowledge library and revision review hashes", async () => {
  const routingModule = await import("../src/app/workbench-routing.ts");

  const knowledgeLibraryHash = routingModule.formatWorkbenchHash("knowledge-library", {
    assetId: "knowledge-42",
    revisionId: "knowledge-42-revision-3",
  });
  const knowledgeReviewHash = routingModule.formatWorkbenchHash("knowledge-review", {
    revisionId: "knowledge-42-revision-3",
  });

  assert.equal(
    knowledgeLibraryHash,
    "#knowledge-library?assetId=knowledge-42&revisionId=knowledge-42-revision-3",
  );
  assert.deepEqual(routingModule.resolveWorkbenchLocation(knowledgeLibraryHash), {
    workbenchId: "knowledge-library",
    assetId: "knowledge-42",
    revisionId: "knowledge-42-revision-3",
  });
  assert.equal(
    knowledgeReviewHash,
    "#knowledge-review?revisionId=knowledge-42-revision-3",
  );
  assert.deepEqual(routingModule.resolveWorkbenchLocation(knowledgeReviewHash), {
    workbenchId: "knowledge-review",
    revisionId: "knowledge-42-revision-3",
  });
});

test("workbench routing supports harness datasets section hashes while keeping management nav at four items", async () => {
  const navigationModule = await import("../src/app/workbench-navigation.ts");
  const routingModule = await import("../src/app/workbench-routing.ts");
  const groups = navigationModule.buildWorkbenchNavigationGroups(
    buildSession("admin").availableWorkbenchEntries,
  );
  const datasetsHash = routingModule.formatWorkbenchHash("evaluation-workbench", {
    harnessSection: "datasets",
  });

  assert.equal(groups[2]?.label, "管理区");
  assert.equal(groups[2]?.items.length, 4);
  assert.equal(
    groups[2]?.items.find((item: { label: string }) => item.label === "Harness 控制")?.id,
    "evaluation-workbench",
  );
  assert.equal(
    groups[2]?.items.some((item: { id: string }) => item.id === "harness-datasets"),
    false,
  );
  assert.equal(
    datasetsHash,
    "#evaluation-workbench?harnessSection=datasets",
  );
  assert.deepEqual(routingModule.resolveWorkbenchLocation(datasetsHash), {
    workbenchId: "evaluation-workbench",
    harnessSection: "datasets",
  });
});

test("navigation menu renders a simplified user work area", async () => {
  const navigationModule = await import("../src/app/workbench-navigation.ts");
  const menuModule = await import("../src/app/workbench-navigation-menu.tsx").catch(
    () => null,
  );

  assert.ok(menuModule, "expected workbench-navigation-menu module to exist");

  const html = renderToStaticMarkup(
    <menuModule.WorkbenchNavigationMenu
      groups={navigationModule.buildWorkbenchNavigationGroups(
        buildSession("user").availableWorkbenchEntries,
      )}
      activeTargetKey={navigationModule.getWorkbenchNavigationTargetKey({
        workbenchId: "submission",
      })}
      onNavigate={() => undefined}
    />,
  );

  assert.match(html, /\u9996\u9875/u);
  assert.match(html, /\u6211\u7684\u7a3f\u4ef6/u);
  assert.doesNotMatch(html, /管理区/u);
});

test("admin navigation keeps route ids stable while exposing final IA labels", async () => {
  const navigationModule = await import("../src/app/workbench-navigation.ts").catch(
    () => null,
  );

  assert.ok(navigationModule, "expected workbench-navigation module to exist");

  const groups = navigationModule.buildWorkbenchNavigationGroups(
    buildSession("admin").availableWorkbenchEntries,
  );
  const overviewEntry = groups[2]?.items.find((item: { id: string }) => item.id === "admin-console");
  const aiAccessEntry = groups[2]?.items.find((item: { label: string }) => item.label === "AI 接入");
  const accountEntry = groups[2]?.items.find((item: { label: string }) => item.label === "账号与权限");
  const harnessEntry = groups[2]?.items.find((item: { id: string }) => item.id === "evaluation-workbench");

  assert.equal(overviewEntry?.id, "admin-console");
  assert.equal(overviewEntry?.label, "管理总览");
  assert.equal(aiAccessEntry?.id, "system-settings");
  assert.equal(accountEntry?.id, "system-settings");
  assert.equal(harnessEntry?.label, "Harness 控制");
});

test("workbench shell header renders fully Chinese top copy and active desk summary", async () => {
  const headerModule = await import("../src/app/workbench-shell-header.tsx").catch(
    () => null,
  );

  assert.ok(headerModule, "expected workbench-shell-header module to exist");

  const html = renderToStaticMarkup(
    <headerModule.WorkbenchShellHeader
      session={buildSession("admin")}
      activeWorkbenchLabel="\u7f16\u8f91"
      activeWorkbenchDescription="聚焦编辑任务总览"
      activeWorkbenchGroupLabel="\u6838\u5fc3\u6d41\u7a0b"
      isCompactNavigation={false}
      isNavigationOpen
      onToggleNavigation={() => undefined}
      onLogout={() => undefined}
    />,
  );

  assert.doesNotMatch(html, /Medical Editorial Control Deck/);
  assert.match(html, /医学编辑中控台/u);
  assert.match(html, /医学稿件处理系统/u);
  assert.match(html, /workbench-shell-pillar-list/);
  assert.match(html, /button/);
});

test("workbench shell header exposes a compact navigation toggle state", async () => {
  const headerModule = await import("../src/app/workbench-shell-header.tsx").catch(
    () => null,
  );

  assert.ok(headerModule, "expected workbench-shell-header module to exist");

  const html = renderToStaticMarkup(
    <headerModule.WorkbenchShellHeader
      session={buildSession("editor")}
      activeWorkbenchLabel="\u7f16\u8f91"
      activeWorkbenchDescription="聚焦编辑任务总览"
      activeWorkbenchGroupLabel="\u6838\u5fc3\u6d41\u7a0b"
      isCompactNavigation
      isNavigationOpen={false}
      onToggleNavigation={() => undefined}
    />,
  );

  assert.match(html, /aria-expanded="false"/);
});

test("responsive navigation defaults to collapsed when entering compact mode", async () => {
  const layoutModule = await import("../src/app/workbench-shell-layout.ts").catch(
    () => null,
  );

  assert.ok(layoutModule, "expected workbench-shell-layout module to exist");

  assert.equal(
    layoutModule.resolveResponsiveNavigationOpenState({
      isCompactNavigation: true,
      previousCompactNavigation: false,
      previousNavigationOpen: true,
    }),
    false,
  );
});
