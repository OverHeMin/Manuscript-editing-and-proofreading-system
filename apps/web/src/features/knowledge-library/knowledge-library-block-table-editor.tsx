import type { KnowledgeContentBlockViewModel } from "./types.ts";

export interface KnowledgeLibraryBlockTableEditorProps {
  block: KnowledgeContentBlockViewModel;
  onChange: (nextBlock: KnowledgeContentBlockViewModel) => void;
}

export type TableExactCaptureFailureCode =
  | "unsupported_capture_environment"
  | "missing_required_clipboard_flavor"
  | "table_structure_incomplete"
  | "merged_cell_map_incomplete"
  | "caption_or_note_position_unknown"
  | "border_profile_incomplete"
  | "alignment_profile_incomplete"
  | "run_style_incomplete"
  | "exact_capture_not_authoritative";

type TablePositionValue = "unknown" | "above" | "below" | "inline" | "none";
type TableMergedCellState = "unknown" | "none" | "present";
type TableCaptureMode = "plain_text_grid" | "html_table_clipboard";
type TableCaptureEnvironment = "unknown" | "windows_chromium" | "unsupported";
type TableCaptureSourceApplication =
  | "unknown"
  | "word"
  | "wps"
  | "excel_or_sheet"
  | "other";

export function KnowledgeLibraryBlockTableEditor({
  block,
  onChange,
}: KnowledgeLibraryBlockTableEditorProps) {
  const rows = Array.isArray(block.content_payload.rows)
    ? (block.content_payload.rows as unknown[][])
    : [];
  const value = rows
    .map((row) =>
      Array.isArray(row)
        ? row
            .map((cell) => (typeof cell === "string" ? cell : String(cell ?? "")))
            .join("\t")
        : "",
    )
    .join("\n");
  const captureMode = readCaptureMode(block.content_payload);
  const captureEnvironment = readCaptureEnvironment(block.content_payload);
  const captureSourceApplication = readCaptureSourceApplication(block.content_payload);
  const exactCaptureFailureCodes = deriveTableExactCaptureFailureCodes({
    payload: block.content_payload,
  });
  const isExactCaptureAuthoritative = exactCaptureFailureCodes.length === 0;
  const extractedRowCount = rows.length;
  const extractedColumnCount = rows.reduce(
    (maxColumnCount, row) => Math.max(maxColumnCount, Array.isArray(row) ? row.length : 0),
    0,
  );
  const mergedCellCount = Array.isArray(block.content_payload.merged_cells)
    ? block.content_payload.merged_cells.length
    : 0;

  function commitPayload(nextPayload: Record<string, unknown>) {
    onChange({
      ...block,
      content_payload: nextPayload,
      table_semantics: buildTableBlockTableSemantics(nextPayload),
    });
  }

  return (
    <div className="knowledge-library-block-editor knowledge-library-block-table-editor">
      <label className="knowledge-library-rich-content-editor__field">
        <span>表格内容（支持直接粘贴 Excel / WPS）</span>
        <textarea
          rows={6}
          value={value}
          onPaste={(event) => {
            const clipboardTypes = Array.from(event.clipboardData?.types ?? []).filter(
              (entry) => entry.trim().length > 0,
            );
            const nextPayload = buildTableBlockContentPayloadFromClipboard({
              previousPayload: block.content_payload,
              plainText: event.clipboardData?.getData("text/plain") ?? "",
              htmlText: event.clipboardData?.getData("text/html") ?? "",
              clipboardTypes,
              captureEnvironment: detectTableClipboardCaptureEnvironment(),
            });
            event.preventDefault();
            commitPayload(nextPayload);
          }}
          onChange={(event) =>
            commitPayload(
              buildTableBlockContentPayload({
                previousPayload: block.content_payload,
                gridText: event.target.value,
              }),
            )
          }
          placeholder="直接粘贴表格内容，列之间用 Tab 分隔，换行会自动变成下一行"
        />
      </label>
      <div className="knowledge-library-rich-content-editor__field-group">
        <label className="knowledge-library-rich-content-editor__field">
          <span>采集来源</span>
          <select
            value={captureSourceApplication}
            onChange={(event) =>
              commitPayload(
                buildTableBlockContentPayload({
                  previousPayload: {
                    ...block.content_payload,
                    source_application: event.target.value,
                  },
                  gridText: value,
                }),
              )
            }
          >
            <option value="unknown">未确认</option>
            <option value="word">Word</option>
            <option value="wps">WPS</option>
            <option value="excel_or_sheet">Excel / 表格软件</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label className="knowledge-library-rich-content-editor__field">
          <span>采集模式</span>
          <input value={formatCaptureModeLabel(captureMode)} readOnly />
        </label>
        <label className="knowledge-library-rich-content-editor__field">
          <span>环境状态</span>
          <input value={formatCaptureEnvironmentLabel(captureEnvironment)} readOnly />
        </label>
      </div>
      <div className="knowledge-library-rich-content-editor__field-group">
        <label className="knowledge-library-rich-content-editor__field">
          <span>表题</span>
          <input
            value={readPayloadString(block.content_payload, "caption")}
            onChange={(event) =>
              commitPayload(
                buildTableBlockContentPayload({
                  previousPayload: {
                    ...block.content_payload,
                    caption: event.target.value,
                  },
                  gridText: value,
                }),
              )
            }
            placeholder="例如：表 1 主要终点比较"
          />
        </label>
        <label className="knowledge-library-rich-content-editor__field">
          <span>表题位置</span>
          <select
            value={readPayloadPosition(block.content_payload, "caption_position")}
            onChange={(event) =>
              commitPayload(
                buildTableBlockContentPayload({
                  previousPayload: {
                    ...block.content_payload,
                    caption_position: event.target.value,
                  },
                  gridText: value,
                }),
              )
            }
          >
            <option value="unknown">未确认</option>
            <option value="above">表上</option>
            <option value="below">表下</option>
          </select>
        </label>
      </div>
      <div className="knowledge-library-rich-content-editor__field-group">
        <label className="knowledge-library-rich-content-editor__field">
          <span>表注</span>
          <input
            value={readPayloadString(block.content_payload, "note")}
            onChange={(event) =>
              commitPayload(
                buildTableBlockContentPayload({
                  previousPayload: {
                    ...block.content_payload,
                    note: event.target.value,
                  },
                  gridText: value,
                }),
              )
            }
            placeholder="没有表注可留空，并把位置设为“无”"
          />
        </label>
        <label className="knowledge-library-rich-content-editor__field">
          <span>表注位置</span>
          <select
            value={readPayloadPosition(block.content_payload, "note_position")}
            onChange={(event) =>
              commitPayload(
                buildTableBlockContentPayload({
                  previousPayload: {
                    ...block.content_payload,
                    note_position: event.target.value,
                  },
                  gridText: value,
                }),
              )
            }
          >
            <option value="unknown">未确认</option>
            <option value="below">表下</option>
            <option value="above">表上</option>
            <option value="inline">同行</option>
            <option value="none">无</option>
          </select>
        </label>
      </div>
      <div className="knowledge-library-rich-content-editor__field-group">
        <label className="knowledge-library-rich-content-editor__field">
          <span>表头层级</span>
          <input
            value={readPayloadString(block.content_payload, "header_depth")}
            onChange={(event) =>
              commitPayload(
                buildTableBlockContentPayload({
                  previousPayload: {
                    ...block.content_payload,
                    header_depth: event.target.value,
                  },
                  gridText: value,
                }),
              )
            }
            placeholder="例如：1"
          />
        </label>
        <label className="knowledge-library-rich-content-editor__field">
          <span>桩列数量</span>
          <input
            value={readPayloadString(block.content_payload, "stub_column_count")}
            onChange={(event) =>
              commitPayload(
                buildTableBlockContentPayload({
                  previousPayload: {
                    ...block.content_payload,
                    stub_column_count: event.target.value,
                  },
                  gridText: value,
                }),
              )
            }
            placeholder="例如：1"
          />
        </label>
        <label className="knowledge-library-rich-content-editor__field">
          <span>合并单元格</span>
          <select
            value={readMergedCellState(block.content_payload)}
            onChange={(event) =>
              commitPayload(
                buildTableBlockContentPayload({
                  previousPayload: {
                    ...block.content_payload,
                    merged_cell_state: event.target.value,
                  },
                  gridText: value,
                }),
              )
            }
          >
            <option value="unknown">未确认</option>
            <option value="none">无</option>
            <option value="present">有</option>
          </select>
        </label>
      </div>
      <div className="knowledge-library-rich-content-editor__field-group">
        <label className="knowledge-library-rich-content-editor__field">
          <span>边框轮廓</span>
          <input
            value={readPayloadString(block.content_payload, "border_profile")}
            onChange={(event) =>
              commitPayload(
                buildTableBlockContentPayload({
                  previousPayload: {
                    ...block.content_payload,
                    border_profile: event.target.value,
                  },
                  gridText: value,
                }),
              )
            }
            placeholder="例如：三线表，无竖线"
          />
        </label>
        <label className="knowledge-library-rich-content-editor__field">
          <span>对齐轮廓</span>
          <input
            value={readPayloadString(block.content_payload, "alignment_profile")}
            onChange={(event) =>
              commitPayload(
                buildTableBlockContentPayload({
                  previousPayload: {
                    ...block.content_payload,
                    alignment_profile: event.target.value,
                  },
                  gridText: value,
                }),
              )
            }
            placeholder="例如：表头居中，数字右对齐"
          />
        </label>
      </div>
      <label className="knowledge-library-rich-content-editor__field">
        <span>字形强调信号</span>
        <input
          value={readPayloadString(block.content_payload, "run_style_signals")}
          onChange={(event) =>
            commitPayload(
              buildTableBlockContentPayload({
                previousPayload: {
                  ...block.content_payload,
                  run_style_signals: event.target.value,
                },
                gridText: value,
              }),
            )
          }
          placeholder="例如：拉丁字母斜体，显著性符号上标"
        />
      </label>
      <div className="knowledge-library-rich-content-editor__field-group">
        <label className="knowledge-library-rich-content-editor__field">
          <span>抽取网格</span>
          <input value={`${extractedRowCount} 行 × ${extractedColumnCount} 列`} readOnly />
        </label>
        <label className="knowledge-library-rich-content-editor__field">
          <span>合并单元格记录</span>
          <input value={`${mergedCellCount} 处`} readOnly />
        </label>
        <label className="knowledge-library-rich-content-editor__field">
          <span>是否权威 exact-capture</span>
          <input value={isExactCaptureAuthoritative ? "是" : "否"} readOnly />
        </label>
      </div>
      <div className="knowledge-library-block-editor__hint">
        <strong>Exact-capture 状态</strong>
        <p>
          当前编辑器会优先吃 HTML 表格并保留失败码。只有在 Windows + Chrome/Edge +
          Word/WPS 且关键字段完整时，才会进入权威 exact-capture。
        </p>
        <p>
          {exactCaptureFailureCodes.length > 0
            ? exactCaptureFailureCodes.join(" / ")
            : "当前表格已满足 exact-capture。"}
        </p>
      </div>
      <p className="knowledge-library-block-editor__hint">
        如果来自 Word 或 WPS，优先整块复制后直接粘贴到这里，再核对表题、表注、边框和字形信号。
      </p>
    </div>
  );
}

