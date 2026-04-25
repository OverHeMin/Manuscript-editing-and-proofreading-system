import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DocumentPreviewLocateTargetViewModel } from "../src/features/document-preview/types.ts";
import * as onlyofficePreviewSurfaceModule from "../src/features/document-preview/onlyoffice-preview-surface.tsx";
import {
  buildPendingOnlyOfficeIssueMarkSyncAck,
  buildOnlyOfficeLocateRequestFingerprint,
  buildOnlyOfficeDocEditorConfig,
  createOnlyOfficeLocateBridgeChannelName,
  isOnlyOfficeLocateAckForRequest,
  OnlyOfficePreviewSurface,
  ONLYOFFICE_PROOFREADING_LOCATE_PLUGIN_GUID,
  postOnlyOfficeLocateRequest,
  parseOnlyOfficeIssueSelectionBridgeMessage,
  resolveOnlyOfficeIssueMarkSyncStatusMessage,
} from "../src/features/document-preview/onlyoffice-preview-surface.tsx";

function createPreviewSession() {
  return {
    manuscript_id: "manuscript-1",
    source_asset_id: "asset-original-1",
    source_asset_type: "original",
    session_id: "preview-session-1",
    correlation_id: "preview-session-1",
    viewer: "onlyoffice",
    mode: "view",
    surface_mode: "read_only_review",
    status: "ready",
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    comment_source: "onlyoffice",
    document: {
      document_key: "asset-original-1",
      file_name: "proofreading-browser-smoke.docx",
      file_extension: "docx",
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      download_path: "/api/v1/document-assets/asset-original-1/download",
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
        visible_issue_marks: true,
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
    comments: [],
    save_back_enabled: false,
    warnings: [],
  } as const;
}

test("onlyoffice preview config registers the proofreading locate bridge plugin for stage-2b navigation", () => {
  const config = buildOnlyOfficeDocEditorConfig(createPreviewSession());
  const channelName = createOnlyOfficeLocateBridgeChannelName("preview-session-1");

  assert.deepEqual(config.editorConfig.plugins?.autostart, [
    ONLYOFFICE_PROOFREADING_LOCATE_PLUGIN_GUID,
  ]);
  assert.deepEqual(config.editorConfig.plugins?.pluginsData, [
    "http://127.0.0.1:4173/onlyoffice/proofreading-locate-plugin/config.json?sessionId=preview-session-1&bridgeVersion=20260425-stage2b-document-selection-sync",
  ]);
  assert.deepEqual(config.editorConfig.plugins?.options, {
    [ONLYOFFICE_PROOFREADING_LOCATE_PLUGIN_GUID]: {
      channelName,
      pluginGuid: ONLYOFFICE_PROOFREADING_LOCATE_PLUGIN_GUID,
      sessionId: "preview-session-1",
    },
  });
});

test("onlyoffice preview surface describes the mounted document as the current manuscript version", () => {
  const markup = renderToStaticMarkup(
    React.createElement(OnlyOfficePreviewSurface, {
      previewSession: createPreviewSession(),
    }),
  );

  assert.match(markup, /当前以只读模式挂载当前稿件版本/u);
  assert.doesNotMatch(markup, /挂载原稿/u);
});

test("onlyoffice preview surface parses document-originated issue selection messages from the bridge", () => {
  assert.deepEqual(
    parseOnlyOfficeIssueSelectionBridgeMessage({
      type: "medsys-onlyoffice-proofreading-selection",
      sessionId: "preview-session-1",
      itemId: "issue-2",
      anchorKey: "paragraph:discussion:1",
      anchorKind: "paragraph",
      origin: "click",
    }),
    {
      type: "medsys-onlyoffice-proofreading-selection",
      sessionId: "preview-session-1",
      itemId: "issue-2",
      anchorKey: "paragraph:discussion:1",
      anchorKind: "paragraph",
      origin: "click",
    },
  );

  assert.equal(
    parseOnlyOfficeIssueSelectionBridgeMessage({
      type: "medsys-onlyoffice-proofreading-selection",
      sessionId: "preview-session-1",
      itemId: "",
      anchorKey: "paragraph:discussion:1",
      anchorKind: "paragraph",
      origin: "click",
    }),
    null,
  );
});

test("onlyoffice preview surface posts a real locate request when the right-side issue changes", () => {
  const locateTarget: DocumentPreviewLocateTargetViewModel = {
    blockIndex: 2,
    quote: "the unit expression 5 mg per dL should be normalized.",
    sectionLabel: "front_matter",
    anchorKey: "block-2",
    anchorKind: "block",
    confidence: "provided",
  };

  const postedMessages: unknown[] = [];

  class FakeBroadcastChannel {
    constructor(readonly name: string) {
      postedMessages.push({
        type: "open",
        name,
      });
    }

    postMessage(message: unknown) {
      postedMessages.push(message);
    }

    close() {
      postedMessages.push({
        type: "close",
      });
    }
  }

  const didPost = postOnlyOfficeLocateRequest({
    previewSession: createPreviewSession(),
    locateTarget,
    BroadcastChannelCtor: FakeBroadcastChannel as never,
  });

  assert.equal(didPost, true);
  assert.deepEqual(postedMessages, [
    {
      type: "open",
      name: "medsys.onlyoffice.locate.preview-session-1",
    },
    {
      type: "proofreading-locate",
      sessionId: "preview-session-1",
      documentKey: "asset-original-1",
      anchorKey: "block-2",
      anchorKind: "block",
      blockIndex: 2,
      quote: "the unit expression 5 mg per dL should be normalized.",
      sectionLabel: "front_matter",
      confidence: "provided",
    },
    {
      type: "close",
    },
  ]);
});

test("onlyoffice preview surface publishes proofreading issue marks to the document bridge for visible annotations", () => {
  const syncRequest =
    (onlyofficePreviewSurfaceModule as {
      postOnlyOfficeIssueMarkSyncRequest?: (input: {
        previewSession: ReturnType<typeof createPreviewSession>;
        issueMarks: Array<{
          itemId: string;
          title: string;
          severity?: string;
          processed: boolean;
          selected: boolean;
          blockIndex: number;
          quote: string;
          sectionLabel?: string;
          anchorKey: string;
          anchorKind: DocumentPreviewLocateTargetViewModel["anchorKind"];
          confidence: DocumentPreviewLocateTargetViewModel["confidence"];
        }>;
        BroadcastChannelCtor?: new (name: string) => {
          postMessage(message: unknown): void;
          close(): void;
        };
      }) => boolean;
    }).postOnlyOfficeIssueMarkSyncRequest;

  assert.equal(typeof syncRequest, "function");
  if (typeof syncRequest !== "function") {
    return;
  }

  const postedMessages: unknown[] = [];

  class FakeBroadcastChannel {
    constructor(readonly name: string) {
      postedMessages.push({
        type: "open",
        name,
      });
    }

    postMessage(message: unknown) {
      postedMessages.push(message);
    }

    close() {
      postedMessages.push({
        type: "close",
      });
    }
  }

  const didPost = syncRequest({
    previewSession: createPreviewSession(),
    issueMarks: [
      {
        itemId: "issue-1",
        title: "单位格式",
        severity: "high",
        processed: false,
        selected: true,
        blockIndex: 2,
        quote: "the unit expression 5 mg per dL should be normalized.",
        sectionLabel: "front_matter",
        anchorKey: "paragraph:front_matter:2",
        anchorKind: "paragraph",
        confidence: "provided",
      },
    ],
    BroadcastChannelCtor: FakeBroadcastChannel as never,
  });

  assert.equal(didPost, true);
  assert.deepEqual(postedMessages, [
    {
      type: "open",
      name: "medsys.onlyoffice.locate.preview-session-1",
    },
    {
      type: "proofreading-sync-annotations",
      sessionId: "preview-session-1",
      documentKey: "asset-original-1",
      issues: [
        {
          itemId: "issue-1",
          title: "单位格式",
          severity: "high",
          processed: false,
          selected: true,
          blockIndex: 2,
          quote: "the unit expression 5 mg per dL should be normalized.",
          sectionLabel: "front_matter",
          anchorKey: "paragraph:front_matter:2",
          anchorKind: "paragraph",
          confidence: "provided",
        },
      ],
    },
    {
      type: "close",
    },
  ]);
});

test("onlyoffice annotation sync request state does not downgrade an already received host ack back to requested", () => {
  const receivedAck = {
    type: "medsys-onlyoffice-proofreading-annotation-sync-ack",
    sessionId: "preview-session-1",
    issueCount: 1,
    appliedCount: 0,
    stage: "received",
  } as const;

  assert.equal(
    buildPendingOnlyOfficeIssueMarkSyncAck({
      current: receivedAck,
      sessionId: "preview-session-1",
      issueCount: 1,
    }),
    receivedAck,
  );

  assert.deepEqual(
    buildPendingOnlyOfficeIssueMarkSyncAck({
      current: receivedAck,
      sessionId: "preview-session-1",
      issueCount: 2,
    }),
    {
      type: "medsys-onlyoffice-proofreading-annotation-sync-ack",
      sessionId: "preview-session-1",
      issueCount: 2,
      appliedCount: 0,
      stage: "requested",
    },
  );
});

test("onlyoffice preview surface keeps annotation status copy truthful when the bridge reconciles but no visible marks were applied", () => {
  assert.equal(
    resolveOnlyOfficeIssueMarkSyncStatusMessage({
      visibleIssueMarksSupported: true,
      biDirectionalSyncSupported: true,
      ack: {
        type: "medsys-onlyoffice-proofreading-annotation-sync-ack",
        sessionId: "preview-session-1",
        issueCount: 1,
        appliedCount: 0,
        stage: "reconciled",
      },
      issueMarks: [
        {
          itemId: "issue-1",
          title: "单位格式",
          processed: false,
          selected: true,
          blockIndex: 2,
          quote: "the unit expression 5 mg per dL should be normalized.",
          anchorKey: "paragraph:front_matter:2",
          anchorKind: "paragraph",
          confidence: "provided",
        },
      ],
    }),
    "文内问题标记同步已完成，但当前稿件还没有落下可见标记；左侧标记轨继续承担状态总览。",
  );
});

test("onlyoffice preview surface reports bidirectional sync once visible marks and document-originated selection are both available", () => {
  assert.equal(
    resolveOnlyOfficeIssueMarkSyncStatusMessage({
      visibleIssueMarksSupported: true,
      biDirectionalSyncSupported: true,
      ack: {
        type: "medsys-onlyoffice-proofreading-annotation-sync-ack",
        sessionId: "preview-session-1",
        issueCount: 1,
        appliedCount: 1,
        stage: "reconciled",
      },
      issueMarks: [
        {
          itemId: "issue-1",
          title: "问题一",
          processed: false,
          selected: true,
          blockIndex: 0,
          quote: "Table 1",
          anchorKey: "paragraph:front_matter:0",
          anchorKind: "paragraph",
          confidence: "provided",
        },
      ],
    }),
    "当前已接入问题定位、文内问题标记与问题双向联动；左侧标记轨继续承担状态总览。",
  );
});

test("onlyoffice locate ack matching only stops retries for the active request payload", () => {
  const previewSession = createPreviewSession();
  const locateTarget: DocumentPreviewLocateTargetViewModel = {
    blockIndex: 2,
    quote: "the unit expression 5 mg per dL should be normalized.",
    sectionLabel: "front_matter",
    anchorKey: "block-2",
    anchorKind: "block",
    confidence: "provided",
  };

  const requestFingerprint = buildOnlyOfficeLocateRequestFingerprint(
    previewSession,
    locateTarget,
  );

  assert.equal(
    isOnlyOfficeLocateAckForRequest(requestFingerprint, {
      type: "medsys-onlyoffice-proofreading-locate-ack",
      sessionId: "preview-session-1",
      anchorKey: "block-2",
      anchorKind: "block",
      blockIndex: 2,
      quote: "the unit expression 5 mg per dL should be normalized.",
      stage: "executed",
    }),
    true,
  );
  assert.equal(
    isOnlyOfficeLocateAckForRequest(requestFingerprint, {
      type: "medsys-onlyoffice-proofreading-locate-ack",
      sessionId: "preview-session-1",
      anchorKey: "block-9",
      anchorKind: "block",
      blockIndex: 2,
      quote: "the unit expression 5 mg per dL should be normalized.",
      stage: "executed",
    }),
    false,
  );
});

test("onlyoffice locate plugin loads ONLYOFFICE runtime before registering the proofreading bridge hooks", () => {
  const pluginIndexHtml = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../public/onlyoffice/proofreading-locate-plugin/index.html",
    ),
    "utf8",
  );

  const runtimeAppendIndex = pluginIndexHtml.indexOf(
    'appendScript(providerOrigin + "/sdkjs-plugins/v1/plugins.js"',
  );

  assert.notEqual(runtimeAppendIndex, -1);
});

