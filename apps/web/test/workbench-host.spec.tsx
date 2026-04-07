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

test("admin navigation model groups the four primary pillars and the management zone", async () => {
  const navigationModule = await import("../src/app/workbench-navigation.ts").catch(
    () => null,
  );

  assert.ok(navigationModule, "expected workbench-navigation module to exist");

  const groups = navigationModule.buildWorkbenchNavigationGroups(
    buildSession("admin").availableWorkbenchEntries,
  );

  assert.deepEqual(
    groups.map((group: { label: string }) => group.label),
    ["主工作线", "知识库", "管理区"],
  );
  assert.deepEqual(
    groups[0]?.items.map((item: { label: string }) => item.label),
    ["初筛", "编辑", "校对"],
  );
  assert.deepEqual(
    groups[1]?.items.map((item: { label: string }) => item.label),
    ["知识审核", "学习复核"],
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

  assert.match(html, /主工作线/);
  assert.match(html, /知识库/);
  assert.match(html, /管理区/);
  assert.match(html, /编辑/);
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