function parseTableRows(value: string): string[][] {
  return value
    .split(/\r?\n/)
    .filter((row) => row.trim().length > 0)
    .map((row) => row.split("\t").map((cell) => cell.trim()));
}

export function buildTableBlockContentPayloadFromClipboard(input: {
  previousPayload: Record<string, unknown>;
  plainText: string;
  htmlText?: string;
  clipboardTypes?: readonly string[];
  captureEnvironment?: TableCaptureEnvironment;
}): Record<string, unknown> {
  const clipboardTypes =
    input.clipboardTypes && input.clipboardTypes.length > 0 ? [...input.clipboardTypes] : [];
  const nextSourceApplication =
    detectTableCaptureSourceApplication({
      htmlText: input.htmlText,
      previousPayload: input.previousPayload,
    }) ?? readCaptureSourceApplication(input.previousPayload);
  const parsedHtmlTable =
    input.htmlText && input.htmlText.trim().length > 0
      ? parseClipboardHtmlTable(input.htmlText)
      : null;

  if (parsedHtmlTable) {
    const payload = {
      ...input.previousPayload,
      ...parsedHtmlTable.payloadPatch,
      capture_mode: "html_table_clipboard" as TableCaptureMode,
      clipboard_types: clipboardTypes,
      capture_environment:
        input.captureEnvironment ?? readCaptureEnvironment(input.previousPayload),
      source_application: nextSourceApplication,
    };
    return {
      ...payload,
      exact_capture_failure_codes: deriveTableExactCaptureFailureCodes({ payload }),
    };
  }

  return buildTableBlockContentPayload({
    previousPayload: {
      ...input.previousPayload,
      clipboard_types: clipboardTypes,
      capture_environment:
        input.captureEnvironment ?? readCaptureEnvironment(input.previousPayload),
      source_application: nextSourceApplication,
    },
    gridText: input.plainText,
    clipboardTypes,
  });
}