test("onlyoffice locate plugin bootstrap avoids document.write so the proofreading bridge script remains mounted", () => {
  const pluginIndexHtml = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../public/onlyoffice/proofreading-locate-plugin/index.html",
    ),
    "utf8",
  );

  assert.equal(
    pluginIndexHtml.includes("document.write"),
    false,
    "document.write drops the follow-up bridge script in the real plugin iframe, so runtime loading must use DOM insertion instead.",
  );
});

test("onlyoffice locate plugin rebinds bridge hooks when the ONLYOFFICE runtime replaces Asc.plugin", () => {
  const pluginBridgeJs = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../public/onlyoffice/proofreading-locate-plugin/plugin.js",
    ),
    "utf8",
  );

  assert.equal(
    pluginBridgeJs.includes('Object.defineProperty(window.Asc, "plugin"'),
    true,
    "The bridge script must intercept Asc.plugin replacement so init hooks survive the runtime bootstrap path.",
  );
});

test("onlyoffice locate plugin includes paragraph annotation hooks for visible issue marks", () => {
  const pluginBridgeJs = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../public/onlyoffice/proofreading-locate-plugin/plugin.js",
    ),
    "utf8",
  );

  assert.equal(
    pluginBridgeJs.includes('attachEditorEvent("onParagraphText"'),
    true,
    "The bridge must subscribe to paragraph text so proofreading issues can become document-visible marks.",
  );
  assert.equal(
    pluginBridgeJs.includes('executeMethod("AnnotateParagraph"'),
    true,
    "The bridge must create paragraph annotations so the document surface shows visible proofreading marks.",
  );
  assert.equal(
    pluginBridgeJs.includes('executeMethod("SelectAnnotationRange"'),
    true,
    "The bridge must focus an existing annotation before falling back to text search.",
  );
  assert.equal(
    pluginBridgeJs.includes('executeMethod("RemoveAnnotationRange"'),
    true,
    "The bridge must be able to refresh annotation sets when the proofreading issue view changes.",
  );
  assert.equal(
    pluginBridgeJs.includes('attachEditorEvent("onClickAnnotation"'),
    true,
    "The bridge must subscribe to annotation click events so document-side issue clicks can drive the right-side queue.",
  );
  assert.equal(
    pluginBridgeJs.includes('attachEditorEvent("onFocusAnnotation"'),
    true,
    "The bridge must subscribe to annotation focus events so keyboard navigation inside the document can still synchronize the issue queue.",
  );
});

