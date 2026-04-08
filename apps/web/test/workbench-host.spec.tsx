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

test("admin defaults to screening workbench", () => {
  const session = buildSession("admin");

  assert.equal(session.defaultWorkbench, "screening");
});

test("admin navigation model highlights the four core desks and separates support surfaces", async () => {
  const navigationModule = await import("../src/app/workbench-navigation.ts").catch(
    () => null,
  );

  assert.ok(navigationModule, "expected workbench-navigation module to exist");

  const groups = navigationModule.buildWorkbenchNavigationGroups(
    buildSession("admin").availableWorkbenchEntries,
  );

  assert.deepEqual(
    groups.map((group: { label: string }) => group.label),
    ["核心工作台", "协同与回写", "管理区"],
  );
  assert.deepEqual(
    groups.map((group: { description: string }) => group.description),
    [
      "突出初筛、编辑、校对与知识库四个核心栏目",
      "保留学习复核等辅助协同入口",
      "管理员可见的治理与配置面板",
    ],
  );
  assert.deepEqual(
    groups.map((group: { prominence: string }) => group.prominence),
    ["primary", "supporting", "secondary"],
  );
  assert.deepEqual(
    groups[0]?.items.map((item: { label: string }) => item.label),
    ["初筛", "编辑", "校对", "知识库"],
  );
  assert.deepEqual(
    groups[1]?.items.map((item: { label: string }) => item.label),
    ["学习复核"],
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
    groups.map((group: { label: string }) => group.label),
    ["我的工作"],
  );
  assert.deepEqual(
    groups[0]?.items.map((item: { label: string }) => item.label),
    ["我的稿件"],
  );
});

test("navigation menu renders grouped admin navigation with an active pillar", async () => {
  const navigationModule = await import("../src/app/workbench-navigation.ts");
  const menuModule = await import("../src/app/workbench-navigation-menu.tsx").catch(
    () => null,
  );

  assert.ok(menuModule, "expected workbench-navigation-menu module to exist");

  const html = renderToStaticMarkup(
    <menuModule.WorkbenchNavigationMenu
      groups={navigationModule.buildWorkbenchNavigationGroups(
        buildSession("admin").availableWorkbenchEntries,
      )}
      activeWorkbenchId="editing"
      onNavigate={() => undefined}
    />,
  );

  assert.match(html, /核心工作台/);
  assert.match(html, /突出初筛、编辑、校对与知识库四个核心栏目/);
  assert.match(html, /4 项/);
  assert.match(html, /协同与回写/);
  assert.match(html, /保留学习复核等辅助协同入口/);
  assert.match(html, /1 项/);
  assert.match(html, /管理区/);
  assert.match(html, /管理员可见的治理与配置面板/);
  assert.match(html, /5 项/);
  assert.match(html, /编辑/);
  assert.match(html, /正文修订与模板落位/);
  assert.match(html, /知识审核与证据沉淀/);
  assert.match(html, /is-active/);
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
      activeWorkbenchId="submission"
      onNavigate={() => undefined}
    />,
  );

  assert.match(html, /我的工作/);
  assert.match(html, /我的稿件/);
  assert.doesNotMatch(html, /管理区/);
});

test("workbench shell header renders the product brand and active desk summary", async () => {
  const headerModule = await import("../src/app/workbench-shell-header.tsx").catch(
    () => null,
  );

  assert.ok(headerModule, "expected workbench-shell-header module to exist");

  const html = renderToStaticMarkup(
    <headerModule.WorkbenchShellHeader
      session={buildSession("admin")}
      activeWorkbenchLabel="编辑"
      activeWorkbenchDescription="聚焦正文编辑、模板上下文与校对前准备，让编辑台保持轻而稳。"
      activeWorkbenchGroupLabel="核心工作台"
      isCompactNavigation={false}
      isNavigationOpen
      onToggleNavigation={() => undefined}
      onLogout={() => undefined}
    />,
  );

  assert.match(html, /Medical Editorial Control Deck/);
  assert.match(html, /医学稿件处理系统/);
  assert.match(html, /初筛/);
  assert.match(html, /知识库/);
  assert.match(html, /当前工作台/);
  assert.match(html, /当前账号/);
  assert.match(html, /管理员/);
  assert.match(html, /退出登录/);
  assert.match(html, /workbench-shell-pillar is-active/);
});

test("workbench shell header exposes a compact navigation toggle state", async () => {
  const headerModule = await import("../src/app/workbench-shell-header.tsx").catch(
    () => null,
  );

  assert.ok(headerModule, "expected workbench-shell-header module to exist");

  const html = renderToStaticMarkup(
    <headerModule.WorkbenchShellHeader
      session={buildSession("editor")}
      activeWorkbenchLabel="编辑"
      activeWorkbenchDescription="聚焦正文编辑、模板上下文与校对前准备，让编辑台保持轻而稳。"
      activeWorkbenchGroupLabel="核心工作台"
      isCompactNavigation
      isNavigationOpen={false}
      onToggleNavigation={() => undefined}
    />,
  );

  assert.match(html, /展开导航/);
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
