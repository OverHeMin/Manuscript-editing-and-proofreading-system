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

type _KnowledgeSemanticStatus = Assert<
  IsEqual<
    KnowledgeSemanticLayer["status"],
    "not_generated" | "pending_confirmation" | "confirmed" | "stale"
  >
>;
