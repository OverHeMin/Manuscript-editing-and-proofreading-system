from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from document_pipeline.table_semantics import build_table_semantic_snapshot


def test_build_table_semantic_snapshot_identifies_header_stub_units_and_footnotes():
    snapshot = build_table_semantic_snapshot(
        table_index=1,
        caption="\u88681 \u4e0d\u540c\u6cbb\u7597\u7ec4\u57fa\u7ebf\u7279\u5f81\u6bd4\u8f83",
        notes=["*P<0.05 vs control"],
        rows=[
            [
                {"text": "\u9879\u76ee", "column_span": 1, "row_span": 1},
                {"text": "\u6cbb\u7597\u7ec4", "column_span": 2, "row_span": 1},
                {"text": "\u5bf9\u7167\u7ec4", "column_span": 2, "row_span": 1},
            ],
            [
                {"text": "\u5e74\u9f84", "column_span": 1, "row_span": 1},
                {"text": "n (%)", "column_span": 1, "row_span": 1},
                {"text": "\u5747\u503c\u00b1SD", "column_span": 1, "row_span": 1},
                {"text": "n (%)", "column_span": 1, "row_span": 1},
                {"text": "\u5747\u503c\u00b1SD", "column_span": 1, "row_span": 1},
            ],
            [
                {"text": "\u7537\u6027", "column_span": 1, "row_span": 1},
                {"text": "18 (60.0)", "column_span": 1, "row_span": 1},
                {"text": "54.2\u00b110.3", "column_span": 1, "row_span": 1},
                {"text": "16 (53.3)", "column_span": 1, "row_span": 1},
                {"text": "51.1\u00b19.8", "column_span": 1, "row_span": 1},
            ],
        ],
    )

    assert snapshot["table_id"] == "table-1"
    assert snapshot["profile"]["is_three_line_table"] is True
    assert snapshot["profile"]["header_depth"] == 2
    assert snapshot["profile"]["has_stub_column"] is True
    assert snapshot["profile"]["has_unit_markers"] is True
    assert snapshot["profile"]["has_statistical_footnotes"] is True
    assert snapshot["header_cells"][1]["header_path"] == [
        "\u6cbb\u7597\u7ec4",
        "n (%)",
    ]
    assert snapshot["stub_columns"][0]["row_key"] == "\u7537\u6027"
    assert snapshot["data_cells"][0]["column_key"] == "\u6cbb\u7597\u7ec4 > n (%)"
    assert snapshot["unit_markers"][0]["text"] == "%"
    assert snapshot["footnote_items"][0]["note_kind"] == "statistical_significance"
