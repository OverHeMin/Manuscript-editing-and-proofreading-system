from __future__ import annotations

import json
import shutil


def main() -> None:
    soffice_path = shutil.which("soffice")
    libreoffice_path = shutil.which("libreoffice")
    libreoffice_available = bool(soffice_path or libreoffice_path)
    warnings: list[str] = []
    if not libreoffice_available:
        warnings.append("LibreOffice unavailable; doc to docx normalization deferred.")

    report = {
        "libreoffice_available": libreoffice_available,
        "normalization_backend": "libreoffice" if libreoffice_available else None,
        "doc_preview_status": "ready" if libreoffice_available else "pending_normalization",
        "warnings": warnings,
        "soffice_path": soffice_path,
        "libreoffice_path": libreoffice_path,
    }
    print(json.dumps(report, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
