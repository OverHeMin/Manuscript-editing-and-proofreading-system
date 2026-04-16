import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ManuscriptWorkbenchNotice } from "../src/features/manuscript-workbench/manuscript-workbench-notice.tsx";

test("manuscript workbench notice renders success and error banner states", () => {
  const successMarkup = renderToStaticMarkup(
    <ManuscriptWorkbenchNotice
      tone="success"
      title="Action Complete"
      message="Uploaded manuscript manuscript-1"
    />,
  );
  const errorMarkup = renderToStaticMarkup(
    <ManuscriptWorkbenchNotice
      tone="error"
      title="Action Error"
      message="Upload failed because the file payload was invalid."
    />,
  );

  assert.match(successMarkup, /Action Complete/);
  assert.match(successMarkup, /Uploaded manuscript manuscript-1/);
  assert.match(successMarkup, /manuscript-workbench-notice is-success/);
  assert.match(successMarkup, /data-notice-layout="inline-strip"/);
  assert.match(errorMarkup, /Action Error/);
  assert.match(errorMarkup, /Upload failed because the file payload was invalid\./);
  assert.match(errorMarkup, /manuscript-workbench-notice is-error/);
  assert.match(errorMarkup, /data-notice-layout="inline-strip"/);
});
