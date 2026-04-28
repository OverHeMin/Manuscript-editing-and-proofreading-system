import React from "react";
import { isLoopbackHost } from "../../lib/backend-url.ts";
import { resolveBrowserApiUrl } from "../../lib/browser-http-client.ts";
import type {
  DocumentPreviewLocateTargetViewModel,
  DocumentPreviewSessionViewModel,
} from "./types.ts";

declare global {
  interface Window {
    DocsAPI?: OnlyOfficeDocsApi;
    __medsysOnlyOfficeApiLoaders__?: Map<string, Promise<OnlyOfficeDocsApi>>;
  }
}

interface OnlyOfficeDocsApi {
  DocEditor: new (
    containerId: string,
    config: OnlyOfficeDocEditorConfig,
  ) => OnlyOfficeDocEditorInstance;
}

interface OnlyOfficeDocEditorInstance {
  destroyEditor?: () => void;
}

interface OnlyOfficePluginRegistrationConfig {
  autostart: string[];
  pluginsData: string[];
  options: Record<string, Record<string, string>>;
}

interface OnlyOfficeDocEditorConfig {
  type: "desktop";
  width: string;
  height: string;
  documentType: "word";
  document: {
    fileType: string;
    key: string;
    title: string;
    url: string;
    permissions: {
      edit: boolean;
      comment: boolean;
      review: boolean;
      download: true;
      print: true;
    };
  };
  editorConfig: {
    mode: "view" | "edit";
    lang: "zh-CN";
    callbackUrl: string;
    customization: DocumentPreviewSessionViewModel["embed"]["editor_config"]["customization"];
    plugins?: OnlyOfficePluginRegistrationConfig;
    user: {
      id: string;
      name: string;
    };
  };
  events: {
    onAppReady: () => void;
    onDocumentReady: () => void;
    onError: (event: { data?: { errorCode?: number; errorDescription?: string } }) => void;
  };
}

export interface OnlyOfficePreviewSurfaceProps {
  previewSession: DocumentPreviewSessionViewModel;
  activeLocateTarget?: DocumentPreviewLocateTargetViewModel | null;
  issueMarks?: readonly OnlyOfficeProofreadingIssueMarkViewModel[];
  onIssueSelection?(itemId: string): void;
}

export interface OnlyOfficeLocateBridgeMessage {
  type: "proofreading-locate";
  sessionId: string;
  documentKey: string;
  anchorKey: string;
  anchorKind: DocumentPreviewLocateTargetViewModel["anchorKind"];
  blockIndex: number;
  quote: string;
  sectionLabel?: string;
  confidence: DocumentPreviewLocateTargetViewModel["confidence"];
}

export interface OnlyOfficeLocateBridgeAckMessage {
  type: "medsys-onlyoffice-proofreading-locate-ack";
  sessionId: string;
  anchorKey: string;
  anchorKind: DocumentPreviewLocateTargetViewModel["anchorKind"];
  blockIndex: number;
  quote: string;
  stage: "ready" | "received" | "executed";
}

export interface OnlyOfficeProofreadingIssueMarkViewModel {
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
}

export interface OnlyOfficeIssueMarkSyncBridgeMessage {
  type: "proofreading-sync-annotations";
  sessionId: string;
  documentKey: string;
  issues: OnlyOfficeProofreadingIssueMarkViewModel[];
}

export interface OnlyOfficeIssueMarkSyncAckMessage {
  type: "medsys-onlyoffice-proofreading-annotation-sync-ack";
  sessionId: string;
  issueCount: number;
  appliedCount: number;
  stage: "requested" | "received" | "reconciled";
}

export interface OnlyOfficeIssueSelectionBridgeMessage {
  type: "medsys-onlyoffice-proofreading-selection";
  sessionId: string;
  itemId: string;
  anchorKey: string;
  anchorKind: DocumentPreviewLocateTargetViewModel["anchorKind"];
  origin: "click" | "focus";
}

interface OnlyOfficeLocateRequestInput {
  previewSession: DocumentPreviewSessionViewModel;
  locateTarget: DocumentPreviewLocateTargetViewModel;
  BroadcastChannelCtor?: new (name: string) => {
    postMessage(message: unknown): void;
    close(): void;
  };
}

