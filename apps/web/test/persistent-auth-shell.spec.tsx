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

  assert.match(html, /app-shell-auth/);
  assert.match(html, /auth-shell/);
  assert.match(html, /auth-shell-hero/);
  assert.match(html, /auth-shell-card/);
  assert.match(html, /auth-shell-brand/);
  assert.doesNotMatch(html, /authenticated-workbench/);
});

test("persistent auth shell renders the approved homepage hero hierarchy for unauthenticated users", () => {
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
  assert.match(html, /auth-shell-brand/);
  assert.match(html, /<h1>医学稿件处理系统<\/h1>/u);
  assert.match(html, /覆盖稿件主链路与治理协作的一体化工作台/u);
  assert.doesNotMatch(html, /为筛查、编辑、校对与知识入库提供稳定一致的工作入口/u);
  assert.match(html, /登录后按角色进入对应工作区/u);
  assert.match(html, /name="username"/);
  assert.match(html, /name="password"/);
  assert.match(html, /账号或密码不正确/u);
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

  assert.match(html, /app-shell-auth/);
  assert.match(html, /auth-shell/);
  assert.match(html, /auth-shell-hero/);
  assert.match(html, /auth-shell-card/);
  assert.match(html, /Unable to reach backend auth runtime/);
  assert.match(html, /auth-shell-brand/);
});

test("persistent auth shell keeps the premium entrance shell while login is pending", () => {
  const html = render({
    kind: "unauthenticated",
    username: "persistent.reviewer",
    password: "secret",
    isLoginPending: true,
    loginErrorMessage: null,
  });

  assert.match(html, /app-shell-auth/);
  assert.match(html, /auth-shell-hero/);
  assert.match(html, /auth-shell-card/);
  assert.match(html, /auth-shell-brand/);
});