test("onlyoffice locate plugin posts annotation sync ack payloads back to the host page after reconciling document-visible marks", () => {
  const pluginBridgeJs = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../public/onlyoffice/proofreading-locate-plugin/plugin.js",
    ),
    "utf8",
  );

  assert.equal(
    pluginBridgeJs.includes("medsys-onlyoffice-proofreading-annotation-sync-ack"),
    true,
    "The plugin bridge must publish a host-visible annotation sync ack so browser acceptance can verify that document-side issue marks were actually applied.",
  );
  assert.equal(
    pluginBridgeJs.includes("appliedCount"),
    true,
    "The annotation sync ack must report how many issue marks were applied into the document surface.",
  );
  assert.equal(
    pluginBridgeJs.includes("issueCount"),
    true,
    "The annotation sync ack must report the requested issue count so the host can detect partial syncs truthfully.",
  );
});

test("onlyoffice locate plugin completes the annotation sync ack cycle after a sync envelope reaches the bridge", () => {
  const pluginBridgeJs = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../public/onlyoffice/proofreading-locate-plugin/plugin.js",
    ),
    "utf8",
  );

  const postedMessages: unknown[] = [];

  class FakeBroadcastChannel {
    static latestInstance: FakeBroadcastChannel | null = null;

    onmessage: ((event: { data: unknown }) => void) | null = null;

    constructor(readonly name: string) {
      FakeBroadcastChannel.latestInstance = this;
    }

    close() {}
  }

  const documentState = {
    title: "",
  };
  const registeredWindowEvents = new Map<string, Array<(payload: unknown) => void>>();
  const pluginState = {
    info: {
      options: {
        channelName: "medsys.onlyoffice.locate.preview-session-1",
        sessionId: "preview-session-1",
      },
    },
    attachEditorEvent(eventName: string, handler: (payload: unknown) => void) {
      const handlers = registeredWindowEvents.get(eventName) ?? [];
      handlers.push(handler);
      registeredWindowEvents.set(eventName, handlers);
    },
    executeMethod(_name: string, _args: unknown[], callback?: () => void) {
      callback?.();
    },
  };
  const windowState = {
    location: {
      origin: "http://127.0.0.1:4173",
    },
    top: {
      postMessage(message: unknown) {
        postedMessages.push(message);
      },
    },
    addEventListener() {},
    removeEventListener() {},
    Asc: {
      plugin: pluginState,
    },
  } as const;
  const context = {
    window: windowState,
    document: documentState,
    BroadcastChannel: FakeBroadcastChannel,
    console,
    setTimeout,
    clearTimeout,
  };

  vm.runInNewContext(pluginBridgeJs, context);

  windowState.Asc.plugin.init();
  FakeBroadcastChannel.latestInstance?.onmessage?.({
    data: {
      type: "proofreading-sync-annotations",
      sessionId: "preview-session-1",
      documentKey: "asset-original-1",
      issues: [
        {
          itemId: "issue-1",
          title: "单位格式",
          severity: "high",
          processed: false,
          selected: true,
          blockIndex: 2,
          quote: "the unit expression 5 mg per dL should be normalized.",
          sectionLabel: "front_matter",
          anchorKey: "paragraph:front_matter:2",
          anchorKind: "paragraph",
          confidence: "provided",
        },
      ],
    },
  });

  const annotationSyncAcks = postedMessages.filter((message) => {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return false;
    }

    return (
      (message as { type?: string }).type ===
      "medsys-onlyoffice-proofreading-annotation-sync-ack"
    );
  }) as Array<{
    stage: string;
    issueCount: number;
    appliedCount: number;
  }>;

  assert.deepEqual(
    annotationSyncAcks.map((ack) => ack.stage),
    ["received", "reconciled"],
  );
  const lastAnnotationSyncAck = annotationSyncAcks.at(-1);

  assert.equal(lastAnnotationSyncAck?.type, "medsys-onlyoffice-proofreading-annotation-sync-ack");
  assert.equal(lastAnnotationSyncAck?.sessionId, "preview-session-1");
  assert.equal(lastAnnotationSyncAck?.stage, "reconciled");
  assert.equal(lastAnnotationSyncAck?.issueCount, 1);
  assert.equal(lastAnnotationSyncAck?.appliedCount, 0);
});

