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
    <section className="knowledge-library-panel knowledge-library-rich-content">
      <header className="knowledge-library-panel-header">
        <div>
          <h2>Rich Content</h2>
          <p>
            Compose text, paste tables, and attach image understanding blocks in one
            semantic editing flow.
          </p>
        </div>
      </header>

      <div className="knowledge-library-rich-content-actions">
        <button type="button" onClick={() => onChange(addBlock(blocks, "text_block"))}>
          Add Text Block
        </button>
        <button type="button" onClick={() => onChange(addBlock(blocks, "table_block"))}>
          Add Table Block
        </button>
        <button type="button" onClick={() => onChange(addBlock(blocks, "image_block"))}>
          Add Image Block
        </button>
      </div>

      <div className="knowledge-library-rich-content-list">
        {blocks.map((block) => (
          <article key={block.id} className="knowledge-library-rich-block">
            <header className="knowledge-library-rich-block-header">
              <h3>{formatBlockTitle(block.block_type)}</h3>
              <small>Order {block.order_no}</small>
            </header>

            {block.block_type === "text_block" ? (
              <label className="knowledge-library-block-editor">
                <span>Text Content</span>
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
                  placeholder="Type or paste knowledge text"
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
          ? { rows: [["Column 1", "Column 2"]] }
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

function formatBlockTitle(blockType: KnowledgeContentBlockType): string {
  switch (blockType) {
    case "text_block":
      return "Text Block";
    case "table_block":
      return "Table Block";
    case "image_block":
      return "Image Block";
    default:
      return blockType;
  }
}