interface OnlyOfficeIssueMarkSyncRequestInput {
  previewSession: DocumentPreviewSessionViewModel;
  issueMarks: readonly OnlyOfficeProofreadingIssueMarkViewModel[];
  BroadcastChannelCtor?: new (name: string) => {
    postMessage(message: unknown): void;
    close(): void;
  };
}

type OnlyOfficePreviewSurfaceState =
  | "mountable"
  | "loading"
  | "ready"
  | "error"
  | "pending_normalization";

export const ONLYOFFICE_PROOFREADING_LOCATE_PLUGIN_GUID =
  "asc.{8DFA8E84-C2C5-4F1C-8A13-5D1B4E3A9C11}";
export const ONLYOFFICE_PROOFREADING_LOCATE_PLUGIN_VERSION =
  "20260425-stage2b-document-selection-sync";

export function supportsOnlyOfficePreviewSurface(
  previewSession: DocumentPreviewSessionViewModel | null | undefined,
): boolean {
  return Boolean(
    previewSession &&
      previewSession.viewer === "onlyoffice" &&
      previewSession.embed?.provider === "onlyoffice" &&
      previewSession.status === "ready",
  );
}

export function OnlyOfficePreviewSurface({
  previewSession,
  activeLocateTarget = null,
  issueMarks = [],
  onIssueSelection,
}: OnlyOfficePreviewSurfaceProps) {
  const [surfaceState, setSurfaceState] = React.useState<OnlyOfficePreviewSurfaceState>(
    previewSession.status === "ready" ? "mountable" : "pending_normalization",
  );
  const [surfaceError, setSurfaceError] = React.useState<string | null>(null);
  const [lastLocateAck, setLastLocateAck] =
    React.useState<OnlyOfficeLocateBridgeAckMessage | null>(null);
  const [lastAnnotationSyncAck, setLastAnnotationSyncAck] =
    React.useState<OnlyOfficeIssueMarkSyncAckMessage | null>(null);
  const [lastDocumentSelection, setLastDocumentSelection] =
    React.useState<OnlyOfficeIssueSelectionBridgeMessage | null>(null);
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const hostId = React.useMemo(
    () => `onlyoffice-preview-surface-${sanitizeDomId(previewSession.session_id)}`,
    [previewSession.session_id],
  );
  const issueMarkSyncRequestSignature = React.useMemo(
    () =>
      buildOnlyOfficeIssueMarkSyncRequestSignature({
        previewSession,
        issueMarks,
      }),
    [issueMarks, previewSession],
  );

  React.useEffect(() => {
    if (!supportsOnlyOfficePreviewSurface(previewSession)) {
      setSurfaceState("pending_normalization");
      setSurfaceError(null);
      return;
    }

    let cancelled = false;
    let editor: OnlyOfficeDocEditorInstance | null = null;

    setSurfaceState("loading");
    setSurfaceError(null);

    void loadOnlyOfficeDocsApi(previewSession.embed.api_js_url)
      .then((docsApi) => {
        if (cancelled || !hostRef.current) {
          return;
        }

        hostRef.current.replaceChildren();
        const config = buildOnlyOfficeDocEditorConfig(previewSession);
        editor = new docsApi.DocEditor(hostId, {
          ...config,
          events: {
            ...config.events,
            onAppReady: () => {
              if (!cancelled) {
                setSurfaceState("ready");
              }
            },
            onDocumentReady: () => {
              if (!cancelled) {
                setSurfaceState("ready");
              }
            },
            onError: (event) => {
              if (cancelled) {
                return;
              }

              setSurfaceState("error");
              setSurfaceError(
                event.data?.errorDescription ??
                  (typeof event.data?.errorCode === "number"
                    ? `文档面加载失败（错误码 ${event.data.errorCode}）。`
                    : "文档面加载失败，请改用备用定位视图。"),
              );
            },
          },
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setSurfaceState("error");
        setSurfaceError(
          error instanceof Error ? error.message : "文档面初始化失败，请改用备用定位视图。",
        );
      });

    return () => {
      cancelled = true;
      editor?.destroyEditor?.();
      hostRef.current?.replaceChildren();
    };
  }, [
    hostId,
    previewSession,
  ]);

  React.useEffect(() => {
    setLastLocateAck(null);
    setLastAnnotationSyncAck(null);
    setLastDocumentSelection(null);
  }, [previewSession.session_id]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleBridgeAck = (event: MessageEvent<unknown>) => {
      const nextLocateAck = parseOnlyOfficeLocateBridgeAckMessage(event.data);
      if (nextLocateAck && nextLocateAck.sessionId === previewSession.session_id) {
        setLastLocateAck(nextLocateAck);
      }

      const nextAnnotationSyncAck =
        parseOnlyOfficeIssueMarkSyncAckMessage(event.data);
      if (
        nextAnnotationSyncAck &&
        nextAnnotationSyncAck.sessionId === previewSession.session_id
      ) {
        setLastAnnotationSyncAck(nextAnnotationSyncAck);
      }

      const nextDocumentSelection =
        parseOnlyOfficeIssueSelectionBridgeMessage(event.data);
      if (
        nextDocumentSelection &&
        nextDocumentSelection.sessionId === previewSession.session_id
      ) {
        setLastDocumentSelection(nextDocumentSelection);
        onIssueSelection?.(nextDocumentSelection.itemId);
      }
    };

    window.addEventListener("message", handleBridgeAck);
    return () => {
      window.removeEventListener("message", handleBridgeAck);
    };
  }, [onIssueSelection, previewSession.session_id]);

  React.useEffect(() => {
    if (
      surfaceState !== "ready" ||
      !supportsOnlyOfficePreviewSurface(previewSession) ||
      !previewSession.event_bridge.capabilities.visible_issue_marks
    ) {
      return;
    }

    if (isOnlyOfficeIssueMarkSyncAckCurrent(lastAnnotationSyncAck, issueMarks)) {
      return;
    }

    const timeoutHandles: number[] = [];
    const publishIssueMarkSyncRequest = () => {
      setLastAnnotationSyncAck((current) =>
        buildPendingOnlyOfficeIssueMarkSyncAck({
          current,
          sessionId: previewSession.session_id,
          issueCount: issueMarks.length,
        }),
      );
      postOnlyOfficeIssueMarkSyncRequest({
        previewSession,
        issueMarks,
      });
    };

    publishIssueMarkSyncRequest();
    if (typeof window !== "undefined") {
      const retrySchedule = [350, 1200, 2200, 3200];
      retrySchedule.forEach((delay) => {
        timeoutHandles.push(
          window.setTimeout(() => {
            if (isOnlyOfficeIssueMarkSyncAckCurrent(lastAnnotationSyncAck, issueMarks)) {
              return;
            }

            publishIssueMarkSyncRequest();
          }, delay),
        );
      });
    }

    return () => {
      if (typeof window === "undefined") {
        return;
      }

      timeoutHandles.forEach((handle) => window.clearTimeout(handle));
    };
  }, [
    issueMarks,
    issueMarkSyncRequestSignature,
    lastAnnotationSyncAck,
    previewSession,
    surfaceState,
  ]);

  React.useEffect(() => {
    setLastAnnotationSyncAck(null);
  }, [issueMarkSyncRequestSignature]);

  React.useEffect(() => {
    if (
      surfaceState !== "ready" ||
      !supportsOnlyOfficePreviewSurface(previewSession) ||
      !activeLocateTarget
    ) {
      return;
    }

    const requestFingerprint = buildOnlyOfficeLocateRequestFingerprint(
      previewSession,
      activeLocateTarget,
    );
    if (isOnlyOfficeLocateAckForRequest(requestFingerprint, lastLocateAck)) {
      return;
    }

    const timeoutHandles: number[] = [];
    let publishAttempts = 0;
    const publishLocateRequest = () => {
      publishAttempts += 1;
      postOnlyOfficeLocateRequest({
        previewSession,
        locateTarget: activeLocateTarget,
      });
    };

    publishLocateRequest();
    if (typeof window !== "undefined") {
      const retrySchedule = [350, 1200, 2200, 3200];
      retrySchedule.forEach((delay) => {
        timeoutHandles.push(
          window.setTimeout(() => {
            if (
              publishAttempts >= retrySchedule.length + 1 ||
              isOnlyOfficeLocateAckForRequest(requestFingerprint, lastLocateAck)
            ) {
              return;
            }

            publishLocateRequest();
          }, delay),
        );
      });
    }

    return () => {
      if (typeof window === "undefined") {
        return;
      }

      timeoutHandles.forEach((handle) => window.clearTimeout(handle));
    };
  }, [
    activeLocateTarget,
    lastLocateAck,
    previewSession,
    surfaceState,
  ]);

  return (
    <section
      className="document-preview-surface-shell"
      data-document-surface-provider={previewSession.embed.provider}
      data-document-surface-state={surfaceState}
      data-document-surface-session-id={previewSession.session_id}
      data-locate-bridge-ack-stage={lastLocateAck?.stage ?? ""}
      data-locate-bridge-ack-anchor-key={lastLocateAck?.anchorKey ?? ""}
      data-annotation-sync-ack-stage={lastAnnotationSyncAck?.stage ?? ""}
      data-annotation-sync-ack-applied-count={String(
        lastAnnotationSyncAck?.appliedCount ?? "",
      )}
      data-annotation-sync-ack-issue-count={String(
        lastAnnotationSyncAck?.issueCount ?? "",
      )}
      data-document-selection-item-id={lastDocumentSelection?.itemId ?? ""}
      data-document-selection-origin={lastDocumentSelection?.origin ?? ""}
    >
      <div className="document-preview-surface-toolbar">
        <div className="document-preview-surface-toolbar-copy">
          <strong>真实文档面</strong>
          <p>{formatSurfaceFlowCopy(previewSession)}</p>
        </div>
        <div className="document-preview-surface-toolbar-meta">
          <span>{formatSurfaceStateLabel(surfaceState)}</span>
          {activeLocateTarget ? (
            <small>{formatLocateTargetSummary(activeLocateTarget)}</small>
          ) : (
            <small>当前未选择具体问题</small>
          )}
        </div>
      </div>
      <div
        ref={hostRef}
        id={hostId}
        className="document-preview-surface-host"
      />
      {surfaceState === "error" ? (
        <p className="document-preview-surface-message is-error">
          {surfaceError ?? "文档面加载失败，请改用备用定位视图。"}
        </p>
      ) : surfaceState === "loading" ? (
        <p className="document-preview-surface-message">正在连接文档预览服务...</p>
      ) : surfaceState === "pending_normalization" ? (
        <p className="document-preview-surface-message">
          当前稿件仍在等待规范化，暂时无法挂载真实文档面。
        </p>
      ) : (
        <p className="document-preview-surface-message">
          {resolveOnlyOfficeIssueMarkSyncStatusMessage({
            visibleIssueMarksSupported:
              previewSession.event_bridge.capabilities.visible_issue_marks,
            biDirectionalSyncSupported:
              previewSession.event_bridge.capabilities.bi_directional_sync,
            ack: lastAnnotationSyncAck,
            issueMarks,
          })}
        </p>
      )}
    </section>
  );
}

export function buildOnlyOfficeDocEditorConfig(
  previewSession: DocumentPreviewSessionViewModel,
): OnlyOfficeDocEditorConfig {
  const documentUrl = attachSurfaceAccessToken(
    resolveOnlyOfficeReachableUrl(
      resolveBrowserApiUrl(previewSession.document.download_path),
    ),
    previewSession,
  );
  const callbackUrl = resolveOnlyOfficeReachableUrl(
    buildOnlyOfficeCallbackUrl(previewSession),
  );

  return {
    type: previewSession.embed.ui_type,
    width: "100%",
    height: "100%",
    documentType: previewSession.embed.document_type,
    document: {
      fileType: previewSession.document.file_extension,
      key: `${previewSession.document.document_key}-${previewSession.session_id}`,
      title: previewSession.document.file_name,
      url: documentUrl,
      permissions: previewSession.document.permissions,
    },
    editorConfig: {
      mode: previewSession.embed.editor_config.mode,
      lang: previewSession.embed.editor_config.lang,
      callbackUrl,
      customization: previewSession.embed.editor_config.customization,
      plugins: buildOnlyOfficeLocatePluginRegistration(previewSession),
      user: {
        id: `preview-${previewSession.session_id}`,
        name: "校对工作台",
      },
    },
    events: {
      onAppReady: () => undefined,
      onDocumentReady: () => undefined,
      onError: () => undefined,
    },
  };
}

function buildOnlyOfficeCallbackUrl(
  previewSession: DocumentPreviewSessionViewModel,
): string {
  const url = new URL(
    resolveBrowserApiUrl("/api/v1/document-pipeline/preview-callback"),
  );
  url.searchParams.set("sessionId", previewSession.session_id);

  if (previewSession.save_back_enabled && previewSession.save_back) {
    url.searchParams.set("saveBackModule", previewSession.save_back.module);
    url.searchParams.set(
      "baselineAssetId",
      previewSession.save_back.baseline_asset_id,
    );
    url.searchParams.set(
      "surfaceAccessToken",
      previewSession.save_back.callback_token,
    );
  }

  return url.toString();
}

function formatSurfaceFlowCopy(
  previewSession: DocumentPreviewSessionViewModel,
): string {
  if (previewSession.save_back_enabled && previewSession.save_back) {
    return "当前可在文档中完成人工复核编辑，保存后合并为当前稿件版本。";
  }

  return "当前以只读模式挂载当前稿件版本，右侧仍然是人工确认主工作面。";
}

function buildOnlyOfficeLocatePluginRegistration(
  previewSession: DocumentPreviewSessionViewModel,
): OnlyOfficePluginRegistrationConfig {
  const channelName = createOnlyOfficeLocateBridgeChannelName(previewSession.session_id);

  return {
    autostart: [ONLYOFFICE_PROOFREADING_LOCATE_PLUGIN_GUID],
    pluginsData: [resolveOnlyOfficeLocatePluginConfigUrl(previewSession.session_id)],
    options: {
      [ONLYOFFICE_PROOFREADING_LOCATE_PLUGIN_GUID]: {
        channelName,
        pluginGuid: ONLYOFFICE_PROOFREADING_LOCATE_PLUGIN_GUID,
        sessionId: previewSession.session_id,
      },
    },
  };
}

function resolveOnlyOfficeLocatePluginConfigUrl(sessionId: string): string {
  const baseOrigin =
    typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:4173";
  const resolved = new URL(
    `${baseOrigin}/onlyoffice/proofreading-locate-plugin/config.json`,
  );
  resolved.searchParams.set("sessionId", sessionId);
  resolved.searchParams.set(
    "bridgeVersion",
    ONLYOFFICE_PROOFREADING_LOCATE_PLUGIN_VERSION,
  );
  return resolved.toString();
}

export function createOnlyOfficeLocateBridgeChannelName(sessionId: string): string {
  return `medsys.onlyoffice.locate.${sanitizeDomId(sessionId)}`;
}

export function buildOnlyOfficeLocateRequestFingerprint(
  previewSession: DocumentPreviewSessionViewModel,
  locateTarget: DocumentPreviewLocateTargetViewModel,
): string {
  return [
    previewSession.session_id,
    locateTarget.anchorKey,
    locateTarget.anchorKind,
    locateTarget.blockIndex,
    locateTarget.quote.trim(),
  ].join("::");
}

export function buildOnlyOfficeLocateAckFingerprint(
  ack: OnlyOfficeLocateBridgeAckMessage,
): string {
  return [
    ack.sessionId,
    ack.anchorKey,
    ack.anchorKind,
    ack.blockIndex,
    ack.quote.trim(),
  ].join("::");
}

export function isOnlyOfficeLocateAckForRequest(
  requestFingerprint: string,
  ack: OnlyOfficeLocateBridgeAckMessage | null | undefined,
): boolean {
  return Boolean(
    ack &&
      (ack.stage === "received" || ack.stage === "executed") &&
      buildOnlyOfficeLocateAckFingerprint(ack) === requestFingerprint,
  );
}

function buildOnlyOfficeLocateBridgeMessage(
  input: OnlyOfficeLocateRequestInput,
): OnlyOfficeLocateBridgeMessage {
  return {
    type: "proofreading-locate",
    sessionId: input.previewSession.session_id,
    documentKey: input.previewSession.document.document_key,
    anchorKey: input.locateTarget.anchorKey,
    anchorKind: input.locateTarget.anchorKind,
    blockIndex: input.locateTarget.blockIndex,
    quote: input.locateTarget.quote,
    ...(input.locateTarget.sectionLabel
      ? {
          sectionLabel: input.locateTarget.sectionLabel,
        }
      : {}),
    confidence: input.locateTarget.confidence,
  };
}

function buildOnlyOfficeIssueMarkSyncBridgeMessage(
  input: OnlyOfficeIssueMarkSyncRequestInput,
): OnlyOfficeIssueMarkSyncBridgeMessage {
  return {
    type: "proofreading-sync-annotations",
    sessionId: input.previewSession.session_id,
    documentKey: input.previewSession.document.document_key,
    issues: input.issueMarks.map((issueMark) => ({
      itemId: issueMark.itemId,
      title: issueMark.title,
      ...(issueMark.severity
        ? {
            severity: issueMark.severity,
          }
        : {}),
      processed: issueMark.processed,
      selected: issueMark.selected,
      blockIndex: issueMark.blockIndex,
      quote: issueMark.quote,
      ...(issueMark.sectionLabel
        ? {
            sectionLabel: issueMark.sectionLabel,
          }
        : {}),
      anchorKey: issueMark.anchorKey,
      anchorKind: issueMark.anchorKind,
      confidence: issueMark.confidence,
    })),
  };
}

export function postOnlyOfficeLocateRequest(
  input: OnlyOfficeLocateRequestInput,
): boolean {
  const BroadcastChannelCtor =
    input.BroadcastChannelCtor ??
    (typeof BroadcastChannel === "function" ? BroadcastChannel : null);
  if (!BroadcastChannelCtor) {
    return false;
  }

  const channel = new BroadcastChannelCtor(
    createOnlyOfficeLocateBridgeChannelName(input.previewSession.session_id),
  );
  try {
    channel.postMessage(buildOnlyOfficeLocateBridgeMessage(input));
    return true;
  } finally {
    channel.close();
  }
}

export function postOnlyOfficeIssueMarkSyncRequest(
  input: OnlyOfficeIssueMarkSyncRequestInput,
): boolean {
  const BroadcastChannelCtor =
    input.BroadcastChannelCtor ??
    (typeof BroadcastChannel === "function" ? BroadcastChannel : null);
  if (
    !BroadcastChannelCtor ||
    !input.previewSession.event_bridge.capabilities.visible_issue_marks
  ) {
    return false;
  }

  const channel = new BroadcastChannelCtor(
    createOnlyOfficeLocateBridgeChannelName(input.previewSession.session_id),
  );
  try {
    channel.postMessage(buildOnlyOfficeIssueMarkSyncBridgeMessage(input));
    return true;
  } finally {
    channel.close();
  }
}

function parseOnlyOfficeLocateBridgeAckMessage(
  value: unknown,
): OnlyOfficeLocateBridgeAckMessage | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const message = value as Record<string, unknown>;
  const type = typeof message.type === "string" ? message.type : "";
  const sessionId = typeof message.sessionId === "string" ? message.sessionId.trim() : "";
  const anchorKey = typeof message.anchorKey === "string" ? message.anchorKey.trim() : "";
  const anchorKind =
    typeof message.anchorKind === "string" ? message.anchorKind.trim() : "";
  const quote = typeof message.quote === "string" ? message.quote.trim() : "";
  const stage = typeof message.stage === "string" ? message.stage.trim() : "";
  const blockIndex = message.blockIndex;

  if (
    type !== "medsys-onlyoffice-proofreading-locate-ack" ||
    sessionId.length === 0 ||
    anchorKey.length === 0 ||
    anchorKind.length === 0 ||
    quote.length === 0 ||
    (stage !== "ready" && stage !== "received" && stage !== "executed") ||
    typeof blockIndex !== "number" ||
    !Number.isInteger(blockIndex)
  ) {
    return null;
  }

  return {
    type,
    sessionId,
    anchorKey,
    anchorKind: anchorKind as DocumentPreviewLocateTargetViewModel["anchorKind"],
    blockIndex,
    quote,
    stage: stage as OnlyOfficeLocateBridgeAckMessage["stage"],
  };
}

