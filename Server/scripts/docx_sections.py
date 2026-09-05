"""Split a .docx into heading-delimited sections, entirely in memory.

Takes raw bytes (never a file path into permanent storage) so callers can
extract structure from an upload without ever writing it to disk.
"""

import io
import re

from docx import Document


def extract_sections(file_bytes: bytes) -> list[dict]:
    """Return [{"title": str, "text": str}, ...] for a .docx's byte content."""
    doc = Document(io.BytesIO(file_bytes))

    sections: list[dict] = []
    current: dict | None = None

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue

        style = (para.style.name or "").lower()
        is_heading = style.startswith("heading") or style == "title"

        if is_heading:
            current = {"title": text, "paragraphs": []}
            sections.append(current)
        else:
            if current is None:
                current = {"title": "Introduction", "paragraphs": []}
                sections.append(current)
            current["paragraphs"].append(text)

    result = []
    for s in sections:
        body = "\n".join(s["paragraphs"]).strip()
        if body:
            result.append({"title": s["title"], "text": body})
    return result


def normalize_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()
