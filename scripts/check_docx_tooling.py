from __future__ import annotations

import json
import shutil


def main() -> None:
    report = {
        "libreoffice_available": bool(
            shutil.which("soffice") or shutil.which("libreoffice")
        ),
        "soffice_path": shutil.which("soffice"),
        "libreoffice_path": shutil.which("libreoffice"),
    }
    print(json.dumps(report, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