function parseOnlyOfficeIssueMarkSyncAckMessage(
  value: unknown,
): OnlyOfficeIssueMarkSyncAckMessage | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const message = value as Record<string, unknown>;
  const type = typeof message.type === "string" ? message.type : "";
  const sessionId = typeof message.sessionId === "string" ? message.sessionId.trim() : "";
  const issueCount = message.issueCount;
  const appliedCount = message.appliedCount;
  const stage = typeof message.stage === "string" ? message.stage.trim() : "";

  if (
    type !== "medsys-onlyoffice-proofreading-annotation-sync-ack" ||
    sessionId.length === 0 ||
    typeof issueCount !== "number" ||
    !Number.isInteger(issueCount) ||
    issueCount < 0 ||
    typeof appliedCount !== "number" ||
    !Number.isInteger(appliedCount) ||
    appliedCount < 0 ||
    (stage !== "received" && stage !== "reconciled")
  ) {
    return null;
  }

  return {
    type,
    sessionId,
    issueCount,
    appliedCount,
    stage: stage as OnlyOfficeIssueMarkSyncAckMessage["stage"],
  };
}

export function parseOnlyOfficeIssueSelectionBridgeMessage(
  value: unknown,
): OnlyOfficeIssueSelectionBridgeMessage | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const message = value as Record<string, unknown>;
  const type = typeof message.type === "string" ? message.type : "";
  const sessionId = typeof message.sessionId === "string" ? message.sessionId.trim() : "";
  const itemId = typeof message.itemId === "string" ? message.itemId.trim() : "";
  const anchorKey = typeof message.anchorKey === "string" ? message.anchorKey.trim() : "";
  const anchorKind =
    typeof message.anchorKind === "string" ? message.anchorKind.trim() : "";
  const origin = typeof message.origin === "string" ? message.origin.trim() : "";

  if (
    type !== "medsys-onlyoffice-proofreading-selection" ||
    sessionId.length === 0 ||
    itemId.length === 0 ||
    anchorKey.length === 0 ||
    anchorKind.length === 0 ||
    (origin !== "click" && origin !== "focus")
  ) {
    return null;
  }

  return {
    type,
    sessionId,
    itemId,
    anchorKey,
    anchorKind: anchorKind as DocumentPreviewLocateTargetViewModel["anchorKind"],
    origin: origin as OnlyOfficeIssueSelectionBridgeMessage["origin"],
  };
}