export function buildTableBlockContentPayload(input: {
  previousPayload: Record<string, unknown>;
  gridText: string;
  clipboardTypes?: readonly string[];
}): Record<string, unknown> {
  const rows = parseTableRows(input.gridText);
  const clipboardTypes =
    input.clipboardTypes && input.clipboardTypes.length > 0
      ? [...input.clipboardTypes]
      : Array.isArray(input.previousPayload.clipboard_types)
        ? input.previousPayload.clipboard_types
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
        : [];

  const payload = {
    ...input.previousPayload,
    rows,
    capture_mode:
      readCaptureMode(input.previousPayload) === "html_table_clipboard"
        ? "html_table_clipboard"
        : ("plain_text_grid" as TableCaptureMode),
    clipboard_types: clipboardTypes,
  };

  return {
    ...payload,
    exact_capture_failure_codes: deriveTableExactCaptureFailureCodes({
      payload,
    }),
  };
}

export function deriveTableExactCaptureFailureCodes(input: {
  payload: Record<string, unknown>;
}): TableExactCaptureFailureCode[] {
  const rows = Array.isArray(input.payload.rows) ? input.payload.rows : [];
  const clipboardTypes = Array.isArray(input.payload.clipboard_types)
    ? input.payload.clipboard_types.filter((entry): entry is string => typeof entry === "string")
    : [];
  const captureMode = readCaptureMode(input.payload);
  const captureEnvironment = readCaptureEnvironment(input.payload);
  const sourceApplication = readCaptureSourceApplication(input.payload);
  const failures: TableExactCaptureFailureCode[] = [];

  if (clipboardTypes.length > 0 && !clipboardTypes.some(isSupportedClipboardFlavor)) {
    failures.push("unsupported_capture_environment");
  }

  if (
    captureMode !== "html_table_clipboard" &&
    clipboardTypes.length > 0 &&
    !clipboardTypes.includes("text/html")
  ) {
    failures.push("missing_required_clipboard_flavor");
  }

  if (
    captureMode === "html_table_clipboard" &&
    (captureEnvironment !== "windows_chromium" ||
      (sourceApplication !== "word" && sourceApplication !== "wps"))
  ) {
    failures.push("unsupported_capture_environment");
  }

  if (rows.length === 0 || !rows.some((row) => Array.isArray(row) && row.length > 0)) {
    failures.push("table_structure_incomplete");
  }

  if (readMergedCellState(input.payload) === "unknown") {
    failures.push("merged_cell_map_incomplete");
  }

  if (
    readPayloadPosition(input.payload, "caption_position") === "unknown" ||
    readPayloadPosition(input.payload, "note_position") === "unknown"
  ) {
    failures.push("caption_or_note_position_unknown");
  }

  if (readPayloadString(input.payload, "border_profile").length === 0) {
    failures.push("border_profile_incomplete");
  }

  if (readPayloadString(input.payload, "alignment_profile").length === 0) {
    failures.push("alignment_profile_incomplete");
  }

  if (readPayloadString(input.payload, "run_style_signals").length === 0) {
    failures.push("run_style_incomplete");
  }

  if (!isAuthoritativeExactCapture(input.payload)) {
    failures.push("exact_capture_not_authoritative");
  }
  return Array.from(new Set(failures));
}

