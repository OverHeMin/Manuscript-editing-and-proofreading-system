from __future__ import annotations

import argparse
from pathlib import Path
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape
import zipfile


WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

NS = {"w": WORD_NS}
XML_NS = "http://www.w3.org/XML/1998/namespace"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-path", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--manuscript-id", required=True)
    parser.add_argument("--asset-type", required=True)
    parser.add_argument("--source-path")
    return parser.parse_args()


def extract_source_paragraphs(source_path: str | None) -> list[str]:
    if not source_path:
        return []

    source_file = Path(source_path)
    if not source_file.exists():
        return []

    try:
        with zipfile.ZipFile(source_file, "r") as archive:
            document_xml = archive.read("word/document.xml")
    except Exception:
        return []

    try:
        root = ET.fromstring(document_xml)
    except ET.ParseError:
        return []

    paragraphs: list[str] = []
    for paragraph in root.findall(".//w:body/w:p", NS):
        text_parts = [node.text or "" for node in paragraph.findall(".//w:t", NS)]
        text = "".join(text_parts).strip()
        if text:
            paragraphs.append(text)

    return paragraphs


def fallback_paragraphs(args: argparse.Namespace) -> list[str]:
    return [
        args.title.strip() or "Medical manuscript artifact",
        f"Manuscript ID: {args.manuscript_id}",
        f"Asset type: {args.asset_type}",
        "This DOCX artifact was materialized from V1 metadata because no richer file content was available.",
    ]


def qualify(tag: str) -> str:
    return f"{{{WORD_NS}}}{tag}"


def build_paragraph_node(snapshot: dict | None) -> ET.Element:
    paragraph = ET.Element(qualify("p"))
    style = snapshot.get("style") if isinstance(snapshot, dict) else None
    apply_paragraph_style(paragraph, style if isinstance(style, dict) else {})
    fragments = snapshot.get("fragments") if isinstance(snapshot, dict) else None
    text = snapshot.get("text") if isinstance(snapshot, dict) else None
    append_fragments_to_paragraph(
        paragraph,
        fragments if isinstance(fragments, list) else [],
        fallback_text=text if isinstance(text, str) else "",
    )
    return paragraph


def append_fragments_to_paragraph(
    paragraph: ET.Element,
    fragments: list[dict],
    *,
    fallback_text: str = "",
) -> None:
    if not fragments and fallback_text:
        fragments = [
            {
                "kind": "text",
                "text": fallback_text,
                "style": {},
            }
        ]

    for fragment in fragments:
        run = ET.SubElement(paragraph, qualify("r"))
        apply_run_style(run, fragment.get("style") if isinstance(fragment, dict) else {})
        kind = fragment.get("kind") if isinstance(fragment, dict) else "text"
        text = fragment.get("text") if isinstance(fragment, dict) else ""

        if kind == "symbol":
            symbol = ET.SubElement(run, qualify("sym"))
            if isinstance(fragment, dict):
                if fragment.get("symbol_font"):
                    symbol.set(qualify("font"), str(fragment["symbol_font"]))
                if fragment.get("symbol_char"):
                    symbol.set(qualify("char"), str(fragment["symbol_char"]))
            continue

        if kind == "tab":
            ET.SubElement(run, qualify("tab"))
            continue

        if kind == "line_break":
            ET.SubElement(run, qualify("br"))
            continue

        text_node = ET.SubElement(run, qualify("t"))
        if isinstance(text, str) and (text.startswith(" ") or text.endswith(" ")):
          text_node.set(f"{{{XML_NS}}}space", "preserve")
        text_node.text = text if isinstance(text, str) else ""