function buildOnlyOfficeIssueMarkSyncRequestSignature(
  input: Pick<OnlyOfficeIssueMarkSyncRequestInput, "previewSession" | "issueMarks">,
): string {
  return [
    input.previewSession.session_id,
    ...input.issueMarks.map((issueMark) =>
      [
        issueMark.itemId,
        issueMark.anchorKey,
        issueMark.quote.trim(),
        issueMark.processed ? "processed" : "pending",
        issueMark.selected ? "selected" : "idle",
      ].join(":"),
    ),
  ].join("::");
}

export function buildPendingOnlyOfficeIssueMarkSyncAck(input: {
  current: OnlyOfficeIssueMarkSyncAckMessage | null | undefined;
  sessionId: string;
  issueCount: number;
}): OnlyOfficeIssueMarkSyncAckMessage {
  if (
    input.current &&
    input.current.sessionId === input.sessionId &&
    input.current.issueCount === input.issueCount &&
    (input.current.stage === "requested" || input.current.stage === "received")
  ) {
    return input.current;
  }

  return {
    type: "medsys-onlyoffice-proofreading-annotation-sync-ack",
    sessionId: input.sessionId,
    issueCount: input.issueCount,
    appliedCount: 0,
    stage: "requested",
  };
}

export function resolveOnlyOfficeIssueMarkSyncStatusMessage(input: {
  visibleIssueMarksSupported: boolean;
  biDirectionalSyncSupported?: boolean;
  ack: OnlyOfficeIssueMarkSyncAckMessage | null | undefined;
  issueMarks: readonly OnlyOfficeProofreadingIssueMarkViewModel[];
}): string {
  if (!input.visibleIssueMarksSupported) {
    return "当前已接入问题定位，左侧标记轨可查看问题分布；文内原位批注与双向同步仍在后续阶段接入。";
  }

  if (
    input.ack?.stage === "reconciled" &&
    input.ack.issueCount === input.issueMarks.length &&
    input.issueMarks.length > 0
  ) {
    if (input.ack.appliedCount === input.issueMarks.length) {
      if (input.biDirectionalSyncSupported) {
        return "当前已接入问题定位、文内问题标记与问题双向联动；左侧标记轨继续承担状态总览。";
      }

      return "当前已接入问题定位与文内问题标记；左侧标记轨继续承担状态总览。";
    }

    if (input.ack.appliedCount === 0) {
      return "文内问题标记同步已完成，但当前稿件还没有落下可见标记；左侧标记轨继续承担状态总览。";
    }

    return `文内问题标记同步已完成，但当前仅落下 ${input.ack.appliedCount}/${input.ack.issueCount} 处可见标记；左侧标记轨继续承担状态总览。`;
  }

  if (input.ack?.stage === "received") {
    return "文内问题标记同步已送达，正在等待文档面完成落位；左侧标记轨继续承担状态总览。";
  }

  return "当前已发送文内问题标记同步请求，正在等待文档面确认；左侧标记轨继续承担状态总览。";
}

