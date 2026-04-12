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

test("knowledge reviewer defaults to knowledge library", () => {
  const session = buildSession("knowledge_reviewer");

  assert.equal(session.defaultWorkbench, "knowledge-library");
});

test("admin navigation model highlights the four core desks, keeps knowledge review supporting, and exposes rule center as one governance entry", async () => {
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
    groups.map((group: { prominence: string }) => group.prominence),
    ["primary", "supporting", "secondary"],
  );
  assert.deepEqual(
    groups[0]?.items.map((item: { id: string }) => item.id),
    ["screening", "editing", "proofreading", "knowledge-library"],
  );
  assert.deepEqual(
    groups[1]?.items.map((item: { id: string }) => item.id),
    ["knowledge-review"],
  );
  assert.deepEqual(
    groups[2]?.items.map((item: { id: string }) => item.id),
    [
      "admin-console",
      "template-governance",
      "evaluation-workbench",
      "harness-datasets",
      "system-settings",
    ],
  );
  assert.equal(
    groups[2]?.items.find((item: { id: string; label: string }) => item.id === "template-governance")
      ?.label,
    "\u89c4\u5219\u4e2d\u5fc3",
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

test("navigation menu renders grouped admin navigation with rule center as the active governance product entry", async () => {
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
      activeWorkbenchId="template-governance"
      onNavigate={() => undefined}
    />,
  );

  assert.match(html, /\u89c4\u5219\u4e2d\u5fc3/u);
  assert.match(html, /5 \u9879/u);
  assert.match(html, /4 \u9879/u);
  assert.match(html, /1 \u9879/u);
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

  assert.match(html, /\u6211\u7684\u5de5\u4f5c/u);
  assert.match(html, /\u6211\u7684\u7a3f\u4ef6/u);
  assert.doesNotMatch(html, /\u89c4\u5219\u4e2d\u5fc3/u);
});

test("admin navigation labels the admin console entry as Harness Control Plane while keeping the route id stable", async () => {
  const navigationModule = await import("../src/app/workbench-navigation.ts").catch(
    () => null,
  );

  assert.ok(navigationModule, "expected workbench-navigation module to exist");

  const groups = navigationModule.buildWorkbenchNavigationGroups(
    buildSession("admin").availableWorkbenchEntries,
  );
  const harnessEntry = groups[2]?.items.find((item: { id: string }) => item.id === "admin-console");

  assert.equal(harnessEntry?.id, "admin-console");
  assert.equal(harnessEntry?.label, "Harness Control Plane");
});

test("workbench shell header renders the product brand and active desk summary", async () => {
  const headerModule = await import("../src/app/workbench-shell-header.tsx").catch(
    () => null,
  );

  assert.ok(headerModule, "expected workbench-shell-header module to exist");

  const html = renderToStaticMarkup(
    <headerModule.WorkbenchShellHeader
      session={buildSession("admin")}
      activeWorkbenchLabel="\u7f16\u8f91"
      activeWorkbenchDescription="Focused editing summary"
      activeWorkbenchGroupLabel="\u6838\u5fc3\u5de5\u4f5c\u53f0"
      isCompactNavigation={false}
      isNavigationOpen
      onToggleNavigation={() => undefined}
      onLogout={() => undefined}
    />,
  );

  assert.match(html, /Medical Editorial Control Deck/);
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
      activeWorkbenchDescription="Focused editing summary"
      activeWorkbenchGroupLabel="\u6838\u5fc3\u5de5\u4f5c\u53f0"
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
