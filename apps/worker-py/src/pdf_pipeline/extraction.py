from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol, TypedDict


class PdfHeading(TypedDict):
    number: str
    title: str
    level: int
    page: int


class TocHeadingExtractor(Protocol):
    def extract_toc_headings(self, pdf_path: str) -> Sequence[PdfHeading]: ...


class BodyHeadingExtractor(Protocol):
    def extract_body_headings(self, pdf_path: str) -> Sequence[PdfHeading]: ...


@dataclass(frozen=True)
class PdfHeadingExtractionAdapters:
    toc: TocHeadingExtractor
    body: BodyHeadingExtractor


def extract_pdf_heading_sets(
    pdf_path: str,
    adapters: PdfHeadingExtractionAdapters,
) -> tuple[list[PdfHeading], list[PdfHeading]]:
    return (
      list(adapters.toc.extract_toc_headings(pdf_path)),
      list(adapters.body.extract_body_headings(pdf_path)),
    )
