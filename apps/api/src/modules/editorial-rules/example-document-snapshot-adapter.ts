import type {
  ExampleDocumentBlockSnapshot,
  ExampleDocumentSnapshot,
  ExampleDocumentSource,
  ExampleDocumentTableSnapshot,
} from "@medical/contracts";
import type {
  DocumentStructureSnapshot,
  DocumentStructureTableSnapshot,
} from "../document-pipeline/document-structure-service.ts";

export class ExampleDocumentSnapshotAdapter {
  fromFixture(input: ExampleDocumentSnapshot): ExampleDocumentSnapshot {
    return cloneExampleDocumentSnapshot(input);
  }

  fromDocumentStructure(input: {
    source: ExampleDocumentSource;
    snapshot: DocumentStructureSnapshot;
    blocks?: ExampleDocumentBlockSnapshot[];
  }): ExampleDocumentSnapshot {
    return {
      source: input.source,
      parser_status: input.snapshot.status,
      sections: input.snapshot.sections.map((section) => ({ ...section })),
      blocks:
        input.blocks?.map((block) => ({ ...block })) ??
        buildBlocksFromDocumentStructure(input.snapshot),
      tables: input.snapshot.tables.map(cloneDocumentStructureTableSnapshot),
      warnings: [...input.snapshot.warnings],
    };
  }
}

function cloneExampleDocumentSnapshot(
  snapshot: ExampleDocumentSnapshot,
): ExampleDocumentSnapshot {
  return {
    source: snapshot.source,
    parser_status: snapshot.parser_status,
    sections: snapshot.sections.map((section) => ({ ...section })),
    blocks: snapshot.blocks.map((block) => ({ ...block })),
    tables: snapshot.tables.map((table) => ({
      ...cloneDocumentStructureTableSnapshot(table),
      label: table.label,
      title: table.title,
    })),
    warnings: [...snapshot.warnings],
  };
}

function buildBlocksFromDocumentStructure(
  snapshot: DocumentStructureSnapshot,
): ExampleDocumentBlockSnapshot[] {
  const headingBlocks = snapshot.sections.map((section) => ({
    block_id: `section-${section.order}`,
    kind: "heading" as const,
    section_key: normalizeSectionKey(section.heading),
    semantic_role: "heading",
    text: section.heading,
    paragraph_index: section.paragraph_index,
  }));
  const tableBlocks = snapshot.tables.map((table) => ({
    block_id: table.table_id,
    kind: "table" as const,
    section_key: "table",
    semantic_role: "table",
    text: table.table_id,
  }));

  return [...headingBlocks, ...tableBlocks];
}

function cloneDocumentStructureTableSnapshot(
  table: DocumentStructureTableSnapshot,
): ExampleDocumentTableSnapshot {
  return {
    table_id: table.table_id,
    profile: { ...table.profile },
    header_cells: table.header_cells.map((cell) => ({
      ...cell,
      header_path: [...cell.header_path],
      coordinate: {
        ...cell.coordinate,
        header_path: cell.coordinate.header_path
          ? [...cell.coordinate.header_path]
          : undefined,
      },
    })),
    data_cells: table.data_cells.map((cell) => ({
      ...cell,
      coordinate: {
        ...cell.coordinate,
        header_path: cell.coordinate.header_path
          ? [...cell.coordinate.header_path]
          : undefined,
      },
    })),
    footnote_items: table.footnote_items.map((item) => ({
      ...item,
      coordinate: {
        ...item.coordinate,
        header_path: item.coordinate.header_path
          ? [...item.coordinate.header_path]
          : undefined,
      },
    })),
  };
}

function normalizeSectionKey(heading: string): string {
  return heading.trim().toLowerCase().replace(/\s+/g, "_");
}

