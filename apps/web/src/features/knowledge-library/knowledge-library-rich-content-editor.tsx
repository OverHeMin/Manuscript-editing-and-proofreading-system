import { useState } from "react";
import {
  bindTableEvidenceRevision,
  confirmTableEvidenceRevision,
  saveTableEvidenceCorrectionPatch,
  TableEvidencePicker,
  TableEvidenceWorkspace,
  type TableEvidenceBindingRole,
  type TableEvidenceBindingTargetType,
  type TableCorrectionPatch,
  type TableEvidenceAsset,
  type TableEvidenceHttpClient,
  type TableEvidencePickerItem,
  type TableEvidenceRevision,
  type TableSourceSnapshot,
  TableEvidenceUploadEntry,
  type ConfirmedAiTablePackage,
  type CreateTableEvidenceFromDocxUploadResponse,
} from "../table-evidence/index.ts";
import { KnowledgeLibraryBlockImageEditor } from "./knowledge-library-block-image-editor.tsx";
import { KnowledgeLibraryBlockTableEditor } from "./knowledge-library-block-table-editor.tsx";
import type {
  KnowledgeContentBlockType,
  KnowledgeContentBlockViewModel,
  KnowledgeTableEvidenceBlockPayload,
  KnowledgeUploadInput,
  KnowledgeUploadViewModel,
} from "./types.ts";

export interface KnowledgeTableEvidenceBlockSelection {
  assetId: string;
  revisionId: string;
  revisionStatus?: KnowledgeTableEvidenceBlockPayload["revision_status"];
  confirmedTablePackage?: ConfirmedAiTablePackage;
}

export interface KnowledgeLibraryUploadedTableEvidenceSelection {
  asset: TableEvidenceAsset;
  revision: TableEvidenceRevision;
  table: TableSourceSnapshot;
}

export interface AppendKnowledgeLibraryTableEvidenceBlockInput {
  blocks: readonly KnowledgeContentBlockViewModel[];
  selection: KnowledgeTableEvidenceBlockSelection;
  currentRevisionId?: string;
  client?: TableEvidenceHttpClient;
  tableEvidenceBindingTargetType?: TableEvidenceBindingTargetType;
  tableEvidenceBindingRole?: TableEvidenceBindingRole;
}

export type KnowledgeLibraryContentBlockAction =
  | "add-text"
  | "add-table"
  | "add-table-evidence"
  | "add-image";

export interface CreateKnowledgeLibraryContentBlockForActionInput {
  blocks: readonly KnowledgeContentBlockViewModel[];
  action: KnowledgeLibraryContentBlockAction;
  currentRevisionId?: string;
}

export interface HandleKnowledgeLibraryTableEvidenceSelectionInput
  extends AppendKnowledgeLibraryTableEvidenceBlockInput {
  onChange: (blocks: KnowledgeContentBlockViewModel[]) => void;
  onError: (message: string) => void;
  onTableEvidenceBlockAdded?: (block: KnowledgeContentBlockViewModel) => void;
}

export interface KnowledgeLibraryRichContentEditorProps {
  blocks: readonly KnowledgeContentBlockViewModel[];
  onChange: (blocks: KnowledgeContentBlockViewModel[]) => void;
  onUploadImage?: (input: KnowledgeUploadInput) => Promise<KnowledgeUploadViewModel | void>;
  tableEvidenceClient?: TableEvidenceHttpClient;
  tableEvidencePickerItems?: TableEvidencePickerItem[];
  currentRevisionId?: string;
  tableEvidenceBindingTargetType?: TableEvidenceBindingTargetType;
  tableEvidenceBindingRole?: TableEvidenceBindingRole;
  onTableEvidenceBlockAdded?: (block: KnowledgeContentBlockViewModel) => void;
  compact?: boolean;
}

