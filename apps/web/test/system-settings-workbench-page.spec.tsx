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
      displayName: "系统管理员",
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
    displayName: "系统管理员",
    role: "admin",
    status: "active",
    createdAt: "2026-04-07T09:00:00.000Z",
    updatedAt: "2026-04-07T09:00:00.000Z",
  },
  providerConnections: [
    {
      id: "provider-qwen-1",
      name: "Qwen Production",
      provider_kind: "qwen",
      compatibility_mode: "openai_chat_compatible",
      base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      enabled: true,
      connection_metadata: {
        test_model_name: "qwen-max",
      },
      last_test_status: "passed",
      last_test_at: "2026-04-10T08:00:00.000Z",
      credential_summary: {
        mask: "sk-***a562",
        version: 1,
      },
    },
    {
      id: "provider-deepseek-1",
      name: "DeepSeek Staging",
      provider_kind: "deepseek",
      compatibility_mode: "openai_chat_compatible",
      base_url: "https://api.deepseek.com",
      enabled: false,
      connection_metadata: {
        test_model_name: "deepseek-chat",
      },
      last_test_status: "failed",
      last_error_summary: "HTTP 401",
      credential_summary: {
        mask: "sk-***c101",
        version: 3,
      },
    },
  ],
  selectedConnectionId: "provider-qwen-1",
  selectedConnection: {
    id: "provider-qwen-1",
    name: "Qwen Production",
    provider_kind: "qwen",
    compatibility_mode: "openai_chat_compatible",
    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    enabled: true,
    connection_metadata: {
      test_model_name: "qwen-max",
    },
    last_test_status: "passed",
    last_test_at: "2026-04-10T08:00:00.000Z",
    credential_summary: {
      mask: "sk-***a562",
      version: 1,
    },
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
      initialOverview={loadedOverview as never}
    />,
  );

  assert.match(markup, /\u7cfb\u7edf\u8bbe\u7f6e/);
  assert.match(markup, /\u8d26\u53f7\u7ba1\u7406/);
  assert.match(markup, /\u8d26\u53f7\u603b\u6570/);
  assert.match(markup, /\u542f\u7528\u4e2d/);
  assert.match(markup, /\u5df2\u505c\u7528/);
  assert.match(markup, /\u7ba1\u7406\u5458/);
  assert.match(markup, /admin\.one/);
  assert.match(markup, /\u521b\u5efa\u8d26\u53f7/);
  assert.match(markup, /\u7528\u6237\u540d/);
  assert.match(markup, /\u663e\u793a\u540d\u79f0/);
  assert.match(markup, /\u521d\u59cb\u5bc6\u7801/);
  assert.match(markup, /\u8d26\u53f7\u64cd\u4f5c/);
  assert.match(markup, /\u4fee\u6539\u8d26\u53f7\u4fe1\u606f/);
  assert.match(markup, /\u91cd\u7f6e\u767b\u5f55\u5bc6\u7801/);
  assert.match(markup, /\u505c\u7528\u8be5\u8d26\u53f7/);
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

  assert.match(markup, /\u5f53\u524d\u6f14\u793a\u6a21\u5f0f\u4e0d\u63d0\u4f9b\u8d26\u53f7\u7ba1\u7406\u80fd\u529b/);
  assert.match(markup, /\u8bf7\u8fde\u63a5\u6301\u4e45\u5316\u540e\u7aef\u540e\u518d\u8fdb\u884c\u7ba1\u7406\u5458\u8d26\u53f7\u7ef4\u62a4/);
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

  assert.match(markup, /\u8d26\u53f7\u5217\u8868\u52a0\u8f7d\u5931\u8d25\uff1aHTTP 500/);
});

test("system settings workbench page renders ai provider controls alongside masked credentials and connection testing fields", () => {
  const markup = renderToStaticMarkup(
    <SystemSettingsWorkbenchPage
      runtimeMode="persistent"
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      }}
      initialOverview={loadedOverview as never}
    />,
  );

  assert.match(markup, /AI\s*\u63d0\u4f9b\u65b9/);
  assert.match(markup, /Qwen Production/);
  assert.match(markup, /DeepSeek Staging/);
  assert.match(markup, /sk-\*\*\*a562/);
  assert.match(markup, /Qwen/);
  assert.match(markup, /DeepSeek/);
  assert.match(markup, /openai_chat_compatible/);
  assert.match(markup, /\u63d0\u4f9b\u65b9\u7c7b\u578b/);
  assert.match(markup, /Base URL/);
  assert.match(markup, /\u6d4b\u8bd5\u6a21\u578b/);
  assert.match(markup, /\u542f\u7528\u72b6\u6001/);
  assert.match(markup, /\u8fde\u63a5\u6d4b\u8bd5/);
});