export function buildTableBlockTableSemantics(
  payload: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const rowCount = rows.length;
  const columnCount = rows.reduce(
    (maxColumnCount, row) => Math.max(maxColumnCount, Array.isArray(row) ? row.length : 0),
    0,
  );
  if (rowCount === 0 && columnCount === 0) {
    return undefined;
  }

  return {
    snapshot_type: "table_style_snapshot",
    capture_mode: readCaptureMode(payload),
    capture_environment: readCaptureEnvironment(payload),
    source_application: readCaptureSourceApplication(payload),
    exact_capture_authoritative: isAuthoritativeExactCapture(payload),
    exact_capture_failure_codes: deriveTableExactCaptureFailureCodes({ payload }),
    row_count: rowCount,
    column_count: columnCount,
    merged_cell_state: readMergedCellState(payload),
    merged_cells: Array.isArray(payload.merged_cells) ? payload.merged_cells : [],
    caption: {
      text: readPayloadString(payload, "caption"),
      position: readPayloadPosition(payload, "caption_position"),
    },
    note: {
      text: readPayloadString(payload, "note"),
      position: readPayloadPosition(payload, "note_position"),
    },
    header_depth: readPayloadString(payload, "header_depth"),
    stub_column_count: readPayloadString(payload, "stub_column_count"),
    border_profile: readPayloadString(payload, "border_profile"),
    alignment_profile: readPayloadString(payload, "alignment_profile"),
    run_style_signals: splitDelimitedText(readPayloadString(payload, "run_style_signals")),
  };
}

