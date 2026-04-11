import type { KnowledgeRepository } from "./knowledge-repository.ts";
import type { RegenerateKnowledgeSemanticLayerInput } from "./knowledge-service.ts";
import { KnowledgeRevisionNotFoundError } from "./knowledge-service.ts";

export class KnowledgeSemanticLayerService {
  constructor(
    private readonly dependencies: {
      repository: Pick<
        KnowledgeRepository,
        | "findRevisionById"
        | "listContentBlocksByRevisionId"
        | "findSemanticLayerByRevisionId"
      >;
    },
  ) {}

  async buildSemanticLayerDraft(
    revisionId: string,
  ): Promise<RegenerateKnowledgeSemanticLayerInput> {
    const revision = await this.dependencies.repository.findRevisionById(revisionId);
    if (!revision) {
      throw new KnowledgeRevisionNotFoundError(revisionId);
    }

    const contentBlocks = this.dependencies.repository.listContentBlocksByRevisionId
      ? await this.dependencies.repository.listContentBlocksByRevisionId(revisionId)
      : [];
    const existing = this.dependencies.repository.findSemanticLayerByRevisionId
      ? await this.dependencies.repository.findSemanticLayerByRevisionId(revisionId)
      : undefined;
    const blockTypes = [
      ...new Set(contentBlocks.map((block) => block.block_type.replace(/_block$/, ""))),
    ];
    const pageSummary =
      existing?.page_summary ??
      `${revision.title} rich-space summary covering ${
        blockTypes.length > 0 ? blockTypes.join(", ") : "text"
      } content.`;
    const retrievalTerms =
      existing?.retrieval_terms && existing.retrieval_terms.length > 0
        ? existing.retrieval_terms
        : uniqueStrings([
            revision.title,
            revision.routing.module_scope,
            ...(revision.routing.sections ?? []),
            ...contentBlocks
              .flatMap((block) =>
                Object.values(block.content_payload).filter(
                  (value): value is string => typeof value === "string",
                ),
              )
              .slice(0, 3),
          ]).slice(0, 6);
    const retrievalSnippets =
      existing?.retrieval_snippets && existing.retrieval_snippets.length > 0
        ? existing.retrieval_snippets
        : [
            revision.summary ??
              revision.canonical_text.slice(0, 160),
          ].filter((value) => value.trim().length > 0);
    const tableSemantics =
      contentBlocks.find((block) => block.table_semantics)?.table_semantics ??
      existing?.table_semantics;
    const imageUnderstanding =
      contentBlocks.find((block) => block.image_understanding)?.image_understanding ??
      existing?.image_understanding;

    return {
      pageSummary,
      retrievalTerms,
      retrievalSnippets,
      ...(tableSemantics ? { tableSemantics } : {}),
      ...(imageUnderstanding ? { imageUnderstanding } : {}),
    };
  }
}

function uniqueStrings(values: readonly string[]): string[] {
  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  ];
}
