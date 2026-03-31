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

  assert.match(html, /Restoring Session/);
  assert.match(html, /current backend session/i);
});

test("persistent auth shell renders a sign-in form for unauthenticated users", () => {
  const html = render({
    kind: "unauthenticated",
    username: "persistent.reviewer",
    password: "",
    isLoginPending: false,
    loginErrorMessage: "Bad credentials",
  });

  assert.match(html, /Persistent Workbench Sign-In/);
  assert.match(html, /name="username"/);
  assert.match(html, /name="password"/);
  assert.match(html, /Bad credentials/);
  assert.match(html, /Sign in/);
});

test("persistent auth shell renders a retry state when session bootstrap fails", () => {
  const html = render({
    kind: "bootstrap-error",
    message: "Unable to reach backend auth runtime.",
  });

  assert.match(html, /Session Bootstrap Failed/);
  assert.match(html, /Unable to reach backend auth runtime/);
  assert.match(html, /Retry Session Check/);
});