function isOnlyOfficeIssueMarkSyncAckCurrent(
  ack: OnlyOfficeIssueMarkSyncAckMessage | null | undefined,
  issueMarks: readonly OnlyOfficeProofreadingIssueMarkViewModel[],
): boolean {
  return Boolean(
    ack &&
      ack.stage === "reconciled" &&
      ack.issueCount === issueMarks.length,
  );
}

async function loadOnlyOfficeDocsApi(sourceUrl: string): Promise<OnlyOfficeDocsApi> {
  if (typeof window === "undefined") {
    throw new Error("浏览器环境未就绪，无法加载真实文档面。");
  }

  if (window.DocsAPI?.DocEditor) {
    return window.DocsAPI;
  }

  const registry = window.__medsysOnlyOfficeApiLoaders__ ??= new Map<
    string,
    Promise<OnlyOfficeDocsApi>
  >();
  const existing = registry.get(sourceUrl);
  if (existing) {
    return existing;
  }

  const loader = new Promise<OnlyOfficeDocsApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[data-onlyoffice-api-source="${sourceUrl}"]`,
    );
    if (existingScript && window.DocsAPI?.DocEditor) {
      resolve(window.DocsAPI);
      return;
    }

    const script = existingScript ?? document.createElement("script");
    script.async = true;
    script.src = sourceUrl;
    script.dataset.onlyofficeApiSource = sourceUrl;
    script.onload = () => {
      if (window.DocsAPI?.DocEditor) {
        resolve(window.DocsAPI);
        return;
      }

      reject(new Error("OnlyOffice 文档脚本已加载，但未暴露 DocsAPI。"));
    };
    script.onerror = () => {
      reject(new Error("OnlyOffice 文档脚本加载失败，请检查文档服务是否可访问。"));
    };

    if (!existingScript) {
      document.head.appendChild(script);
    }
  });

  registry.set(sourceUrl, loader);
  try {
    return await loader;
  } catch (error) {
    registry.delete(sourceUrl);
    throw error;
  }
}

function resolveOnlyOfficeReachableUrl(url: string): string {
  const resolved = new URL(url);
  if (isLoopbackHost(resolved.hostname)) {
    resolved.hostname = "host.docker.internal";
  }
  return resolved.toString();
}

function attachSurfaceAccessToken(
  url: string,
  previewSession: DocumentPreviewSessionViewModel,
): string {
  if (
    previewSession.authorization.token_scheme !== "surface_session_jwt" ||
    !previewSession.authorization.access_token
  ) {
    return url;
  }

  const resolved = new URL(url);
  resolved.searchParams.set(
    "surfaceAccessToken",
    previewSession.authorization.access_token,
  );
  return resolved.toString();
}

function formatSurfaceStateLabel(state: OnlyOfficePreviewSurfaceState): string {
  if (state === "ready") {
    return "文档面就绪";
  }

  if (state === "loading" || state === "mountable") {
    return "正在挂载";
  }

  if (state === "pending_normalization") {
    return "等待规范化";
  }

  return "挂载失败";
}

function formatLocateTargetSummary(
  locateTarget: DocumentPreviewLocateTargetViewModel,
): string {
  const headline = locateTarget.sectionLabel ?? `段落 ${locateTarget.blockIndex + 1}`;
  return `${headline} · ${locateTarget.anchorKind}`;
}

function sanitizeDomId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}