test("onlyoffice locate plugin posts document-originated issue selection messages when an annotation is clicked or focused", () => {
  const pluginBridgeJs = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../public/onlyoffice/proofreading-locate-plugin/plugin.js",
    ),
    "utf8",
  );

  const postedMessages: unknown[] = [];

  class FakeBroadcastChannel {
    static latestInstance: FakeBroadcastChannel | null = null;

    onmessage: ((event: { data: unknown }) => void) | null = null;

    constructor(readonly name: string) {
      FakeBroadcastChannel.latestInstance = this;
    }

    close() {}
  }

  const registeredEditorEvents = new Map<string, Array<(payload: unknown) => void>>();
  const pluginState = {
    info: {
      options: {
        channelName: "medsys.onlyoffice.locate.preview-session-1",
        sessionId: "preview-session-1",
      },
    },
    attachEditorEvent(eventName: string, handler: (payload: unknown) => void) {
      const handlers = registeredEditorEvents.get(eventName) ?? [];
      handlers.push(handler);
      registeredEditorEvents.set(eventName, handlers);
    },
    executeMethod(_name: string, _args: unknown[], callback?: () => void) {
      callback?.();
    },
  };
  const context = {
    window: {
      location: {
        origin: "http://127.0.0.1:4173",
      },
      top: {
        postMessage(message: unknown) {
          postedMessages.push(message);
        },
      },
      addEventListener() {},
      removeEventListener() {},
      Asc: {
        plugin: pluginState,
      },
    },
    document: {
      title: "",
    },
    BroadcastChannel: FakeBroadcastChannel,
    console,
    setTimeout,
    clearTimeout,
  };

  vm.runInNewContext(pluginBridgeJs, context);

  context.window.Asc.plugin.init();
  registeredEditorEvents.get("onParagraphText")?.[0]?.({
    paragraphId: "paragraph-1",
    recalcId: "recalc-1",
    text: "The hemoglobin were stable.",
  });
  FakeBroadcastChannel.latestInstance?.onmessage?.({
    data: {
      type: "proofreading-sync-annotations",
      sessionId: "preview-session-1",
      documentKey: "asset-original-1",
      issues: [
        {
          itemId: "issue-2",
          title: "主谓一致错误",
          severity: "medium",
          processed: false,
          selected: true,
          blockIndex: 1,
          quote: "The hemoglobin were stable.",
          sectionLabel: "discussion",
          anchorKey: "paragraph:discussion:1",
          anchorKind: "paragraph",
          confidence: "provided",
        },
      ],
    },
  });

  registeredEditorEvents.get("onClickAnnotation")?.[0]?.({
    paragraphId: "paragraph-1",
    ranges: ["issue-2"],
  });
  registeredEditorEvents.get("onFocusAnnotation")?.[0]?.({
    paragraphId: "paragraph-1",
    rangeId: "issue-2",
  });

  const selectionMessages = postedMessages.filter((message) => {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return false;
    }

    return (
      (message as { type?: string }).type ===
      "medsys-onlyoffice-proofreading-selection"
    );
  }) as Array<{
    sessionId: string;
    itemId: string;
    anchorKey: string;
    anchorKind: string;
    origin: string;
  }>;

  assert.deepEqual(
    selectionMessages.map((message) => message.origin),
    ["click", "focus"],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(selectionMessages[0])), {
    type: "medsys-onlyoffice-proofreading-selection",
    sessionId: "preview-session-1",
    itemId: "issue-2",
    anchorKey: "paragraph:discussion:1",
    anchorKind: "paragraph",
    origin: "click",
  });
});