export function detectTableClipboardCaptureEnvironment(input?: {
  userAgent?: string;
  platform?: string;
}): TableCaptureEnvironment {
  const userAgent = input?.userAgent ?? globalThis.navigator?.userAgent ?? "";
  const platform = input?.platform ?? globalThis.navigator?.platform ?? "";
  if (userAgent.trim().length === 0 && platform.trim().length === 0) {
    return "unknown";
  }

  const isWindows = /windows/i.test(userAgent) || /^win/i.test(platform);
  const isChromium = /chrome\//i.test(userAgent) || /edg\//i.test(userAgent);
  return isWindows && isChromium ? "windows_chromium" : "unsupported";
}

function parseClipboardHtmlTable(html: string): {
  payloadPatch: Record<string, unknown>;
} | null {
  const tableMatch = /<table\b[\s\S]*?<\/table>/i.exec(html);
  if (!tableMatch) {
    return null;
  }

  const tableHtml = tableMatch[0];
  const beforeHtml = html.slice(0, tableMatch.index);
  const afterHtml = html.slice(tableMatch.index + tableMatch[0].length);
  const parsedTable = parseHtmlTableRows(tableHtml);
  if (!parsedTable) {
    return null;
  }

  const captionText =
    readHtmlTableCaption(tableHtml) || extractNearestTextBlock(beforeHtml) || "";
  const noteText = extractNearestTextBlock(afterHtml);
  const borderProfile = deriveBorderProfileFromHtml(tableHtml);
  const alignmentProfile = deriveAlignmentProfile(parsedTable.cells);
  const runStyleSignals = deriveRunStyleSignals(parsedTable.cells);

  return {
    payloadPatch: {
      rows: parsedTable.rows,
      caption: captionText,
      caption_position: captionText.length > 0 ? "above" : "unknown",
      note: noteText,
      note_position: noteText.length > 0 ? "below" : "none",
      header_depth: parsedTable.headerDepth > 0 ? String(parsedTable.headerDepth) : "0",
      stub_column_count:
        parsedTable.stubColumnCount > 0 ? String(parsedTable.stubColumnCount) : "0",
      merged_cell_state: parsedTable.mergedCells.length > 0 ? "present" : "none",
      merged_cells: parsedTable.mergedCells,
      border_profile: borderProfile,
      alignment_profile: alignmentProfile,
      run_style_signals: runStyleSignals.length > 0 ? runStyleSignals.join(", ") : "none",
    },
  };
}

