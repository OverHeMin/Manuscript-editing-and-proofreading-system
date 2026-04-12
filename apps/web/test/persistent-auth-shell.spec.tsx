import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PersistentAuthShellView,
  type PersistentAuthShellViewState,
} from "../src/app/persistent-auth-shell.tsx";

function render(state: PersistentAuthShellViewState): string {
  return renderToStaticMarkup(
    <PersistentAuthShellView
      state={state}
      onUsernameChange={() => undefined}
      onPasswordChange={() => undefined}
      onSubmit={() => undefined}
      onRetry={() => undefined}
      renderAuthenticated={() => <div>authenticated-workbench</div>}
      onLogout={() => undefined}
    />,
  );
}

test("persistent auth shell renders bootstrapping status while restoring session", () => {
  const html = render({
    kind: "bootstrapping",
  });

  assert.match(html, /正在恢复工作会话/);
  assert.match(html, /正在恢复当前后台工作会话/);
  assert.match(html, /auth-shell-brand/);
});

test("persistent auth shell renders a premium left hero and right card login shell for unauthenticated users", () => {
  const html = render({
    kind: "unauthenticated",
    username: "persistent.reviewer",
    password: "",
    isLoginPending: false,
    loginErrorMessage: "账号或密码不正确",
  });

  assert.match(html, /auth-shell-hero/);
  assert.match(html, /auth-shell-card/);
  assert.match(html, /auth-shell-visual/);
  assert.match(html, /医学稿件处理系统/);
  assert.match(html, /编辑部工作台登录/);
  assert.match(html, /为筛查、编辑、校对与知识入库提供稳定一致的工作入口/);
  assert.match(html, /登录后进入初筛、编辑、校对与知识库工作区/);
  assert.match(html, /name="username"/);
  assert.match(html, /name="password"/);
  assert.match(html, /账号/);
  assert.match(html, /密码/);
  assert.match(html, />登录</);
  assert.match(html, /账号或密码不正确/);
  assert.match(html, /auth-shell-brand/);
});

test("persistent auth shell unauthenticated landing markup does not expose raw english failure copy", () => {
  const html = render({
    kind: "unauthenticated",
    username: "",
    password: "",
    isLoginPending: false,
    loginErrorMessage: null,
  });

  assert.doesNotMatch(html, /Sign-in failed/);
});

test("persistent auth shell renders a retry state when session bootstrap fails", () => {
  const html = render({
    kind: "bootstrap-error",
    message: "Unable to reach backend auth runtime.",
  });

  assert.match(html, /工作会话恢复失败/);
  assert.match(html, /Unable to reach backend auth runtime/);
  assert.match(html, /重新检查会话/);
  assert.match(html, /auth-shell-brand/);
});
