from src.pdf_pipeline.extraction import (
    PdfHeadingExtractionAdapters,
    extract_pdf_heading_sets,
)


class StubTocExtractor:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def extract_toc_headings(self, pdf_path: str) -> list[dict]:
        self.calls.append(pdf_path)
        return [
            {"number": "1", "title": "Introduction", "level": 1, "page": 1},
        ]


class StubBodyExtractor:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def extract_body_headings(self, pdf_path: str) -> list[dict]:
        self.calls.append(pdf_path)
        return [
            {"number": "1", "title": "Introduction", "level": 1, "page": 2},
        ]


def test_extraction_adapters_delegate_to_toc_and_body_extractors():
    toc_extractor = StubTocExtractor()
    body_extractor = StubBodyExtractor()

    toc_headings, body_headings = extract_pdf_heading_sets(
        "fixtures/example.pdf",
        PdfHeadingExtractionAdapters(
            toc=toc_extractor,
            body=body_extractor,
        ),
    )

    assert toc_extractor.calls == ["fixtures/example.pdf"]
    assert body_extractor.calls == ["fixtures/example.pdf"]
    assert toc_headings == [
        {"number": "1", "title": "Introduction", "level": 1, "page": 1},
    ]
    assert body_headings == [
        {"number": "1", "title": "Introduction", "level": 1, "page": 2},
    ]
