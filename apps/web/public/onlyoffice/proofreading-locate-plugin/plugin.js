(function registerProofreadingLocateBridge() {
  var PLUGIN_GUID = "asc.{8DFA8E84-C2C5-4F1C-8A13-5D1B4E3A9C11}";
  var ANNOTATION_NAME = "medsysProofreadingIssue";
  var locateChannel = null;
  var pluginState = null;
  var issueRegistry = Object.create(null);
  var annotationRegistry = Object.create(null);
  var annotationSyncState = {
    sessionId: "",
    issueCount: 0
  };
  var paragraphRegistry = [];
  var paragraphRegistryById = Object.create(null);
  var bridgeDebugState = window.__medsysProofreadingLocateBridgeDebug || {
    initCalls: 0,
    lastBoundChannelName: "",
    lastLocateMessage: null,
    lastAckMessage: null,
    lastAnnotationSyncAckMessage: null,
    lastDocumentSelectionMessage: null,
    lastIssueSyncMessage: null,
    lastParagraphSnapshot: null,
    paragraphEventBound: false
  };
  window.__medsysProofreadingLocateBridgeDebug = bridgeDebugState;

  function readPluginOptions() {
    return window.Asc && window.Asc.plugin && window.Asc.plugin.info
      ? window.Asc.plugin.info.options || {}
      : {};
  }

  function dispatchLocateAck(stage, payload) {
    if (!payload || typeof payload.sessionId !== "string" || payload.sessionId.trim().length === 0) {
      return;
    }

    var ackMessage = {
      type: "medsys-onlyoffice-proofreading-locate-ack",
      sessionId: payload.sessionId.trim(),
      anchorKey: typeof payload.anchorKey === "string" ? payload.anchorKey.trim() : "",
      anchorKind: typeof payload.anchorKind === "string" ? payload.anchorKind.trim() : "block",
      blockIndex: typeof payload.blockIndex === "number" ? payload.blockIndex : -1,
      quote: typeof payload.quote === "string" ? payload.quote.trim() : "",
      stage: stage
    };

    bridgeDebugState.lastAckMessage = ackMessage;

    try {
      window.top.postMessage(ackMessage, window.location.origin);
    } catch (_error) {
      window.top.postMessage(ackMessage, "*");
    }
  }

  function dispatchAnnotationSyncAck(stage, payload) {
    if (
      !payload ||
      typeof payload.sessionId !== "string" ||
      payload.sessionId.trim().length === 0
    ) {
      return;
    }

    var ackMessage = {
      type: "medsys-onlyoffice-proofreading-annotation-sync-ack",
      sessionId: payload.sessionId.trim(),
      issueCount:
        typeof payload.issueCount === "number" && payload.issueCount >= 0
          ? payload.issueCount
          : 0,
      appliedCount:
        typeof payload.appliedCount === "number" && payload.appliedCount >= 0
          ? payload.appliedCount
          : 0,
      stage: stage
    };

    bridgeDebugState.lastAnnotationSyncAckMessage = ackMessage;

    try {
      window.top.postMessage(ackMessage, window.location.origin);
    } catch (_error) {
      window.top.postMessage(ackMessage, "*");
    }
  }

  function dispatchDocumentIssueSelection(payload) {
    if (
      !payload ||
      typeof payload.sessionId !== "string" ||
      payload.sessionId.trim().length === 0 ||
      typeof payload.itemId !== "string" ||
      payload.itemId.trim().length === 0 ||
      typeof payload.anchorKey !== "string" ||
      payload.anchorKey.trim().length === 0 ||
      typeof payload.anchorKind !== "string" ||
      payload.anchorKind.trim().length === 0
    ) {
      return;
    }

    var selectionMessage = {
      type: "medsys-onlyoffice-proofreading-selection",
      sessionId: payload.sessionId.trim(),
      itemId: payload.itemId.trim(),
      anchorKey: payload.anchorKey.trim(),
      anchorKind: payload.anchorKind.trim(),
      origin: payload.origin === "focus" ? "focus" : "click"
    };

    bridgeDebugState.lastDocumentSelectionMessage = selectionMessage;

    try {
      window.top.postMessage(selectionMessage, window.location.origin);
    } catch (_error) {
      window.top.postMessage(selectionMessage, "*");
    }
  }

  function closeLocateChannel() {
    if (!locateChannel) {
      return;
    }

    locateChannel.close();
    locateChannel = null;
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  }

  function foldTextForSearch(value) {
    var text = typeof value === "string" ? value : "";
    var foldedCharacters = [];
    var indexMap = [];
    var previousWasWhitespace = false;

    for (var index = 0; index < text.length; index += 1) {
      var character = text.charAt(index);
      if (/\s/.test(character)) {
        if (previousWasWhitespace || foldedCharacters.length === 0) {
          previousWasWhitespace = true;
          continue;
        }

        foldedCharacters.push(" ");
        indexMap.push(index);
        previousWasWhitespace = true;
        continue;
      }

      previousWasWhitespace = false;
      foldedCharacters.push(character.toLowerCase());
      indexMap.push(index);
    }

    if (foldedCharacters.length > 0 && foldedCharacters[foldedCharacters.length - 1] === " ") {
      foldedCharacters.pop();
      indexMap.pop();
    }

    return {
      foldedText: foldedCharacters.join(""),
      indexMap: indexMap
    };
  }

  function findTextRange(text, query) {
    if (typeof text !== "string" || typeof query !== "string") {
      return null;
    }

    if (query.length === 0) {
      return null;
    }

    var directIndex = text.indexOf(query);
    if (directIndex !== -1) {
      return {
        start: directIndex,
        length: query.length
      };
    }

    var lowerText = text.toLowerCase();
    var lowerQuery = query.toLowerCase();
    var caseInsensitiveIndex = lowerText.indexOf(lowerQuery);
    if (caseInsensitiveIndex !== -1) {
      return {
        start: caseInsensitiveIndex,
        length: query.length
      };
    }

    var foldedText = foldTextForSearch(text);
    var foldedQuery = foldTextForSearch(query).foldedText;
    if (!foldedQuery) {
      return null;
    }

    var foldedIndex = foldedText.foldedText.indexOf(foldedQuery);
    if (foldedIndex === -1) {
      return null;
    }

    var startOriginalIndex = foldedText.indexMap[foldedIndex];
    var endOriginalIndex =
      foldedText.indexMap[foldedIndex + foldedQuery.length - 1] + 1;

    return {
      start: startOriginalIndex,
      length: Math.max(endOriginalIndex - startOriginalIndex, query.length)
    };
  }

  function normalizeLocateMessage(payload) {
    if (!payload || payload.type !== "proofreading-locate") {
      return null;
    }

    if (typeof payload.quote !== "string" || payload.quote.trim().length === 0) {
      return null;
    }

    return {
      sessionId: payload.sessionId || "",
      anchorKey: payload.anchorKey || "",
      anchorKind: payload.anchorKind || "block",
      blockIndex: typeof payload.blockIndex === "number" ? payload.blockIndex : -1,
      quote: payload.quote.trim()
    };
  }

  function normalizeIssueMark(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    if (
      typeof value.itemId !== "string" ||
      value.itemId.trim().length === 0 ||
      typeof value.title !== "string" ||
      value.title.trim().length === 0 ||
      typeof value.quote !== "string" ||
      value.quote.trim().length === 0 ||
      typeof value.anchorKey !== "string" ||
      value.anchorKey.trim().length === 0 ||
      typeof value.anchorKind !== "string" ||
      value.anchorKind.trim().length === 0 ||
      typeof value.blockIndex !== "number"
    ) {
      return null;
    }

    return {
      itemId: value.itemId.trim(),
      title: value.title.trim(),
      severity: typeof value.severity === "string" ? value.severity.trim() : "",
      processed: Boolean(value.processed),
      selected: Boolean(value.selected),
      blockIndex: value.blockIndex,
      quote: value.quote.trim(),
      sectionLabel: typeof value.sectionLabel === "string" ? value.sectionLabel.trim() : "",
      anchorKey: value.anchorKey.trim(),
      anchorKind: value.anchorKind.trim(),
      confidence: typeof value.confidence === "string" ? value.confidence.trim() : "fallback"
    };
  }

  function normalizeIssueSyncMessage(payload) {
    if (!payload || payload.type !== "proofreading-sync-annotations") {
      return null;
    }

    if (!Array.isArray(payload.issues)) {
      return null;
    }

    return {
      sessionId: typeof payload.sessionId === "string" ? payload.sessionId.trim() : "",
      documentKey: typeof payload.documentKey === "string" ? payload.documentKey.trim() : "",
      issues: payload.issues
        .map(normalizeIssueMark)
        .filter(Boolean)
    };
  }

  function normalizeParagraphSnapshot(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    var paragraphId =
      typeof value.paragraphId === "string"
        ? value.paragraphId.trim()
        : typeof value.id === "string"
          ? value.id.trim()
          : "";
    var recalcIdValue =
      typeof value.recalcId === "string" || typeof value.recalcId === "number"
        ? String(value.recalcId)
        : typeof value.recalcID === "string" || typeof value.recalcID === "number"
          ? String(value.recalcID)
          : "";
    var text =
      typeof value.text === "string"
        ? value.text
        : typeof value.paragraphText === "string"
          ? value.paragraphText
          : "";

    if (!paragraphId || !recalcIdValue || normalizeText(text).length === 0) {
      return null;
    }

    return {
      paragraphId: paragraphId,
      recalcId: recalcIdValue,
      text: text
    };
  }

  function updateParagraphRegistry(snapshot) {
    if (!snapshot) {
      return;
    }

    bridgeDebugState.lastParagraphSnapshot = snapshot;

    if (paragraphRegistryById[snapshot.paragraphId]) {
      paragraphRegistryById[snapshot.paragraphId] = snapshot;
      for (var index = 0; index < paragraphRegistry.length; index += 1) {
        if (paragraphRegistry[index] && paragraphRegistry[index].paragraphId === snapshot.paragraphId) {
          paragraphRegistry[index] = snapshot;
          break;
        }
      }
    } else {
      paragraphRegistryById[snapshot.paragraphId] = snapshot;
      paragraphRegistry.push(snapshot);
    }

    reconcileIssueAnnotations();
  }

  function buildAnnotationRangeObject(annotation) {
    if (!annotation) {
      return null;
    }

    return {
      paragraphId: annotation.paragraphId,
      rangeId: annotation.rangeId,
      name: annotation.name
    };
  }

  function removeAnnotationForIssueId(issueId) {
    var annotation = annotationRegistry[issueId];
    if (!annotation || !window.Asc || !window.Asc.plugin) {
      delete annotationRegistry[issueId];
      return;
    }

    try {
      window.Asc.plugin.executeMethod("RemoveAnnotationRange", [buildAnnotationRangeObject(annotation)], function () {
        delete annotationRegistry[issueId];
      });
    } catch (_error) {
      delete annotationRegistry[issueId];
    }
  }

  function removeObsoleteAnnotations(nextIssueRegistry) {
    Object.keys(annotationRegistry).forEach(function cleanupObsoleteAnnotation(issueId) {
      var nextIssue = nextIssueRegistry[issueId];
      var annotation = annotationRegistry[issueId];
      if (
        !nextIssue ||
        !annotation ||
        annotation.anchorKey !== nextIssue.anchorKey ||
        annotation.quote !== nextIssue.quote
      ) {
        removeAnnotationForIssueId(issueId);
      }
    });
  }

  function countAppliedAnnotationsForCurrentIssues() {
    return Object.keys(issueRegistry).filter(function countAppliedAnnotation(issueId) {
      return Boolean(annotationRegistry[issueId]);
    }).length;
  }

  function dispatchCurrentAnnotationSyncAck(stage) {
    dispatchAnnotationSyncAck(stage, {
      sessionId: annotationSyncState.sessionId,
      issueCount: annotationSyncState.issueCount,
      appliedCount: countAppliedAnnotationsForCurrentIssues()
    });
  }

  function findParagraphMatch(issue) {
    var normalizedQuote = normalizeText(issue.quote);
    if (!normalizedQuote) {
      return null;
    }

    var matches = [];
    for (var index = 0; index < paragraphRegistry.length; index += 1) {
      var paragraph = paragraphRegistry[index];
      if (!paragraph) {
        continue;
      }

      var matchRange = findTextRange(paragraph.text, issue.quote);
      if (matchRange) {
        matches.push({
          paragraph: paragraph,
          range: matchRange,
          paragraphOrder: index
        });
      }
    }

    if (matches.length === 0) {
      return null;
    }

    if (typeof issue.blockIndex !== "number" || issue.blockIndex < 0) {
      return matches[0];
    }

    matches.sort(function compareParagraphMatches(left, right) {
      var leftDistance = Math.abs(left.paragraphOrder - issue.blockIndex);
      var rightDistance = Math.abs(right.paragraphOrder - issue.blockIndex);
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return left.paragraphOrder - right.paragraphOrder;
    });

    return matches[0];
  }

  function annotateIssue(issue, match) {
    if (!match || !window.Asc || !window.Asc.plugin) {
      return;
    }

    var annotationData = {
      type: "highlightText",
      name: ANNOTATION_NAME,
      paragraphId: match.paragraph.paragraphId,
      recalcId: match.paragraph.recalcId,
      ranges: [
        {
          start: match.range.start,
          length: match.range.length,
          id: issue.itemId
        }
      ]
    };

    annotationRegistry[issue.itemId] = {
      paragraphId: match.paragraph.paragraphId,
      rangeId: issue.itemId,
      name: ANNOTATION_NAME,
      anchorKey: issue.anchorKey,
      quote: issue.quote
    };

    try {
      window.Asc.plugin.executeMethod("AnnotateParagraph", [annotationData], function () {});
    } catch (_error) {
      delete annotationRegistry[issue.itemId];
    }
  }

  function reconcileIssueAnnotations() {
    Object.keys(issueRegistry).forEach(function ensureAnnotation(issueId) {
      if (annotationRegistry[issueId]) {
        return;
      }

      var issue = issueRegistry[issueId];
      if (!issue) {
        return;
      }

      var paragraphMatch = findParagraphMatch(issue);
      if (!paragraphMatch) {
        return;
      }

      annotateIssue(issue, paragraphMatch);
    });

    dispatchCurrentAnnotationSyncAck("reconciled");
  }

  function syncIssueAnnotations(payload) {
    var syncMessage = normalizeIssueSyncMessage(payload);
    if (!syncMessage) {
      return;
    }

    bridgeDebugState.lastIssueSyncMessage = syncMessage;
    annotationSyncState = {
      sessionId: syncMessage.sessionId,
      issueCount: syncMessage.issues.length
    };

    var nextIssueRegistry = Object.create(null);
    syncMessage.issues.forEach(function registerIssue(issue) {
      nextIssueRegistry[issue.itemId] = issue;
    });

    removeObsoleteAnnotations(nextIssueRegistry);
    issueRegistry = nextIssueRegistry;
    reconcileIssueAnnotations();
  }

  function findAnnotationForLocate(locateMessage) {
    var issueIds = Object.keys(annotationRegistry);
    for (var index = 0; index < issueIds.length; index += 1) {
      var issueId = issueIds[index];
      var issue = issueRegistry[issueId];
      var annotation = annotationRegistry[issueId];
      if (!issue || !annotation) {
        continue;
      }

      if (
        issue.anchorKey === locateMessage.anchorKey &&
        normalizeText(issue.quote) === normalizeText(locateMessage.quote)
      ) {
        return annotation;
      }
    }

    return null;
  }

  function trySelectExistingAnnotation(locateMessage) {
    var annotation = findAnnotationForLocate(locateMessage);
    if (!annotation || !window.Asc || !window.Asc.plugin) {
      return false;
    }

    try {
      window.Asc.plugin.executeMethod("SelectAnnotationRange", [buildAnnotationRangeObject(annotation)], function () {
        dispatchLocateAck("executed", locateMessage);
      });
      return true;
    } catch (_error) {
      return false;
    }
  }

  function runLocate(payload) {
    var locateMessage = normalizeLocateMessage(payload);
    if (!locateMessage || !window.Asc || !window.Asc.plugin) {
      return;
    }

    document.title = locateMessage.anchorKey
      ? "Proofreading Locate Bridge - " + locateMessage.anchorKey
      : "Proofreading Locate Bridge - locating";
    bridgeDebugState.lastLocateMessage = locateMessage;
    dispatchLocateAck("received", locateMessage);

    if (trySelectExistingAnnotation(locateMessage)) {
      return;
    }

    window.Asc.plugin.executeMethod("MoveCursorToStart", [true], function () {
      window.Asc.plugin.executeMethod(
        "SearchNext",
        [
          {
            searchString: locateMessage.quote,
            matchCase: false
          },
          true
        ],
        function () {
          dispatchLocateAck("executed", locateMessage);
        }
      );
    });
  }

  function handleParagraphTextEvent(payload) {
    var snapshots = Array.isArray(payload) ? payload : [payload];
    snapshots.forEach(function registerParagraphSnapshot(entry) {
      updateParagraphRegistry(normalizeParagraphSnapshot(entry));
    });
  }

  function normalizeAnnotationRangeIds(payload) {
    var rawValues = [];
    if (Array.isArray(payload)) {
      rawValues = payload;
    } else if (payload && typeof payload === "object" && Array.isArray(payload.ranges)) {
      rawValues = payload.ranges;
    } else if (
      payload &&
      typeof payload === "object" &&
      (typeof payload.rangeId === "string" || typeof payload.rangeId === "number")
    ) {
      rawValues = [payload.rangeId];
    }

    return rawValues
      .map(function mapRangeId(value) {
        return typeof value === "string" || typeof value === "number"
          ? String(value).trim()
          : "";
      })
      .filter(function keepRangeId(value) {
        return value.length > 0;
      });
  }

  function resolveIssueIdFromAnnotationRange(rangeId) {
    if (typeof rangeId !== "string" || rangeId.trim().length === 0) {
      return null;
    }

    if (issueRegistry[rangeId] && annotationRegistry[rangeId]) {
      return rangeId;
    }

    var issueIds = Object.keys(annotationRegistry);
    for (var index = 0; index < issueIds.length; index += 1) {
      var issueId = issueIds[index];
      var annotation = annotationRegistry[issueId];
      if (annotation && annotation.rangeId === rangeId && issueRegistry[issueId]) {
        return issueId;
      }
    }

    return null;
  }

  function handleAnnotationSelectionEvent(payload, origin) {
    var rangeIds = normalizeAnnotationRangeIds(payload);
    if (rangeIds.length === 0) {
      return;
    }

    for (var index = 0; index < rangeIds.length; index += 1) {
      var issueId = resolveIssueIdFromAnnotationRange(rangeIds[index]);
      if (!issueId) {
        continue;
      }

      var issue = issueRegistry[issueId];
      if (!issue) {
        continue;
      }

      dispatchDocumentIssueSelection({
        sessionId: readPluginOptions().sessionId || annotationSyncState.sessionId || "",
        itemId: issueId,
        anchorKey: issue.anchorKey,
        anchorKind: issue.anchorKind,
        origin: origin
      });
      return;
    }
  }

  function bindEditorEvents() {
    if (
      bridgeDebugState.paragraphEventBound ||
      !window.Asc ||
      !window.Asc.plugin ||
      typeof window.Asc.plugin.attachEditorEvent !== "function"
    ) {
      return;
    }

    window.Asc.plugin.attachEditorEvent("onParagraphText", function onParagraphText(payload) {
      handleParagraphTextEvent(payload);
    });
    window.Asc.plugin.attachEditorEvent("onClickAnnotation", function onClickAnnotation(payload) {
      handleAnnotationSelectionEvent(payload, "click");
    });
    window.Asc.plugin.attachEditorEvent("onFocusAnnotation", function onFocusAnnotation(payload) {
      handleAnnotationSelectionEvent(payload, "focus");
    });
    bridgeDebugState.paragraphEventBound = true;
  }

  function bindLocateChannel() {
    var options = readPluginOptions();
    if (typeof BroadcastChannel !== "function" || !options.channelName) {
      return;
    }

    closeLocateChannel();
    locateChannel = new BroadcastChannel(options.channelName);
    bridgeDebugState.lastBoundChannelName = options.channelName;
    locateChannel.onmessage = function onBridgeMessage(event) {
      var syncMessage = normalizeIssueSyncMessage(event.data);
      if (syncMessage) {
        dispatchAnnotationSyncAck("received", {
          sessionId: syncMessage.sessionId,
          issueCount: syncMessage.issues.length,
          appliedCount: countAppliedAnnotationsForCurrentIssues()
        });
        syncIssueAnnotations(event.data);
        return;
      }

      runLocate(event.data);
    };
  }

  function applyPluginBridgeHooks(plugin) {
    if (!plugin) {
      return;
    }

    plugin.init = function initProofreadingLocateBridge() {
      bridgeDebugState.initCalls += 1;
      document.title = "Proofreading Locate Bridge - ready";
      bindLocateChannel();
      bindEditorEvents();
      dispatchLocateAck("ready", {
        sessionId: readPluginOptions().sessionId || "",
        anchorKey: "",
        anchorKind: "block",
        blockIndex: -1,
        quote: ""
      });
    };

    plugin.button = function noopButtonHandler() {};

    plugin.onUpdateOptions = function onUpdateOptions() {
      bindLocateChannel();
      bindEditorEvents();
    };
  }

  window.Asc = window.Asc || {};
  pluginState = window.Asc.plugin || {};

  try {
    Object.defineProperty(window.Asc, "plugin", {
      configurable: true,
      enumerable: true,
      get: function getPluginState() {
        return pluginState;
      },
      set: function setPluginState(nextPluginState) {
        pluginState = nextPluginState || {};
        applyPluginBridgeHooks(pluginState);
      }
    });
  } catch (_error) {
    // If the runtime made the property non-configurable, keep the latest visible object hooked.
  }

  window.Asc.plugin = pluginState;
  applyPluginBridgeHooks(window.Asc.plugin);

  window.addEventListener("beforeunload", closeLocateChannel);
  window.addEventListener("message", function onFallbackLocateMessage(event) {
    if (event.source !== window || !event.data || event.data.pluginGuid !== PLUGIN_GUID) {
      return;
    }

    runLocate(event.data);
  });
})();
