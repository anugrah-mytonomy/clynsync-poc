"""Loads the approved-source registry (references/source_tier_db.json) and
matches a cited URL against it. This is the real "source of truth" for the
live-verification pipeline: not a document to diff against, but a list of
~140 external authorities (CDC, FDA, NIH, ...) a citation must belong to for
a verification result to be trusted.
"""

import json
from pathlib import Path
from urllib.parse import urlparse

_DB_PATH = Path(__file__).parent.parent / "references" / "source_tier_db.json"
_sources: list[dict] | None = None


def _load() -> list[dict]:
    global _sources
    if _sources is None:
        _sources = json.loads(_DB_PATH.read_text(encoding="utf-8"))
    return _sources


def _hostname(url: str) -> str:
    host = urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def lookup_source(cited_url: str) -> dict | None:
    """Match a cited URL against the registry.

    A domain can have more than one entry — e.g. source_tier_db.json lists
    both "ahrq" (active) and "ahrq_guidelines" (retired) under ahrq.gov, for
    the same reason a real site can retire one page while others stay live.
    Hostname-only matching would pick whichever entry happens to come first
    in the file, which is wrong whenever the retired one is what's cited. So
    among every hostname match, prefer the entry whose own URL is the
    longest prefix of the cited one — the most specific match wins; a bare
    domain entry is only used when nothing more specific matches.

    Returns the matching entry (with its tier, retired/replacement status)
    or None if the domain isn't in the approved list at all.
    """
    if not cited_url:
        return None
    cited_norm = cited_url.lower().rstrip("/")
    cited_host = _hostname(cited_url)
    if not cited_host:
        return None

    candidates = [
        entry
        for entry in _load()
        if (entry_host := _hostname(entry["url"]))
        and (cited_host == entry_host or cited_host.endswith("." + entry_host))
    ]
    if not candidates:
        return None

    def _specificity(entry: dict) -> int:
        entry_norm = entry["url"].lower().rstrip("/")
        return len(entry_norm) if cited_norm.startswith(entry_norm) else -1

    return max(candidates, key=_specificity)
