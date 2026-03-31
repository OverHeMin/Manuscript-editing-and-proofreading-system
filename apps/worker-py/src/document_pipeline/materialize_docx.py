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
