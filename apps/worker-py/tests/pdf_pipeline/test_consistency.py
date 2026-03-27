from src.pdf_pipeline.consistency import compare_toc_and_body_headings


def test_consistency_issues_are_emitted_for_missing_and_mismatched_headings():
    toc = [
        {"number": "1", "title": "Introduction", "level": 1, "page": 1},
        {"number": "2", "title": "Methods", "level": 1, "page": 3},
    ]
    body = [
        {"number": "1", "title": "Introduction", "level": 1, "page": 1},
        {"number": "3", "title": "Methods", "level": 1, "page": 3},
        {"number": "4", "title": "Discussion", "level": 1, "page": 9},
    ]

    issues = compare_toc_and_body_headings(toc, body)

    assert [issue["issue_type"] for issue in issues] == [
        "toc_numbering_mismatch",
        "body_missing_in_toc",
    ]


def test_title_conflicts_are_marked_for_manual_review_with_both_headings():
    toc = [
        {"number": "4", "title": "Discussion", "level": 1, "page": 8},
    ]
    body = [
        {"number": "4", "title": "Conclusion", "level": 1, "page": 8},
    ]

    issues = compare_toc_and_body_headings(toc, body)

    assert issues == [
        {
            "issue_type": "needs_manual_review",
            "toc_heading": {"number": "4", "title": "Discussion", "level": 1, "page": 8},
            "body_heading": {"number": "4", "title": "Conclusion", "level": 1, "page": 8},
        }
    ]
