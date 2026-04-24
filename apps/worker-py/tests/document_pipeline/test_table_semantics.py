from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from document_pipeline.table_semantics import build_table_semantic_snapshot


def test_build_table_semantic_snapshot_identifies_header_stub_units_and_footnotes():
    snapshot = build_table_semantic_snapshot(
        table_index=1,
        caption="\u88681 \u4e0d\u540c\u6cbb\u7597\u7ec4\u57fa\u7ebf\u7279\u5f81\u6bd4\u8f83",
        notes=["*P<0.05 vs control"],
        border_hints={
            "top": True,
            "bottom": True,
            "inside_horizontal": False,
            "inside_vertical": False,
        },
        rows=[
            [
                {"text": "\u9879\u76ee", "column_span": 1, "row_span": 1},
                {"text": "\u6cbb\u7597\u7ec4", "column_span": 2, "row_span": 1},
                {"text": "\u5bf9\u7167\u7ec4", "column_span": 2, "row_span": 1},
            ],
            [
                {
                    "text": "\u5e74\u9f84",
                    "column_span": 1,
                    "row_span": 1,
                    "borders": {"bottom": True},
                },
                {
                    "text": "n (%)",
                    "column_span": 1,
                    "row_span": 1,
                    "borders": {"bottom": True},
                },
                {
                    "text": "\u5747\u503c\u00b1SD",
                    "column_span": 1,
                    "row_span": 1,
                    "borders": {"bottom": True},
                },
                {
                    "text": "n (%)",
                    "column_span": 1,
                    "row_span": 1,
                    "borders": {"bottom": True},
                },
                {
                    "text": "\u5747\u503c\u00b1SD",
                    "column_span": 1,
                    "row_span": 1,
                    "borders": {"bottom": True},
                },
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
    assert snapshot["table_label"]["text"] == "\u88681"
    assert snapshot["table_label"]["coordinate"]["target"] == "table_label"
    assert snapshot["table_title"]["text"] == "\u4e0d\u540c\u6cbb\u7597\u7ec4\u57fa\u7ebf\u7279\u5f81\u6bd4\u8f83"
    assert snapshot["table_title"]["coordinate"]["target"] == "table_title"
    assert snapshot["caption_fields"]["text"] == "\u88681 \u4e0d\u540c\u6cbb\u7597\u7ec4\u57fa\u7ebf\u7279\u5f81\u6bd4\u8f83"
    assert snapshot["caption_fields"]["label_text"] == "\u88681"
    assert (
        snapshot["caption_fields"]["title_text"]
        == "\u4e0d\u540c\u6cbb\u7597\u7ec4\u57fa\u7ebf\u7279\u5f81\u6bd4\u8f83"
    )
    assert snapshot["header_cells"][1]["header_path"] == [
        "\u6cbb\u7597\u7ec4",
        "n (%)",
    ]
    assert snapshot["stub_columns"][0]["row_key"] == "\u7537\u6027"
    assert snapshot["data_cells"][0]["column_key"] == "\u6cbb\u7597\u7ec4 > n (%)"
    assert snapshot["unit_markers"][0]["text"] == "%"
    assert snapshot["footnote_items"][0]["note_kind"] == "statistical_significance"
    assert snapshot["note_zone"]["text"] == "*P<0.05 vs control"
    assert snapshot["note_zone"]["line_texts"] == ["*P<0.05 vs control"]
    assert snapshot["note_zone"]["footnote_ids"] == ["table-1-footnote-0"]
    assert snapshot["note_zone"]["coordinate"]["target"] == "note_zone"
    assert snapshot["style_profile"]["has_top_rule"] is True
    assert snapshot["style_profile"]["has_header_rule"] is True
    assert snapshot["style_profile"]["has_bottom_rule"] is True
    assert snapshot["style_profile"]["has_vertical_rules"] is False
    assert snapshot["style_profile"]["coordinate"]["target"] == "style_profile"


def test_build_table_semantic_snapshot_surfaces_grid_cell_rich_style_evidence():
    snapshot = build_table_semantic_snapshot(
        table_index=2,
        caption="Table 2 Alpha summary",
        caption_paragraphs=[
            {
                "text": "Table 2 Alpha summary",
                "style": {
                    "alignment": {
                        "availability": "authoritative",
                        "value": "center",
                    }
                },
                "fragments": [
                    {
                        "kind": "text",
                        "text": "Table 2 Alpha summary",
                        "style": {
                            "font_family": {
                                "availability": "authoritative",
                                "value": "Times New Roman",
                            },
                            "font_size_pt": {
                                "availability": "authoritative",
                                "value": 12,
                            },
                            "bold": {
                                "availability": "authoritative",
                                "value": True,
                            },
                            "italic": {
                                "availability": "authoritative",
                                "value": False,
                            },
                            "script_position": {
                                "availability": "authoritative",
                                "value": "baseline",
                            },
                        },
                    }
                ],
            }
        ],
        notes=["Note: α retained as symbol"],
        note_paragraphs=[
            {
                "text": "Note: α retained as symbol",
                "style": {
                    "alignment": {
                        "availability": "authoritative",
                        "value": "left",
                    }
                },
                "fragments": [
                    {
                        "kind": "text",
                        "text": "Note: α retained as symbol",
                        "style": {
                            "font_family": {
                                "availability": "authoritative",
                                "value": "Times New Roman",
                            },
                            "font_size_pt": {
                                "availability": "authoritative",
                                "value": 10.5,
                            },
                            "bold": {
                                "availability": "authoritative",
                                "value": False,
                            },
                            "italic": {
                                "availability": "authoritative",
                                "value": True,
                            },
                            "script_position": {
                                "availability": "authoritative",
                                "value": "baseline",
                            },
                        },
                    }
                ],
            }
        ],
        rows=[
            [
                {
                    "text": "α=0.05",
                    "column_span": 1,
                    "row_span": 1,
                    "vertical_alignment": "center",
                    "paragraphs": [
                        {
                            "text": "α=0.05",
                            "style": {
                                "alignment": {
                                    "availability": "authoritative",
                                    "value": "right",
                                },
                                "spacing_before_pt": {
                                    "availability": "authoritative",
                                    "value": 0,
                                },
                                "spacing_after_pt": {
                                    "availability": "authoritative",
                                    "value": 0,
                                },
                                "line_spacing": {
                                    "availability": "authoritative",
                                    "value": 1,
                                },
                                "line_spacing_mode": {
                                    "availability": "authoritative",
                                    "value": "multiple",
                                },
                                "left_indent_pt": {
                                    "availability": "authoritative",
                                    "value": 0,
                                },
                                "right_indent_pt": {
                                    "availability": "authoritative",
                                    "value": 0,
                                },
                                "first_line_indent_pt": {
                                    "availability": "authoritative",
                                    "value": 0,
                                },
                                "hanging_indent_pt": {
                                    "availability": "authoritative",
                                    "value": 0,
                                },
                            },
                            "fragments": [
                                {
                                    "kind": "symbol",
                                    "text": "α",
                                    "symbol_font": "Symbol",
                                    "symbol_char": "03B1",
                                    "style": {
                                        "font_family": {
                                            "availability": "authoritative",
                                            "value": "Symbol",
                                        },
                                        "font_size_pt": {
                                            "availability": "authoritative",
                                            "value": 10.5,
                                        },
                                        "bold": {
                                            "availability": "authoritative",
                                            "value": False,
                                        },
                                        "italic": {
                                            "availability": "authoritative",
                                            "value": False,
                                        },
                                        "script_position": {
                                            "availability": "authoritative",
                                            "value": "baseline",
                                        },
                                    },
                                },
                                {
                                    "kind": "text",
                                    "text": "=0.05",
                                    "style": {
                                        "font_family": {
                                            "availability": "authoritative",
                                            "value": "Times New Roman",
                                        },
                                        "font_size_pt": {
                                            "availability": "authoritative",
                                            "value": 10.5,
                                        },
                                        "bold": {
                                            "availability": "authoritative",
                                            "value": False,
                                        },
                                        "italic": {
                                            "availability": "authoritative",
                                            "value": True,
                                        },
                                        "script_position": {
                                            "availability": "authoritative",
                                            "value": "baseline",
                                        },
                                    },
                                },
                            ],
                        }
                    ],
                }
            ]
        ],
    )

    assert snapshot["row_count"] == 1
    assert snapshot["column_count"] == 1
    assert snapshot["caption_fields"]["paragraphs"][0]["style"]["alignment"]["value"] == "center"
    assert snapshot["note_zone"]["paragraphs"][0]["fragments"][0]["style"]["italic"]["value"] is True
    assert snapshot["grid_cells"][0]["style_evidence"]["alignment"]["value"] == "right"
    assert snapshot["grid_cells"][0]["style_evidence"]["vertical_alignment"]["value"] == "center"
    assert snapshot["grid_cells"][0]["style_evidence"]["italic"]["availability"] == "mixed"
    assert snapshot["grid_cells"][0]["paragraphs"][0]["fragments"][0]["kind"] == "symbol"
    assert snapshot["grid_cells"][0]["paragraphs"][0]["fragments"][0]["text"] == "α"
