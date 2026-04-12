from __future__ import annotations

import re

from manuscript_quality.contracts import NormalizedDocument, ParagraphBlock


WHITESPACE_PATTERN = re.compile(r"[ \t\r\f\v\u00a0\u3000]+")
ZERO_WIDTH_PATTERN = re.compile(r"[\ufeff\u200b\u200c\u200d]")
LIST_PATTERN = re.compile(r"^(?:\d+(?:\.\d+)*[.、]?\s+|[-*•]\s+)")
SENTENCE_PATTERN = re.compile(r"[^。！？!?；;]+[。！？!?；;]?")
FULLWIDTH_ASCII_TRANSLATION = str.maketrans(
    {
        **{chr(code): chr(code - 0xFEE0) for code in range(0xFF10, 0xFF1A)},
        **{chr(code): chr(code - 0xFEE0) for code in range(0xFF21, 0xFF3B)},
        **{chr(code): chr(code - 0xFEE0) for code in range(0xFF41, 0xFF5B)},
    }
)


def normalize_text(text: str) -> str:
    cleaned = ZERO_WIDTH_PATTERN.sub("", text or "")
    cleaned = cleaned.replace("\n", " ")
    cleaned = cleaned.translate(FULLWIDTH_ASCII_TRANSLATION)
    cleaned = WHITESPACE_PATTERN.sub(" ", cleaned)
    return cleaned.strip()


def build_paragraph_blocks(blocks: list[dict]) -> list[ParagraphBlock]:
    paragraphs: list[ParagraphBlock] = []

    for source_block_index, block in enumerate(blocks):
        text = str(block.get("text", ""))
        normalized_text = normalize_text(text)
        if not normalized_text:
            continue

        style = block.get("style")
        block_kind = "paragraph"
        if _is_heading(style):
            block_kind = "heading"
        elif LIST_PATTERN.match(normalized_text):
            block_kind = "list"

        paragraphs.append(
            {
                "paragraph_index": len(paragraphs),
                "source_block_index": source_block_index,
                "style": style,
                "block_kind": block_kind,
                "text": text.strip(),
                "normalized_text": normalized_text,
            }
        )

    return paragraphs


def split_sentences(paragraphs: list[ParagraphBlock]) -> list[dict]:
    sentences: list[dict] = []

    for paragraph in paragraphs:
        matches = [
            match.group(0).strip()
            for match in SENTENCE_PATTERN.finditer(paragraph["normalized_text"])
            if match.group(0).strip()
        ]

        for sentence_index, sentence in enumerate(matches):
            start_offset = paragraph["normalized_text"].find(sentence)
            end_offset = start_offset + len(sentence)
            sentences.append(
                {
                    "paragraph_index": paragraph["paragraph_index"],
                    "sentence_index": sentence_index,
                    "text": sentence,
                    "normalized_text": sentence,
                    "start_offset": start_offset,
                    "end_offset": end_offset,
                }
            )

    return sentences


def build_normalized_document(blocks: list[dict]) -> NormalizedDocument:
    paragraph_blocks = build_paragraph_blocks(blocks)
    sentence_blocks = split_sentences(paragraph_blocks)
    heading_blocks = [
        paragraph for paragraph in paragraph_blocks if paragraph["block_kind"] == "heading"
    ]
    list_blocks = [
        paragraph for paragraph in paragraph_blocks if paragraph["block_kind"] == "list"
    ]

    return {
        "normalized_text": "\n".join(
            paragraph["normalized_text"] for paragraph in paragraph_blocks
        ),
        "paragraph_blocks": paragraph_blocks,
        "sentence_blocks": sentence_blocks,
        "heading_blocks": heading_blocks,
        "list_blocks": list_blocks,
        "token_map": [
            {
                "paragraph_index": sentence["paragraph_index"],
                "sentence_index": sentence["sentence_index"],
                "start_offset": sentence["start_offset"],
                "end_offset": sentence["end_offset"],
            }
            for sentence in sentence_blocks
        ],
    }


def _is_heading(style: str | None) -> bool:
    if not style:
        return False

    normalized_style = style.strip().lower()
    return normalized_style.startswith("heading") or normalized_style == "title"