test("onlyoffice locate plugin prefers the matching paragraph nearest the issue block index when duplicate text appears repeatedly", () => {
  const pluginBridgeJs = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../public/onlyoffice/proofreading-locate-plugin/plugin.js",
    ),
    "utf8",
  );

  class FakeBroadcastChannel {
    static latestInstance: FakeBroadcastChannel | null = null;

    onmessage: ((event: { data: unknown }) => void) | null = null;

    constructor(readonly name: string) {
      FakeBroadcastChannel.latestInstance = this;
    }

    close() {}
  }

  const annotateCalls: Array<Record<string, unknown>> = [];
  const registeredEditorEvents = new Map<string, Array<(payload: unknown) => void>>();
  const pluginState = {
    info: {
      options: {
        channelName: "medsys.onlyoffice.locate.preview-session-1",
        sessionId: "preview-session-1",
      },
    },
    attachEditorEvent(eventName: string, handler: (payload: unknown) => void) {
      const handlers = registeredEditorEvents.get(eventName) ?? [];
      handlers.push(handler);
      registeredEditorEvents.set(eventName, handlers);
    },
    executeMethod(name: string, args: unknown[], callback?: () => void) {
      if (name === "AnnotateParagraph") {
        annotateCalls.push(args[0] as Record<string, unknown>);
      }
      callback?.();
    },
  };
  const context = {
    window: {
      location: {
        origin: "http://127.0.0.1:4173",
      },
      top: {
        postMessage() {},
      },
      addEventListener() {},
      removeEventListener() {},
      Asc: {
        plugin: pluginState,
      },
    },
    document: {
      title: "",
    },
    BroadcastChannel: FakeBroadcastChannel,
    console,
    setTimeout,
    clearTimeout,
  };

  vm.runInNewContext(pluginBridgeJs, context);

  context.window.Asc.plugin.init();
  const paragraphHandler = registeredEditorEvents.get("onParagraphText")?.[0];
  paragraphHandler?.({
    paragraphId: "paragraph-0",
    recalcId: "recalc-0",
    text: "Repeated target text",
  });
  paragraphHandler?.({
    paragraphId: "paragraph-1",
    recalcId: "recalc-1",
    text: "Interleaving context",
  });
  paragraphHandler?.({
    paragraphId: "paragraph-2",
    recalcId: "recalc-2",
    text: "Repeated target text",
  });
  FakeBroadcastChannel.latestInstance?.onmessage?.({
    data: {
      type: "proofreading-sync-annotations",
      sessionId: "preview-session-1",
      documentKey: "asset-original-1",
      issues: [
        {
          itemId: "issue-duplicate",
          title: "重复文本定位",
          processed: false,
          selected: true,
          blockIndex: 2,
          quote: "Repeated target text",
          anchorKey: "paragraph:discussion:2",
          anchorKind: "paragraph",
          confidence: "provided",
        },
      ],
    },
  });

  assert.equal(annotateCalls.length, 1);
  assert.equal(annotateCalls[0]?.paragraphId, "paragraph-2");
});

