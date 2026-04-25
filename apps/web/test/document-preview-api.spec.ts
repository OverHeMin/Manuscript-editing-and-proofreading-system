import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProofreadingLocateTarget,
  createPreviewSession,
} from "../src/features/document-preview/index.ts";

test("document preview mapping preserves stage-2a document locator metadata for right-side issue navigation", () => {
  const target = buildProofreadingLocateTarget({
    blockIndex: 7,
    quote: "ALT",
    sectionLabel: "Results",
    documentLocator: {
      anchorKind: "table_cell",
      anchorKey: "table:table-1:alanine_aminotransferase:value",
      confidence: "provided",
      tableId: "table-1",
      tableTarget: "data_cell",
      rowKey: "alanine_aminotransferase",
      columnKey: "value",
    },
  });

  assert.deepEqual(target, {
    blockIndex: 7,
    quote: "ALT",
    sectionLabel: "Results",
    anchorKey: "table:table-1:alanine_aminotransferase:value",
    anchorKind: "table_cell",
    confidence: "provided",
    tableId: "table-1",
    tableTarget: "data_cell",
    rowKey: "alanine_aminotransferase",
    columnKey: "value",
  });
});

test("document preview mapping falls back to block navigation when only stage-1 proofreading anchors exist", () => {
  const target = buildProofreadingLocateTarget({
    blockIndex: 2,
    quote: "The conclusion overstates the observed outcome.",
    sectionLabel: "Conclusion",
  });

  assert.deepEqual(target, {
    blockIndex: 2,
    quote: "The conclusion overstates the observed outcome.",
    sectionLabel: "Conclusion",
    anchorKey: "block:2",
    anchorKind: "block",
    confidence: "fallback",
  });
});

test("document preview mapping upgrades generic block locators when the anchor block kind is richer", () => {
  const target = buildProofreadingLocateTarget({
    blockIndex: 2,
    quote: "the unit expression 5 mg per dL should be normalized.",
    sectionLabel: "front_matter",
    blockKind: "paragraph",
    documentLocator: {
      anchorKind: "block",
      anchorKey: "block-2",
      confidence: "provided",
      blockIndex: 2,
      sectionLabel: "front_matter",
      ordinalWithinSection: 2,
    },
  });

  assert.deepEqual(target, {
    blockIndex: 2,
    quote: "the unit expression 5 mg per dL should be normalized.",
    sectionLabel: "front_matter",
    anchorKey: "paragraph:front_matter:2",
    anchorKind: "paragraph",
    confidence: "derived",
  });
});

test("createPreviewSession posts the preview-session payload without mutating stage-2a inputs", async () => {
  const calls: Array<{
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }> = [];

  const response = await createPreviewSession(
    {
      async request<TResponse>(input: {
        method: "GET" | "POST";
        url: string;
        body?: unknown;
      }) {
        calls.push(input);
        return {
          status: 200,
          body: {
            manuscript_id: "manuscript-1",
            source_asset_id: "asset-1",
            source_asset_type: "normalized_docx",
            viewer: "onlyoffice",
            mode: "view",
            surface_mode: "read_only_review",
            status: "ready",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            comment_source: "onlyoffice",
            comments: [],
            session_id: "session-1",
            correlation_id: "session-1",
            document: {
              document_key: "asset-1",
              file_name: "proofreading.docx",
              file_extension: "docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              download_path: "/api/v1/document-assets/asset-1/download",
              permissions: {
                edit: false,
                comment: false,
                review: false,
                download: true,
                print: true,
              },
            },
            authorization: {
              kind: "surface_session",
              requires_surface_session: true,
              token_scheme: "surface_session_jwt",
              access_token: "header.payload.signature",
            },
            event_bridge: {
              provider: "onlyoffice",
              transport: "window_post_message",
              capabilities: {
                ready_event: true,
                locate_to_anchor: true,
                selection_from_document: true,
                visible_issue_marks: false,
                bi_directional_sync: true,
              },
            },
            embed: {
              provider: "onlyoffice",
              provider_origin: "http://127.0.0.1:58080",
              api_js_url: "http://127.0.0.1:58080/web-apps/apps/api/documents/api.js",
              document_type: "word",
              ui_type: "desktop",
              editor_config: {
                mode: "view",
                lang: "zh-CN",
                customization: {
                  autosave: false,
                  chat: false,
                  comments: false,
                  compactHeader: true,
                  compactToolbar: true,
                  feedback: false,
                  forcesave: false,
                  help: false,
                  submitForm: false,
                },
              },
            },
            save_back_enabled: false,
            warnings: [],
          } as TResponse,
        };
      },
    },
    {
      manuscriptId: "manuscript-1",
      assetId: "asset-1",
      actorRole: "proofreader",
      previewStatus: "ready",
      comments: [
        {
          id: "comment-1",
          body: "定位到对应问题。",
        },
      ],
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.authorization.token_scheme, "surface_session_jwt");
  assert.equal(
    response.body.embed.api_js_url,
    "http://127.0.0.1:58080/web-apps/apps/api/documents/api.js",
  );
  assert.deepEqual(calls, [
    {
      method: "POST",
      url: "/api/v1/document-pipeline/preview-session",
      body: {
        manuscriptId: "manuscript-1",
        assetId: "asset-1",
        actorRole: "proofreader",
        previewStatus: "ready",
        comments: [
          {
            id: "comment-1",
            body: "定位到对应问题。",
          },
        ],
      },
    },
  ]);
});
