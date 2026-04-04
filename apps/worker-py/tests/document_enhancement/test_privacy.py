from src.document_enhancement.privacy import build_privacy_advisory


def test_privacy_advisory_flags_email_phone_and_identifier_markers():
    result = build_privacy_advisory(
        (
            "Patient contact: test@example.com, 13800138000, "
            "and national id 110101199003071234."
        )
    )

    assert result.status == "needs_review"
    assert [finding.category for finding in result.findings] == [
        "email",
        "phone",
        "identifier",
    ]


def test_privacy_advisory_degrades_when_no_text_is_available():
    result = build_privacy_advisory(None)

    assert result.status == "degraded"
    assert result.findings == []
    assert "No extracted text" in result.notes[0]


def test_privacy_advisory_surfaces_configured_presidio_endpoints_as_metadata_only():
    result = build_privacy_advisory(
        "No obvious identifiers here.",
        environment={
            "PRESIDIO_ANALYZER_URL": "http://127.0.0.1:5001",
            "PRESIDIO_ANONYMIZER_URL": "http://127.0.0.1:5002",
        },
    )

    assert result.status == "advisory_only"
    assert result.findings == []
    assert [(adapter.name, adapter.status) for adapter in result.adapters] == [
        ("presidio_analyzer", "configured"),
        ("presidio_anonymizer", "configured"),
    ]