test("onlyoffice preview surface exposes annotation sync ack telemetry on the host shell for browser-grade acceptance", () => {
  const previewSurfaceSource = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../src/features/document-preview/onlyoffice-preview-surface.tsx",
    ),
    "utf8",
  );

  assert.equal(
    previewSurfaceSource.includes("data-annotation-sync-ack-stage"),
    true,
    "The host shell must expose annotation sync stage so the browser acceptance flow can verify bridge execution without guessing inside the nested iframe.",
  );
  assert.equal(
    previewSurfaceSource.includes("data-annotation-sync-ack-applied-count"),
    true,
    "The host shell must expose how many issue marks were applied into the document surface.",
  );
  assert.equal(
    previewSurfaceSource.includes("data-annotation-sync-ack-issue-count"),
    true,
    "The host shell must expose the requested issue count so partial annotation sync stays truthful.",
  );
  assert.equal(
    previewSurfaceSource.includes("data-document-selection-item-id"),
    true,
    "The host shell must expose the last document-originated issue id so browser acceptance can verify left-to-right synchronization without guessing inside the nested iframe.",
  );
});

test("onlyoffice locate plugin keeps plugin.js in the initial html so bridge hooks are available before plugin_init arrives", () => {
  const pluginIndexHtml = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../public/onlyoffice/proofreading-locate-plugin/index.html",
    ),
    "utf8",
  );

  assert.equal(
    pluginIndexHtml.includes(
      '<script src="./plugin.js?bridgeVersion=20260425-stage2b-document-selection-sync"></script>',
    ),
    true,
    "The bridge script must be part of the initial document so it can start rebinding hooks before the ONLYOFFICE runtime sends plugin_init.",
  );
});

test("onlyoffice locate plugin config points the runtime to the current bridge version so browser refreshes do not keep stale plugin code", () => {
  const pluginConfigJson = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../public/onlyoffice/proofreading-locate-plugin/config.json",
    ),
    "utf8",
  );

  assert.equal(
    pluginConfigJson.includes(
      '"url": "index.html?bridgeVersion=20260425-stage2b-document-selection-sync"',
    ),
    true,
    "The static ONLYOFFICE plugin config must reference the current bridge version, otherwise the browser keeps loading stale iframe code even after the host shell updates.",
  );
});
