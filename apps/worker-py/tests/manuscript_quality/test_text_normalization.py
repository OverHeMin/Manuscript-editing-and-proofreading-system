from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from manuscript_quality.text_normalization import (
    build_normalized_document,
    build_paragraph_blocks,
    split_sentences,
)


def test_build_paragraph_blocks_normalizes_noise_and_preserves_stable_indices():
    paragraphs = build_paragraph_blocks(
        [
            {"text": "\ufeff摘要\u200b：研究Ａ组与B组。", "style": "Heading 1"},
            {"text": "  第一段\t观察指标为 CRP。  ", "style": "Normal"},
            {"text": "   ", "style": "Normal"},
            {"text": "第二段结果：症状改善！结论明确。", "style": "Normal"},
        ]
    )

    assert [paragraph["paragraph_index"] for paragraph in paragraphs] == [0, 1, 2]
    assert paragraphs[0]["normalized_text"] == "摘要：研究A组与B组。"
    assert paragraphs[1]["normalized_text"] == "第一段 观察指标为 CRP。"
    assert paragraphs[2]["normalized_text"] == "第二段结果：症状改善！结论明确。"
    assert paragraphs[0]["style"] == "Heading 1"


def test_split_sentences_and_normalized_document_stay_deterministic():
    blocks = [
        {"text": "摘要：研究A组与B组。", "style": "Heading 1"},
        {"text": "第一段观察指标为 CRP。", "style": "Normal"},
        {"text": "第二段结果：症状改善！结论明确。", "style": "Normal"},
    ]

    paragraphs = build_paragraph_blocks(blocks)
    sentences = split_sentences(paragraphs)
    normalized = build_normalized_document(blocks)

    assert [
        (
            sentence["paragraph_index"],
            sentence["sentence_index"],
            sentence["normalized_text"],
        )
        for sentence in sentences
    ] == [
        (0, 0, "摘要：研究A组与B组。"),
        (1, 0, "第一段观察指标为 CRP。"),
        (2, 0, "第二段结果：症状改善！"),
        (2, 1, "结论明确。"),
    ]
    assert normalized["normalized_text"] == (
        "摘要：研究A组与B组。\n"
        "第一段观察指标为 CRP。\n"
        "第二段结果：症状改善！结论明确。"
    )
    assert normalized["paragraph_blocks"] == paragraphs
    assert normalized["sentence_blocks"] == sentences
    assert normalized["heading_blocks"][0]["normalized_text"] == "摘要：研究A组与B组。"