def apply_paragraph_style(paragraph: ET.Element, style: dict) -> None:
    alignment = read_style_fact_value(style.get("alignment"))
    spacing_before = read_style_fact_value(style.get("spacing_before_pt"))
    spacing_after = read_style_fact_value(style.get("spacing_after_pt"))
    line_spacing = read_style_fact_value(style.get("line_spacing"))
    line_spacing_mode = read_style_fact_value(style.get("line_spacing_mode"))
    left_indent = read_style_fact_value(style.get("left_indent_pt"))
    right_indent = read_style_fact_value(style.get("right_indent_pt"))
    first_line_indent = read_style_fact_value(style.get("first_line_indent_pt"))
    hanging_indent = read_style_fact_value(style.get("hanging_indent_pt"))

    if (
        alignment is None
        and spacing_before is None
        and spacing_after is None
        and line_spacing is None
        and line_spacing_mode is None
        and left_indent is None
        and right_indent is None
        and first_line_indent is None
        and hanging_indent is None
    ):
        return

    paragraph_properties = ET.SubElement(paragraph, qualify("pPr"))
    if isinstance(alignment, str) and alignment:
        jc = ET.SubElement(paragraph_properties, qualify("jc"))
        jc.set(qualify("val"), alignment)

    if (
        isinstance(spacing_before, (int, float))
        or isinstance(spacing_after, (int, float))
        or isinstance(line_spacing, (int, float))
    ):
        spacing = ET.SubElement(paragraph_properties, qualify("spacing"))
        if isinstance(spacing_before, (int, float)):
            spacing.set(qualify("before"), str(int(round(spacing_before * 20))))
        if isinstance(spacing_after, (int, float)):
            spacing.set(qualify("after"), str(int(round(spacing_after * 20))))
        if isinstance(line_spacing, (int, float)):
            if line_spacing_mode == "exact_pt":
                spacing.set(qualify("line"), str(int(round(line_spacing * 20))))
                spacing.set(qualify("lineRule"), "exact")
            elif line_spacing_mode == "at_least_pt":
                spacing.set(qualify("line"), str(int(round(line_spacing * 20))))
                spacing.set(qualify("lineRule"), "atLeast")
            else:
                spacing.set(qualify("line"), str(int(round(line_spacing * 240))))
                spacing.set(qualify("lineRule"), "auto")

    if any(
        isinstance(value, (int, float))
        for value in (
            left_indent,
            right_indent,
            first_line_indent,
            hanging_indent,
        )
    ):
        indent = ET.SubElement(paragraph_properties, qualify("ind"))
        if isinstance(left_indent, (int, float)):
            indent.set(qualify("left"), str(int(round(left_indent * 20))))
        if isinstance(right_indent, (int, float)):
            indent.set(qualify("right"), str(int(round(right_indent * 20))))
        if isinstance(first_line_indent, (int, float)):
            indent.set(qualify("firstLine"), str(int(round(first_line_indent * 20))))
        if isinstance(hanging_indent, (int, float)):
            indent.set(qualify("hanging"), str(int(round(hanging_indent * 20))))


def apply_run_style(run: ET.Element, style: dict) -> None:
    font_family = read_style_fact_value(style.get("font_family"))
    font_size_pt = read_style_fact_value(style.get("font_size_pt"))
    bold = read_style_fact_value(style.get("bold"))
    italic = read_style_fact_value(style.get("italic"))
    script_position = read_style_fact_value(style.get("script_position"))

    if (
        font_family is None
        and font_size_pt is None
        and bold is None
        and italic is None
        and script_position is None
    ):
        return

    run_properties = ET.SubElement(run, qualify("rPr"))
    if isinstance(font_family, str) and font_family:
        fonts = ET.SubElement(run_properties, qualify("rFonts"))
        fonts.set(qualify("ascii"), font_family)
        fonts.set(qualify("hAnsi"), font_family)
        fonts.set(qualify("eastAsia"), font_family)
    if isinstance(font_size_pt, (int, float)):
        size = ET.SubElement(run_properties, qualify("sz"))
        size.set(qualify("val"), str(int(round(font_size_pt * 2))))
    if isinstance(bold, bool):
        bold_node = ET.SubElement(run_properties, qualify("b"))
        if not bold:
            bold_node.set(qualify("val"), "false")
    if isinstance(italic, bool):
        italic_node = ET.SubElement(run_properties, qualify("i"))
        if not italic:
            italic_node.set(qualify("val"), "false")
    if script_position in {"superscript", "subscript"}:
        vertical_align = ET.SubElement(run_properties, qualify("vertAlign"))
        vertical_align.set(qualify("val"), str(script_position))


def read_style_fact_value(value: object) -> object | None:
    if not isinstance(value, dict):
        return None

    if value.get("availability") not in {"authoritative", "mixed"}:
        return None

    return value.get("value")


def build_document_xml(paragraphs: list[str]) -> str:
    body = "".join(
        f'<w:p><w:r><w:t xml:space="preserve">{escape(paragraph)}</w:t></w:r></w:p>'
        for paragraph in paragraphs
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{WORD_NS}">'
        f"<w:body>{body}"
        "<w:sectPr>"
        '<w:pgSz w:w="11906" w:h="16838"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" '
        'w:header="708" w:footer="708" w:gutter="0"/>'
        "</w:sectPr>"
        "</w:body>"
        "</w:document>"
    )


def write_docx(output_path: Path, paragraphs: list[str]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>""",
        )
        archive.writestr(
            "_rels/.rels",
            f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="{REL_NS}">
  <Relationship Id="rId1" Type="{DOC_REL_NS}/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>""",
        )
        archive.writestr(
            "docProps/core.xml",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Medical Manuscript Artifact</dc:title>
</cp:coreProperties>""",
        )
        archive.writestr(
            "docProps/app.xml",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex Medical Manuscript System</Application>
</Properties>""",
        )
        archive.writestr("word/document.xml", build_document_xml(paragraphs))


def main() -> None:
    args = parse_args()
    paragraphs = extract_source_paragraphs(args.source_path)
    if not paragraphs:
        paragraphs = fallback_paragraphs(args)

    write_docx(Path(args.output_path), paragraphs)


if __name__ == "__main__":
    main()