function parseHtmlTableRows(tableHtml: string): {
  rows: string[][];
  mergedCells: Array<{ row: number; column: number; rowspan: number; colspan: number }>;
  headerDepth: number;
  stubColumnCount: number;
  cells: Array<{
    row: number;
    column: number;
    tag: "td" | "th";
    text: string;
    rowspan: number;
    colspan: number;
    alignments: string[];
    runStyleSignals: string[];
    attributesText: string;
    innerHtml: string;
  }>;
} | null {
  const rowMatches = Array.from(tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));
  if (rowMatches.length === 0) {
    return null;
  }

  const occupancy = new Set<string>();
  const rows: string[][] = [];
  const cells: Array<{
    row: number;
    column: number;
    tag: "td" | "th";
    text: string;
    rowspan: number;
    colspan: number;
    alignments: string[];
    runStyleSignals: string[];
    attributesText: string;
    innerHtml: string;
  }> = [];
  const mergedCells: Array<{ row: number; column: number; rowspan: number; colspan: number }> =
    [];

  rowMatches.forEach((rowMatch, rowIndex) => {
    const rowCells = Array.from(
      rowMatch[1].matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi),
    );
    let columnIndex = 0;
    rows[rowIndex] = rows[rowIndex] ?? [];
    for (const cellMatch of rowCells) {
      while (occupancy.has(`${rowIndex}:${columnIndex}`)) {
        rows[rowIndex][columnIndex] = rows[rowIndex][columnIndex] ?? "";
        columnIndex += 1;
      }

      const tag = cellMatch[1].toLowerCase() === "th" ? "th" : "td";
      const attributesText = cellMatch[2] ?? "";
      const innerHtml = cellMatch[3] ?? "";
      const text = normalizeWhitespace(decodeHtmlEntities(stripHtmlTags(innerHtml)));
      const rowspan = readHtmlIntegerAttribute(attributesText, "rowspan");
      const colspan = readHtmlIntegerAttribute(attributesText, "colspan");
      const alignments = extractCellAlignments(attributesText);
      const runStyleSignals = extractRunStyleSignals(attributesText, innerHtml);

      rows[rowIndex][columnIndex] = text;
      for (let rowOffset = 0; rowOffset < rowspan; rowOffset += 1) {
        const targetRow = rowIndex + rowOffset;
        rows[targetRow] = rows[targetRow] ?? [];
        for (let columnOffset = 0; columnOffset < colspan; columnOffset += 1) {
          const targetColumn = columnIndex + columnOffset;
          if (rowOffset === 0 && columnOffset === 0) {
            continue;
          }
          occupancy.add(`${targetRow}:${targetColumn}`);
          rows[targetRow][targetColumn] = rows[targetRow][targetColumn] ?? "";
        }
      }

      if (rowspan > 1 || colspan > 1) {
        mergedCells.push({
          row: rowIndex,
          column: columnIndex,
          rowspan,
          colspan,
        });
      }

      cells.push({
        row: rowIndex,
        column: columnIndex,
        tag,
        text,
        rowspan,
        colspan,
        alignments,
        runStyleSignals,
        attributesText,
        innerHtml,
      });
      columnIndex += colspan;
    }
  });

  const normalizedRows = rows.map((row) => [...row]);
  const maxColumnCount = normalizedRows.reduce(
    (count, row) => Math.max(count, row.length),
    0,
  );
  const paddedRows = normalizedRows.map((row) => {
    while (row.length < maxColumnCount) {
      row.push("");
    }
    return row;
  });
  const headerDepth = countHeaderRows(cells, rowMatches.length);
  return {
    rows: paddedRows,
    mergedCells,
    headerDepth,
    stubColumnCount: deriveStubColumnCount(cells, headerDepth),
    cells,
  };
}

function countHeaderRows(
  cells: Array<{ row: number; tag: "td" | "th" }>,
  rowCount: number,
): number {
  let headerDepth = 0;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const rowCells = cells.filter((cell) => cell.row === rowIndex);
    if (rowCells.length === 0 || rowCells.some((cell) => cell.tag !== "th")) {
      break;
    }
    headerDepth += 1;
  }
  return headerDepth;
}

