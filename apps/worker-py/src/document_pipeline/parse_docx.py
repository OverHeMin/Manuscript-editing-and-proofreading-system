HEADING_STYLE_LEVELS = {
    "title": 0,
    "heading 1": 1,
    "heading 2": 2,
    "heading 3": 3,
}


def normalize_style_name(style_name: str | None) -> str:
    return (style_name or "").strip().lower()


def extract_structure_from_paragraphs(paragraphs: list[dict]) -> dict:
    sections: list[dict] = []

    for index, paragraph in enumerate(paragraphs):
        text = (paragraph.get("text") or "").strip()
        style = normalize_style_name(paragraph.get("style"))

        if not text or style not in HEADING_STYLE_LEVELS:
            continue

        sections.append(
            {
                "order": len(sections) + 1,
                "heading": text,
                "level": HEADING_STYLE_LEVELS[style],
                "paragraph_index": index,
            }
        )

    if not sections:
        return {
            "status": "needs_manual_review",
            "parser": "python_docx",
            "sections": [],
            "warnings": ["No title or heading styles were detected in the document."],
        }

    return {
        "status": "ready",
        "parser": "python_docx",
        "sections": sections,
        "warnings": [],
    }
