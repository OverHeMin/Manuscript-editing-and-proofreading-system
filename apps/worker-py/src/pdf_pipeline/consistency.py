from collections.abc import Sequence


def compare_toc_and_body_headings(
    toc_headings: Sequence[dict], body_headings: Sequence[dict]
) -> list[dict]:
    issues: list[dict] = []
    max_length = max(len(toc_headings), len(body_headings))

    for index in range(max_length):
        toc_heading = toc_headings[index] if index < len(toc_headings) else None
        body_heading = body_headings[index] if index < len(body_headings) else None

        if toc_heading and not body_heading:
            issues.append(
                {
                    "issue_type": "toc_missing_in_body",
                    "toc_heading": toc_heading,
                }
            )
            continue

        if body_heading and not toc_heading:
            issues.append(
                {
                    "issue_type": "body_missing_in_toc",
                    "body_heading": body_heading,
                }
            )
            continue

        if toc_heading["number"] != body_heading["number"]:
            issues.append(
                {
                    "issue_type": "toc_numbering_mismatch",
                    "toc_heading": toc_heading,
                    "body_heading": body_heading,
                }
            )
            continue

        if toc_heading["title"] != body_heading["title"]:
            issues.append(
                {
                    "issue_type": "needs_manual_review",
                    "toc_heading": toc_heading,
                    "body_heading": body_heading,
                }
            )

    return issues
