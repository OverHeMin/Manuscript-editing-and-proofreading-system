import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SystemSettingsWorkbenchPage,
} from "../src/features/system-settings/system-settings-workbench-page.tsx";

const loadedOverview = {
  users: [
    {
      id: "admin-1",
      username: "admin.one",
      displayName: "主管理员",
      role: "admin",
      status: "active",
      createdAt: "2026-04-07T09:00:00.000Z",
      updatedAt: "2026-04-07T09:00:00.000Z",
    },
    {
      id: "editor-1",
      username: "editor.one",
      displayName: "编辑一号",
      role: "editor",
      status: "active",
      createdAt: "2026-04-07T09:05:00.000Z",
      updatedAt: "2026-04-07T09:05:00.000Z",
    },
    {
      id: "proofreader-1",
      username: "proofreader.one",
      displayName: "校对一号",
      role: "proofreader",
      status: "disabled",
      createdAt: "2026-04-07T09:10:00.000Z",
      updatedAt: "2026-04-07T09:10:00.000Z",
    },
  ],
  summary: {
    totalUsers: 3,
    activeUsers: 2,
    disabledUsers: 1,
    adminUsers: 1,
  },
  selectedUserId: "admin-1",
  selectedUser: {
    id: "admin-1",
    username: "admin.one",
    displayName: "主管理员",
    role: "admin",
    status: "active",
    createdAt: "2026-04-07T09:00:00.000Z",
    updatedAt: "2026-04-07T09:00:00.000Z",
  },
} as const;

test("system settings workbench page renders overview cards, user list, create form, and selected-user actions in Chinese", () => {
  const markup = renderToStaticMarkup(
    <SystemSettingsWorkbenchPage
      runtimeMode="persistent"
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      }}
      initialOverview={loadedOverview}
    />,
  );

  assert.match(markup, /系统设置/);
  assert.match(markup, /账号管理/);
  assert.match(markup, /账号总数/);
  assert.match(markup, /启用中/);
  assert.match(markup, /已停用/);
  assert.match(markup, /管理员/);
  assert.match(markup, /admin\.one/);
  assert.match(markup, /创建账号/);
  assert.match(markup, /用户名/);
  assert.match(markup, /显示名称/);
  assert.match(markup, /初始密码/);
  assert.match(markup, /账号操作/);
  assert.match(markup, /修改账号信息/);
  assert.match(markup, /重置登录密码/);
  assert.match(markup, /停用该账号/);
});

test("system settings workbench page renders a demo-mode unsupported notice", () => {
  const markup = renderToStaticMarkup(
    <SystemSettingsWorkbenchPage
      runtimeMode="demo"
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );

  assert.match(markup, /当前演示模式不提供账号管理能力/);
  assert.match(markup, /请连接持久化后端后再进行管理员账号维护/);
});

test("system settings workbench page renders request errors", () => {
  const markup = renderToStaticMarkup(
    <SystemSettingsWorkbenchPage
      runtimeMode="persistent"
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      }}
      initialErrorMessage="账号列表加载失败：HTTP 500"
    />,
  );

  assert.match(markup, /账号列表加载失败：HTTP 500/);
});