function deriveStubColumnCount(
  cells: Array<{ row: number; column: number; tag: "td" | "th"; attributesText: string }>,
  headerDepth: number,
): number {
  let stubColumnCount = 0;
  while (stubColumnCount < 12) {
    const hasStubSignal = cells.some(
      (cell) =>
        cell.row >= headerDepth &&
        cell.column === stubColumnCount &&
        (cell.tag === "th" || /scope\s*=\s*["']?row/i.test(cell.attributesText)),
    );
    if (!hasStubSignal) {
      break;
    }
    stubColumnCount += 1;
  }
  return stubColumnCount;
}

function readHtmlTableCaption(tableHtml: string): string {
  const match = /<caption\b[^>]*>([\s\S]*?)<\/caption>/i.exec(tableHtml);
  return match ? normalizeWhitespace(decodeHtmlEntities(stripHtmlTags(match[1] ?? ""))) : "";
}

function extractNearestTextBlock(html: string): string {
  const blockMatches = Array.from(
    html.matchAll(/<(p|div|span|li)\b[^>]*>([\s\S]*?)<\/\1>/gi),
  )
    .map((match) => normalizeWhitespace(decodeHtmlEntities(stripHtmlTags(match[2] ?? ""))))
    .filter((text) => text.length > 0);
  return blockMatches.at(-1) ?? "";
}

function deriveBorderProfileFromHtml(tableHtml: string): string {
  const normalizedHtml = tableHtml.toLowerCase();
  const hasTopBorder = /border-top[^:]*:\s*[^;]*(solid|single|1px|medium)/i.test(normalizedHtml);
  const hasBottomBorder = /border-bottom[^:]*:\s*[^;]*(solid|single|1px|medium)/i.test(
    normalizedHtml,
  );
  const hasVerticalBorder = /border-(left|right)[^:]*:\s*[^;]*(solid|single|1px|medium)/i.test(
    normalizedHtml,
  );
  const hasHeaderDivider = /border-bottom[^:]*:\s*[^;]*(solid|single|1px|medium)/i.test(
    normalizedHtml.replace(/<thead[\s\S]*?<\/thead>/i, ""),
  );

  if (!hasTopBorder && !hasBottomBorder && !hasVerticalBorder && !hasHeaderDivider) {
    return "";
  }

  const parts = [
    hasTopBorder ? "顶线" : "无顶线",
    hasHeaderDivider ? "表头分隔线" : "无表头分隔线",
    hasBottomBorder ? "底线" : "无底线",
    hasVerticalBorder ? "有竖线" : "无竖线",
  ];
  return parts.join("，");
}

function deriveAlignmentProfile(
  cells: Array<{ row: number; alignments: string[]; text: string; tag: "td" | "th" }>,
): string {
  const headerAlignments = new Set<string>();
  const bodyAlignments = new Set<string>();
  for (const cell of cells) {
    const alignments = cell.alignments.length > 0 ? cell.alignments : [inferTextAlignment(cell.text)];
    if (cell.tag === "th") {
      alignments.forEach((alignment) => headerAlignments.add(alignment));
    } else {
      alignments.forEach((alignment) => bodyAlignments.add(alignment));
    }
  }

  const parts: string[] = [];
  if (headerAlignments.size > 0) {
    parts.push(`表头${[...headerAlignments].join("/")}`);
  }
  if (bodyAlignments.size > 0) {
    parts.push(`正文${[...bodyAlignments].join("/")}`);
  }
  return parts.join("，");
}

function inferTextAlignment(text: string): string {
  return /^[0-9.%+\-–—]+$/.test(text.trim()) ? "右对齐" : "左对齐";
}

function deriveRunStyleSignals(
  cells: Array<{ runStyleSignals: string[] }>,
): string[] {
  const signals = new Set<string>();
  for (const cell of cells) {
    cell.runStyleSignals.forEach((signal) => signals.add(signal));
  }
  return [...signals];
}

function extractCellAlignments(attributesText: string): string[] {
  const alignments = new Set<string>();
  const attributeAlignment = /align\s*=\s*["']?([^"'\s>]+)/i.exec(attributesText)?.[1];
  if (attributeAlignment) {
    alignments.add(normalizeAlignmentLabel(attributeAlignment));
  }
  const styleAttribute = /style\s*=\s*["']([^"']*)["']/i.exec(attributesText)?.[1] ?? "";
  for (const match of styleAttribute.matchAll(/text-align\s*:\s*([^;]+)/gi)) {
    alignments.add(normalizeAlignmentLabel(match[1] ?? ""));
  }
  return [...alignments].filter((alignment) => alignment.length > 0);
}

function normalizeAlignmentLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "center":
      return "居中";
    case "right":
      return "右对齐";
    case "justify":
      return "两端对齐";
    case "left":
    default:
      return "左对齐";
  }
}

function extractRunStyleSignals(attributesText: string, innerHtml: string): string[] {
  const styleAttribute = /style\s*=\s*["']([^"']*)["']/i.exec(attributesText)?.[1] ?? "";
  const signals = new Set<string>();
  if (/<(i|em)\b/i.test(innerHtml) || /font-style\s*:\s*italic/i.test(styleAttribute)) {
    signals.add("斜体");
  }
  if (
    /<(b|strong)\b/i.test(innerHtml) ||
    /font-weight\s*:\s*(bold|700|800|900)/i.test(styleAttribute)
  ) {
    signals.add("粗体");
  }
  if (/<sup\b/i.test(innerHtml) || /vertical-align\s*:\s*super/i.test(styleAttribute)) {
    signals.add("上标");
  }
  if (/<sub\b/i.test(innerHtml) || /vertical-align\s*:\s*sub/i.test(styleAttribute)) {
    signals.add("下标");
  }
  return [...signals];
}

function readHtmlIntegerAttribute(attributesText: string, name: string): number {
  const matched = new RegExp(`${name}\\s*=\\s*["']?(\\d+)`, "i").exec(attributesText)?.[1];
  const value = Number(matched);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function stripHtmlTags(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|nbsp|lt|gt|amp|quot);/gi, (entity, token) => {
    const normalizedToken = String(token).toLowerCase();
    switch (normalizedToken) {
      case "nbsp":
        return " ";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "amp":
        return "&";
      case "quot":
        return '"';
      default:
        if (normalizedToken.startsWith("#x")) {
          return String.fromCodePoint(Number.parseInt(normalizedToken.slice(2), 16));
        }
        if (normalizedToken.startsWith("#")) {
          return String.fromCodePoint(Number.parseInt(normalizedToken.slice(1), 10));
        }
        return entity;
    }
  });
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitDelimitedText(value: string): string[] {
  return value
    .split(/[，,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function readCaptureMode(payload: Record<string, unknown>): TableCaptureMode {
  return payload["capture_mode"] === "html_table_clipboard"
    ? "html_table_clipboard"
    : "plain_text_grid";
}

function readCaptureEnvironment(payload: Record<string, unknown>): TableCaptureEnvironment {
  const value = payload["capture_environment"];
  return value === "windows_chromium" || value === "unsupported" || value === "unknown"
    ? value
    : "unknown";
}

function readCaptureSourceApplication(
  payload: Record<string, unknown>,
): TableCaptureSourceApplication {
  const value = payload["source_application"];
  return value === "word" ||
    value === "wps" ||
    value === "excel_or_sheet" ||
    value === "other" ||
    value === "unknown"
    ? value
    : "unknown";
}

function detectTableCaptureSourceApplication(input: {
  htmlText?: string;
  previousPayload: Record<string, unknown>;
}): TableCaptureSourceApplication | null {
  const currentValue = readCaptureSourceApplication(input.previousPayload);
  if (currentValue !== "unknown") {
    return currentValue;
  }

  const htmlText = input.htmlText?.trim() ?? "";
  if (htmlText.length === 0) {
    return null;
  }

  if (/class\s*=\s*["'][^"']*mso|urn:schemas-microsoft-com:office:word|mso-/i.test(htmlText)) {
    return "word";
  }

  if (/wps-|kingsoft|etapplication/i.test(htmlText)) {
    return "wps";
  }

  return null;
}

function isAuthoritativeExactCapture(payload: Record<string, unknown>): boolean {
  return (
    readCaptureMode(payload) === "html_table_clipboard" &&
    readCaptureEnvironment(payload) === "windows_chromium" &&
    (readCaptureSourceApplication(payload) === "word" ||
      readCaptureSourceApplication(payload) === "wps") &&
    readMergedCellState(payload) !== "unknown" &&
    readPayloadPosition(payload, "caption_position") !== "unknown" &&
    readPayloadPosition(payload, "note_position") !== "unknown" &&
    readPayloadString(payload, "border_profile").length > 0 &&
    readPayloadString(payload, "alignment_profile").length > 0 &&
    readPayloadString(payload, "run_style_signals").length > 0 &&
    Array.isArray(payload.rows) &&
    payload.rows.length > 0
  );
}

function formatCaptureModeLabel(value: TableCaptureMode): string {
  return value === "html_table_clipboard" ? "HTML 表格采集" : "纯文本网格";
}

function formatCaptureEnvironmentLabel(value: TableCaptureEnvironment): string {
  switch (value) {
    case "windows_chromium":
      return "Windows + Chrome/Edge";
    case "unsupported":
      return "当前环境不在支持路径";
    case "unknown":
    default:
      return "尚未识别";
  }
}

function readPayloadString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function readPayloadPosition(payload: Record<string, unknown>, key: string): TablePositionValue {
  const value = payload[key];
  return value === "above" ||
    value === "below" ||
    value === "inline" ||
    value === "none" ||
    value === "unknown"
    ? value
    : "unknown";
}

function readMergedCellState(payload: Record<string, unknown>): TableMergedCellState {
  const value = payload["merged_cell_state"];
  return value === "none" || value === "present" || value === "unknown" ? value : "unknown";
}

function isSupportedClipboardFlavor(value: string): boolean {
  return value === "text/html" || value === "text/plain" || value === "text/rtf";
}
