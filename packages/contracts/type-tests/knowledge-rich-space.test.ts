import type { KnowledgeContentBlock, KnowledgeSemanticLayer } from "../src/index.js";

type IsEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <
  T
>() => T extends B ? 1 : 2
  ? true
  : false;
type Assert<T extends true> = T;

type _KnowledgeContentBlockType = Assert<
  IsEqual<
    KnowledgeContentBlock["block_type"],
    "text_block" | "table_block" | "image_block"
  >
>;

type _KnowledgeContentBlockShape = Assert<
  IsEqual<
    KnowledgeContentBlock,
    {
      id: string;
      revision_id: string;
      block_type: "text_block" | "table_block" | "image_block";
      order_no: number;
      status: "active" | "archived";
      content_payload: Record<string, unknown>;
      table_semantics?: Record<string, unknown>;
      image_understanding?: Record<string, unknown>;
    }
  >
>;

type _KnowledgeSemanticStatus = Assert<
  IsEqual<
    KnowledgeSemanticLayer["status"],
    "not_generated" | "pending_confirmation" | "confirmed" | "stale"
  >
>;

type _KnowledgeSemanticLayerShape = Assert<
  IsEqual<
    KnowledgeSemanticLayer,
    {
      revision_id: string;
      status: "not_generated" | "pending_confirmation" | "confirmed" | "stale";
      page_summary?: string;
      retrieval_terms?: string[];
      retrieval_snippets?: string[];
      table_semantics?: Record<string, unknown>;
      image_understanding?: Record<string, unknown>;
    }
  >
>;
