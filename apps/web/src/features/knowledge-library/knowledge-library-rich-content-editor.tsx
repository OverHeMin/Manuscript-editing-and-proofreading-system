import { KnowledgeLibraryBlockImageEditor } from "./knowledge-library-block-image-editor.tsx";
import { KnowledgeLibraryBlockTableEditor } from "./knowledge-library-block-table-editor.tsx";
import type {
  KnowledgeContentBlockType,
  KnowledgeContentBlockViewModel,
  KnowledgeUploadInput,
  KnowledgeUploadViewModel,
} from "./types.ts";

export interface KnowledgeLibraryRichContentEditorProps {
  blocks: readonly KnowledgeContentBlockViewModel[];
  onChange: (blocks: KnowledgeContentBlockViewModel[]) => void;
  onUploadImage?: (input: KnowledgeUploadInput) => Promise<KnowledgeUploadViewModel | void>;
}

export function KnowledgeLibraryRichContentEditor({
  blocks,
  onChange,
  onUploadImage,
}: KnowledgeLibraryRichContentEditorProps) {
  return (
    <section
      className="knowledge-library-rich-content-editor"
      data-material-editor="blocks"
    >
      <header className="knowledge-library-rich-content-editor__header">
        <div>
          <h3>内容材料</h3>
          <p>按块组织正文、表格与图片，先选块类型再录入，避免把图表挤进正文里。</p>
        </div>
      </header>

      <div className="knowledge-library-rich-content-editor__guidance">
        <p>表格支持直接粘贴 Excel / WPS，每一行会自动拆分为多列。</p>
        <p>图片块可以上传截图、图表或扫描件，上传后再补充图片说明。</p>
        <p>如果只想补充图注、表注或规则备注，用“添加补充文字”就可以。</p>
      </div>

      <div className="knowledge-library-rich-content-editor__actions">
        <button
          type="button"
          data-block-action="add-text"
          onClick={() => onChange(addBlock(blocks, "text_block"))}
        >
          添加补充文字
        </button>
        <button
          type="button"
          data-block-action="add-table"
          onClick={() => onChange(addBlock(blocks, "table_block"))}
        >
          添加表格
        </button>
        <button
          type="button"
          data-block-action="add-image"
          onClick={() => onChange(addBlock(blocks, "image_block"))}
        >
          添加图片或截图
        </button>
      </div>

      <div className="knowledge-library-rich-content-editor__list">
        {blocks.length === 0 ? (
          <p className="knowledge-library-rich-content-editor__empty">
            还没有证据材料，可以先添加表格、图片或补充文字。
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
          </article>
        ))}
      </div>
    </section>
  );
}

function addBlock(
  blocks: readonly KnowledgeContentBlockViewModel[],
  blockType: KnowledgeContentBlockType,
): KnowledgeContentBlockViewModel[] {
  const nextOrder = blocks.length;
  const revisionId = blocks[0]?.revision_id ?? "draft-revision";

  return [
    ...blocks,
    {
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
    },
  ];
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
    case "image_block":
      return "图片块";
    default:
      return blockType;
  }
}
