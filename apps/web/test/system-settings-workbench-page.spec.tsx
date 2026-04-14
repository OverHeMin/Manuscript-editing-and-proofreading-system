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
  registeredModels: [
    {
      id: "model-qwen-max",
      modelName: "qwen-max",
      displayName: "qwen-max",
      connectionId: "provider-qwen-1",
      connectionName: "Qwen Production",
      allowedModules: ["screening", "editing"],
      productionAllowed: true,
      fallbackModelId: null,
      fallbackModelName: null,
    },
    {
      id: "model-deepseek-chat",
      modelName: "deepseek-chat",
      displayName: "deepseek-chat",
      connectionId: "provider-deepseek-1",
      connectionName: "DeepSeek Staging",
      allowedModules: ["editing", "proofreading"],
      productionAllowed: false,
      fallbackModelId: "model-qwen-max",
      fallbackModelName: "qwen-max",
    },
  ],
  moduleDefaults: [
    {
      moduleKey: "screening",
      moduleLabel: "初筛",
      primaryModelId: "model-qwen-max",
      primaryModelName: "qwen-max",
      fallbackModelId: "model-deepseek-chat",
      fallbackModelName: "deepseek-chat",
      temperature: 0.2,
    },
    {
      moduleKey: "editing",
      moduleLabel: "编辑",
      primaryModelId: "model-deepseek-chat",
      primaryModelName: "deepseek-chat",
      fallbackModelId: "model-qwen-max",
      fallbackModelName: "qwen-max",
      temperature: 0.4,
    },
    {
      moduleKey: "proofreading",
      moduleLabel: "校对",
      primaryModelId: "model-qwen-max",
      primaryModelName: "qwen-max",
      fallbackModelId: null,
      fallbackModelName: null,
      temperature: 0.3,
    },
  ],
} as const;

test("system settings accounts section renders overview cards, user list, create form, and selected-user actions in Chinese", () => {
  const markup = renderToStaticMarkup(
    <SystemSettingsWorkbenchPage
      runtimeMode="persistent"
      section="accounts"
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      }}
      initialOverview={loadedOverview as never}
    />,
  );

  assert.match(markup, /\u7cfb\u7edf\u8bbe\u7f6e/);
  assert.match(markup, /\u8d26\u53f7\u4e0e\u6743\u9650/u);
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

  assert.match(markup, /AI 接入/u);
  assert.match(markup, /当前演示模式不提供 AI 接入能力/u);
  assert.match(markup, /请连接持久化后端后再进行模型连接与密钥维护/u);
});

test("system settings demo-mode notice follows active section copy", () => {
  const aiAccessMarkup = renderToStaticMarkup(
    <SystemSettingsWorkbenchPage
      runtimeMode="demo"
      section="ai-access"
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );
  const accountsMarkup = renderToStaticMarkup(
    <SystemSettingsWorkbenchPage
      runtimeMode="demo"
      section="accounts"
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );

  assert.match(aiAccessMarkup, /AI 接入/u);
  assert.match(aiAccessMarkup, /当前演示模式不提供 AI 接入能力/u);
  assert.match(aiAccessMarkup, /请连接持久化后端后再进行模型连接与密钥维护/u);
  assert.match(accountsMarkup, /账号与权限/u);
  assert.match(accountsMarkup, /当前演示模式不提供账号与权限维护能力/u);
  assert.match(accountsMarkup, /请连接持久化后端后再进行管理员账号维护/u);
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

test("system settings workbench page renders registered models and editable module defaults with localized temperature copy", () => {
  const markup = renderToStaticMarkup(
    <SystemSettingsWorkbenchPage
      runtimeMode="persistent"
      section="ai-access"
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      }}
      initialOverview={loadedOverview as never}
    />,
  );

  assert.match(markup, /\u6a21\u578b\u6ce8\u518c/);
  assert.match(markup, /qwen-max/);
  assert.match(markup, /deepseek-chat/);
  assert.match(markup, /Qwen Production/);
  assert.match(markup, /DeepSeek Staging/);
  assert.match(markup, /\u521d\u7b5b/);
  assert.match(markup, /\u7f16\u8f91/);
  assert.match(markup, /\u6821\u5bf9/);
  assert.match(markup, /\u6e29\u5ea6/);
  assert.match(markup, /value=\"0\.2\"/);
  assert.match(markup, /\u4fdd\u5b58\u6a21\u5757\u9ed8\u8ba4\u503c/);
  assert.doesNotMatch(markup, /temperature/i);
});

test("system settings workbench page lands on different first-view emphasis for ai-access vs accounts", () => {
  const aiAccessMarkup = renderToStaticMarkup(
    <SystemSettingsWorkbenchPage
      runtimeMode="persistent"
      section="ai-access"
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      }}
      initialOverview={loadedOverview as never}
    />,
  );

  const accountsMarkup = renderToStaticMarkup(
    <SystemSettingsWorkbenchPage
      runtimeMode="persistent"
      section="accounts"
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      }}
      initialOverview={loadedOverview as never}
    />,
  );

  assert.match(aiAccessMarkup, /AI 接入/u);
  assert.match(aiAccessMarkup, /优先关注模型连接状态与密钥健康度/u);
  assert.match(aiAccessMarkup, /AI 提供方/u);
  assert.match(aiAccessMarkup, /模型注册/u);
  assert.match(aiAccessMarkup, /模块默认值/u);
  assert.doesNotMatch(aiAccessMarkup, /创建账号/u);
  assert.doesNotMatch(aiAccessMarkup, /修改账号信息/u);
  assert.doesNotMatch(aiAccessMarkup, /重置登录密码/u);
  assert.match(accountsMarkup, /账号与权限/u);
  assert.match(accountsMarkup, /优先关注账号状态与角色权限配置/u);
  assert.match(accountsMarkup, /创建账号/u);
  assert.match(accountsMarkup, /修改账号信息/u);
  assert.match(accountsMarkup, /重置登录密码/u);
  assert.doesNotMatch(accountsMarkup, /AI 提供方/u);
  assert.doesNotMatch(accountsMarkup, /模型注册/u);
  assert.doesNotMatch(accountsMarkup, /模块默认值/u);
});