export function KnowledgeLibraryRichContentEditor({
  blocks,
  onChange,
  onUploadImage,
  tableEvidenceClient,
  tableEvidencePickerItems = [],
  currentRevisionId,
  tableEvidenceBindingTargetType = "knowledge_revision",
  tableEvidenceBindingRole = "source_evidence",
  onTableEvidenceBlockAdded,
  compact = false,
}: KnowledgeLibraryRichContentEditorProps) {
  const [isTableEvidenceOpen, setIsTableEvidenceOpen] = useState(false);
  const [tableEvidenceErrorMessage, setTableEvidenceErrorMessage] = useState<string | null>(
    null,
  );
  const [
    uploadedTableEvidenceSelections,
    setUploadedTableEvidenceSelections,
  ] = useState<KnowledgeLibraryUploadedTableEvidenceSelection[]>([]);
  const [selectedUploadedTableId, setSelectedUploadedTableId] = useState<string | null>(null);
  const tableEvidenceClientState =
    tableEvidenceClient || tableEvidencePickerItems.length > 0 ? "available" : "unavailable";
  const selectedUploadedTableEvidence =
    uploadedTableEvidenceSelections.find(
      (selection) => selection.table.table_id === selectedUploadedTableId,
    ) ?? uploadedTableEvidenceSelections[0];

  async function appendTableEvidenceBlock(selection: KnowledgeTableEvidenceBlockSelection) {
    await handleKnowledgeLibraryTableEvidenceSelection({
      blocks,
      selection,
      currentRevisionId,
      client: tableEvidenceClient,
      tableEvidenceBindingTargetType,
      tableEvidenceBindingRole,
      onChange,
      onError: setTableEvidenceErrorMessage,
      onTableEvidenceBlockAdded,
    });
  }

  function replaceUploadedTableEvidenceRevision(
    tableId: string,
    revision: TableEvidenceRevision,
  ) {
    setUploadedTableEvidenceSelections((current) =>
      current.map((selection) =>
        selection.table.table_id === tableId
          ? {
              ...selection,
              asset: {
                ...selection.asset,
                active_revision_id: revision.id,
                fidelity_status: revision.fidelity_report.status,
              },
              revision,
              table: revision.source_snapshot,
            }
          : selection,
      ),
    );
    setSelectedUploadedTableId(revision.source_snapshot.table_id);
  }

  async function saveUploadedTableEvidencePatch(
    selection: KnowledgeLibraryUploadedTableEvidenceSelection,
    patch: TableCorrectionPatch,
  ): Promise<TableEvidenceRevision> {
    if (!tableEvidenceClient) {
      throw new Error("Word 表格证据客户端不可用");
    }

    const response = await saveTableEvidenceCorrectionPatch(
      tableEvidenceClient,
      selection.revision.id,
      { patch },
    );
    replaceUploadedTableEvidenceRevision(selection.table.table_id, response.body);
    return response.body;
  }

  async function confirmUploadedTableEvidenceRevision(input: {
    selection: KnowledgeLibraryUploadedTableEvidenceSelection;
    revisionId: string;
    invisibleCharsConfirmed: boolean;
    specialSymbolsConfirmed: boolean;
  }): Promise<void> {
    if (!tableEvidenceClient) {
      throw new Error("Word 表格证据客户端不可用");
    }

    try {
      const response = await confirmTableEvidenceRevision(tableEvidenceClient, input.revisionId, {
        confirmations: {
          invisibleCharsConfirmed: input.invisibleCharsConfirmed,
          specialSymbolsConfirmed: input.specialSymbolsConfirmed,
        },
      });
      const confirmedRevision = response.body;
      replaceUploadedTableEvidenceRevision(input.selection.table.table_id, confirmedRevision);
      await appendTableEvidenceBlock({
        assetId: confirmedRevision.table_evidence_asset_id,
        revisionId: confirmedRevision.id,
        revisionStatus: confirmedRevision.confirmation_status,
        confirmedTablePackage: confirmedRevision.ai_table_package,
      });
    } catch (error) {
      setTableEvidenceErrorMessage(
        error instanceof Error ? error.message : "表格证据确认失败",
      );
    }
  }

  return (
    <section
      className="knowledge-library-rich-content-editor"
      data-material-editor="blocks"
    >
      <header className="knowledge-library-rich-content-editor__header">
        <div>
          <h3>内容材料</h3>
          {compact ? null : (
            <p>按块组织正文、表格与图片，先选块类型再录入，避免把图表挤进正文里。</p>
          )}
        </div>
      </header>

      {compact ? null : (
        <div className="knowledge-library-rich-content-editor__guidance">
          <p>Word 表格证据用于接入已确认的表格资产。</p>
          <p>图片块可以上传截图、图表或扫描件，上传后再补充图片说明。</p>
          <p>如果只想补充图注、表注或规则备注，用“添加补充文字”就可以。</p>
        </div>
      )}

      <div className="knowledge-library-rich-content-editor__actions">
        <button
          type="button"
          data-block-action="add-text"
          onClick={() => {
            const nextBlock = createKnowledgeLibraryContentBlockForAction({
              blocks,
              action: "add-text",
              currentRevisionId,
            });
            if (nextBlock) {
              onChange([...blocks, nextBlock]);
            }
          }}
        >
          添加补充文字
        </button>
        <button
          type="button"
          data-block-action="add-table-evidence"
          onClick={() => setIsTableEvidenceOpen((current) => !current)}
        >
          Word 表格证据
        </button>
        <button
          type="button"
          data-block-action="add-image"
          onClick={() => {
            const nextBlock = createKnowledgeLibraryContentBlockForAction({
              blocks,
              action: "add-image",
              currentRevisionId,
            });
            if (nextBlock) {
              onChange([...blocks, nextBlock]);
            }
          }}
        >
          添加图片或截图
        </button>
      </div>

      <div
        className="knowledge-library-rich-content-editor__table-evidence"
        data-table-evidence-client-state={tableEvidenceClientState}
      >
        {tableEvidenceErrorMessage ? (
          <p role="alert">{tableEvidenceErrorMessage}</p>
        ) : null}

        {isTableEvidenceOpen && !tableEvidenceClient && tableEvidencePickerItems.length === 0 ? (
          <p>Word 表格证据需要连接表格证据客户端或提供已确认证据列表后才能添加。</p>
        ) : null}

        {isTableEvidenceOpen && tableEvidenceClient ? (
          <TableEvidenceUploadEntry
            client={tableEvidenceClient}
            onCreated={(response) => {
              const selections =
                getKnowledgeLibraryUploadedTableEvidenceSelections(response);
              setUploadedTableEvidenceSelections(selections);
              const firstSelection = selections[0];
              setSelectedUploadedTableId(firstSelection?.table.table_id ?? null);
              if (!firstSelection) {
                setTableEvidenceErrorMessage("未识别到可用的 Word 表格证据");
                return;
              }
              setTableEvidenceErrorMessage(null);
            }}
            onSelectTable={setSelectedUploadedTableId}
            selectedTableId={selectedUploadedTableId ?? undefined}
          />
        ) : null}

        {isTableEvidenceOpen && tableEvidenceClient && selectedUploadedTableEvidence ? (
          <TableEvidenceWorkspace
            asset={selectedUploadedTableEvidence.asset}
            bindingRole={tableEvidenceBindingRole}
            bindingTargetId={currentRevisionId}
            bindingTargetLabel={formatTableEvidenceBindingTargetLabel(
              tableEvidenceBindingTargetType,
            )}
            bindingTargetType={tableEvidenceBindingTargetType}
            key={selectedUploadedTableEvidence.revision.id}
            revision={selectedUploadedTableEvidence.revision}
            onSavePatch={(patch) =>
              saveUploadedTableEvidencePatch(selectedUploadedTableEvidence, patch)
            }
            onConfirm={(input) =>
              confirmUploadedTableEvidenceRevision({
                selection: selectedUploadedTableEvidence,
                ...input,
              })
            }
            onBind={(input) =>
              bindTableEvidenceRevision(tableEvidenceClient, input).then(() => undefined)
            }
          />
        ) : null}

        {isTableEvidenceOpen && tableEvidencePickerItems.length > 0 ? (
          <TableEvidencePicker
            items={tableEvidencePickerItems}
            onPick={(selection) => {
              const pickedItem = tableEvidencePickerItems.find(
                (item) =>
                  item.asset.id === selection.assetId &&
                  item.revision.id === selection.revisionId,
              );
              void appendTableEvidenceBlock({
                ...selection,
                revisionStatus: pickedItem?.revision.confirmation_status,
                confirmedTablePackage: pickedItem?.revision.ai_table_package,
              });
            }}
          />
        ) : null}
      </div>

      <div className="knowledge-library-rich-content-editor__list">
        {blocks.length === 0 ? (
          <p className="knowledge-library-rich-content-editor__empty">
            {compact
              ? "暂无证据材料。"
              : "还没有证据材料，可以先添加 Word 表格证据、图片或补充文字。"}
          </p>
        ) : null}

        {blocks.map((block, index) => (
          <article
            key={block.id}
            className="knowledge-library-rich-content-editor__item"
            data-block-type={block.block_type}
          >
            <header className="knowledge-library-rich-content-editor__item-header">
              <div>
                <strong>{formatBlockTitle(block.block_type)}</strong>
                <small>第 {index + 1} 块</small>
              </div>
              <div className="knowledge-library-rich-content-editor__item-actions">
                <button
                  type="button"
                  data-block-action="move-up"
                  onClick={() => onChange(moveBlock(blocks, index, -1))}
                  disabled={index === 0}
                >
                  上移
                </button>
                <button
                  type="button"
                  data-block-action="move-down"
                  onClick={() => onChange(moveBlock(blocks, index, 1))}
                  disabled={index === blocks.length - 1}
                >
                  下移
                </button>
                <button
                  type="button"
                  data-block-action="remove"
                  onClick={() => onChange(removeBlock(blocks, block.id))}
                >
                  删除
                </button>
              </div>
            </header>

            {block.block_type === "text_block" ? (
              <label className="knowledge-library-rich-content-editor__field">
                <span>文字内容</span>
                <textarea
                  rows={5}
                  value={
                    typeof block.content_payload.text === "string"
                      ? block.content_payload.text
                      : ""
                  }
                  onChange={(event) =>
                    onChange(
                      replaceBlock(blocks, {
                        ...block,
                        content_payload: {
                          ...block.content_payload,
                          text: event.target.value,
                        },
                      }),
                    )
                  }
                  placeholder="输入或粘贴正文材料"
                />
              </label>
            ) : null}

            {block.block_type === "table_block" ? (
              <KnowledgeLibraryBlockTableEditor
                block={block}
                onChange={(nextBlock) => onChange(replaceBlock(blocks, nextBlock))}
              />
            ) : null}

            {block.block_type === "image_block" ? (
              <KnowledgeLibraryBlockImageEditor
                block={block}
                onChange={(nextBlock) => onChange(replaceBlock(blocks, nextBlock))}
                onUploadImage={onUploadImage}
              />
            ) : null}

            {block.block_type === "table_evidence_block" ? (
              <KnowledgeLibraryTableEvidenceBlockSummary block={block} />
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function createKnowledgeLibraryContentBlockForAction({
  blocks,
  action,
  currentRevisionId,
}: CreateKnowledgeLibraryContentBlockForActionInput): KnowledgeContentBlockViewModel | null {
  switch (action) {
    case "add-text":
      return createKnowledgeLibraryContentBlock(blocks, "text_block", currentRevisionId);
    case "add-table":
      return null;
    case "add-image":
      return createKnowledgeLibraryContentBlock(blocks, "image_block", currentRevisionId);
    case "add-table-evidence":
      return null;
  }
}

export function getKnowledgeLibraryUploadedTableEvidenceSelections(
  response: CreateTableEvidenceFromDocxUploadResponse,
): KnowledgeLibraryUploadedTableEvidenceSelection[] {
  const assetsById = new Map(response.assets.map((asset) => [asset.id, asset]));
  assetsById.set(response.asset.id, response.asset);

  const revisionsByTableId = new Map<string, TableEvidenceRevision>();
  for (const revision of response.revisions) {
    revisionsByTableId.set(revision.source_snapshot.table_id, revision);
  }

  const selections: KnowledgeLibraryUploadedTableEvidenceSelection[] = [];
  const seenRevisionIds = new Set<string>();
  for (const table of response.tables) {
    const revision = revisionsByTableId.get(table.table_id);
    if (!revision) {
      continue;
    }

    const asset = assetsById.get(revision.table_evidence_asset_id);
    if (!asset) {
      continue;
    }

    selections.push({ asset, revision, table });
    seenRevisionIds.add(revision.id);
  }

  for (const revision of response.revisions) {
    if (seenRevisionIds.has(revision.id)) {
      continue;
    }

    const asset = assetsById.get(revision.table_evidence_asset_id);
    if (!asset) {
      continue;
    }

    selections.push({
      asset,
      revision,
      table: revision.source_snapshot,
    });
  }

  return selections;
}

function createKnowledgeLibraryContentBlock(
  blocks: readonly KnowledgeContentBlockViewModel[],
  blockType: Exclude<KnowledgeContentBlockType, "table_evidence_block">,
  currentRevisionId?: string,
): KnowledgeContentBlockViewModel {
  const nextOrder = blocks.length;
  const revisionId = currentRevisionId ?? blocks[0]?.revision_id ?? "draft-revision";

  return {
    id: `block-${nextOrder + 1}`,
    revision_id: revisionId,
    block_type: blockType,
    order_no: nextOrder,
    status: "active",
    content_payload:
      blockType === "table_block"
        ? { rows: [["列 1", "列 2"]] }
        : blockType === "image_block"
          ? {}
          : { text: "" },
  };
}

function replaceBlock(
  blocks: readonly KnowledgeContentBlockViewModel[],
  nextBlock: KnowledgeContentBlockViewModel,
): KnowledgeContentBlockViewModel[] {
  return blocks.map((block) => (block.id === nextBlock.id ? nextBlock : block));
}

function removeBlock(
  blocks: readonly KnowledgeContentBlockViewModel[],
  blockId: string,
): KnowledgeContentBlockViewModel[] {
  return normalizeOrder(blocks.filter((block) => block.id !== blockId));
}

function moveBlock(
  blocks: readonly KnowledgeContentBlockViewModel[],
  index: number,
  offset: -1 | 1,
): KnowledgeContentBlockViewModel[] {
  const nextIndex = index + offset;
  if (nextIndex < 0 || nextIndex >= blocks.length) {
    return [...blocks];
  }

  const reordered = [...blocks];
  const [current] = reordered.splice(index, 1);
  reordered.splice(nextIndex, 0, current);
  return normalizeOrder(reordered);
}

function normalizeOrder(
  blocks: readonly KnowledgeContentBlockViewModel[],
): KnowledgeContentBlockViewModel[] {
  return blocks.map((block, index) => ({
    ...block,
    order_no: index,
  }));
}

function formatBlockTitle(blockType: KnowledgeContentBlockType): string {
  switch (blockType) {
    case "text_block":
      return "文字块";
    case "table_block":
      return "表格块";
    case "table_evidence_block":
      return "Word 表格证据";
    case "image_block":
      return "图片块";
    default:
      return blockType;
  }
}

export async function appendKnowledgeLibraryTableEvidenceBlock({
  blocks,
  selection,
  currentRevisionId,
  client,
  tableEvidenceBindingTargetType = "knowledge_revision",
  tableEvidenceBindingRole = "source_evidence",
}: AppendKnowledgeLibraryTableEvidenceBlockInput): Promise<
  KnowledgeContentBlockViewModel[]
> {
  const nextOrder = blocks.length;
  const revisionId = normalizeKnowledgeLibraryTableEvidenceRevisionId(currentRevisionId);
  const binding =
    client && isConfirmedTableEvidenceSelection(selection)
      ? await bindTableEvidenceRevision(client, {
          revisionId: selection.revisionId,
          targetType: tableEvidenceBindingTargetType,
          targetId: revisionId,
          bindingRole: tableEvidenceBindingRole,
        })
      : null;

  const payload: KnowledgeTableEvidenceBlockPayload = {
    table_evidence_asset_id: selection.assetId,
    table_evidence_revision_id: selection.revisionId,
    ...(binding?.body.id ? { binding_id: binding.body.id } : {}),
    ...(selection.revisionStatus ? { revision_status: selection.revisionStatus } : {}),
    ...(selection.confirmedTablePackage
      ? { confirmed_table_package: selection.confirmedTablePackage }
      : {}),
  };

  return [
    ...blocks,
    {
      id: `block-${nextOrder + 1}`,
      revision_id: revisionId,
      block_type: "table_evidence_block",
      order_no: nextOrder,
      status: "active",
      content_payload: payload,
    },
  ];
}

function normalizeKnowledgeLibraryTableEvidenceRevisionId(
  currentRevisionId: string | undefined,
): string {
  const revisionId = currentRevisionId?.trim() ?? "";
  if (
    revisionId.length === 0 ||
    revisionId === "draft-revision" ||
    revisionId === "local-draft"
  ) {
    throw new Error("请先保存草稿后再添加 Word 表格证据");
  }

  return revisionId;
}

function isConfirmedTableEvidenceSelection(
  selection: KnowledgeTableEvidenceBlockSelection,
): boolean {
  return (
    selection.revisionStatus === "confirmed" &&
    selection.confirmedTablePackage?.authority === "authoritative"
  );
}

export async function handleKnowledgeLibraryTableEvidenceSelection({
  onChange,
  onError,
  onTableEvidenceBlockAdded,
  ...input
}: HandleKnowledgeLibraryTableEvidenceSelectionInput): Promise<void> {
  try {
    const nextBlocks = await appendKnowledgeLibraryTableEvidenceBlock(input);
    const addedBlock = nextBlocks[nextBlocks.length - 1];
    if (addedBlock?.block_type === "table_evidence_block") {
      onTableEvidenceBlockAdded?.(addedBlock);
    }
    onChange(nextBlocks);
  } catch (error) {
    onError(error instanceof Error ? error.message : "表格证据绑定失败");
  }
}

function KnowledgeLibraryTableEvidenceBlockSummary({
  block,
}: {
  block: KnowledgeContentBlockViewModel;
}) {
  const payload = block.content_payload as Partial<KnowledgeTableEvidenceBlockPayload>;

  return (
    <dl className="knowledge-library-rich-content-editor__table-evidence-summary">
      <div>
        <dt>Asset</dt>
        <dd>{payload.table_evidence_asset_id || "未选择"}</dd>
      </div>
      <div>
        <dt>Revision</dt>
        <dd>{payload.table_evidence_revision_id || "未选择"}</dd>
      </div>
      <div>
        <dt>Binding</dt>
        <dd>{payload.binding_id || "未绑定"}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>{formatTableEvidenceRevisionStatus(payload.revision_status)}</dd>
      </div>
    </dl>
  );
}

function formatTableEvidenceRevisionStatus(
  status: Partial<KnowledgeTableEvidenceBlockPayload>["revision_status"],
): string {
  switch (status) {
    case "pending":
      return "待确认";
    case "confirmed":
      return "已确认";
    case "needs_review":
      return "需复核";
    case undefined:
      return "未加载";
    default:
      return status;
  }
}

function formatTableEvidenceBindingTargetLabel(
  targetType: TableEvidenceBindingTargetType,
): string {
  switch (targetType) {
    case "rule_draft":
      return "规则草稿 ID";
    case "editorial_rule":
      return "规则 ID";
    case "knowledge_revision":
    default:
      return "知识版本 ID";
  }
}
