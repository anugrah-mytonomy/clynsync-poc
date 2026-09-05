"""Live guideline verification of a candidate .docx, section by section.

This replaces an earlier baseline-diff design. That version compared a
candidate document against one fixed "known good" document — which only ever
covers whatever topic someone hand-authored a baseline for. This version
instead checks each section against live external clinical guidance (the
same idea as the reference ClinSync product's steps 2-3), using
references/source_tier_db.json as the actual "source of truth": a registry
of ~140 approved authorities, not a document to diff against.

Three passes per document:
  1. Triage (concurrent, cheap, no search) — does this section contain a
     specific, checkable clinical claim at all? Most sections don't.
  2. Verify (serial, one at a time) — for up to MAX_LIVE_SEARCHES checkable
     sections, ask groq/compound to search and confirm current guidance,
     surface a concrete suggested rewrite when something's off (even a pure
     clarity/health-literacy issue on an otherwise-accurate claim), then
     validate whatever it cites against source_tier_db.json.
  3. Classify (once, cheap, no search) — roll every section's finding up
     into the document-level fields an SME actually reads first: doc type,
     confidence, currency status, primary risk driver, SME role, and a
     plain-English summary + recommended action.

Sections not selected for verification (no checkable claim, or the search
budget ran out) are reported as NOT_CHECKED, not silently skipped — the
document summary always states how many of N sections were actually checked.
"""

import asyncio
import json
import os
import re
from pathlib import Path

from scripts.docx_sections import extract_sections
from scripts.llm_client import complete, verify_with_search
from scripts.source_tiers import lookup_source

MAX_CONCURRENT_TRIAGE = 4
MAX_LIVE_SEARCHES = int(os.environ.get("MAX_LIVE_SEARCHES", "5"))
SEARCH_CALL_SPACING_SECONDS = 1.5  # extra breathing room for compound's fragile quota

TRIAGE_SYSTEM_PROMPT = """You triage patient-education content to decide what's worth fact-checking.

Respond with ONLY a JSON object, no prose, no markdown fences:
{"checkable": true|false, "reason": "one short phrase"}

checkable = true only if the section contains a SPECIFIC, checkable clinical
claim that could go out of date: a dose, an age/weight threshold, a
screening interval, a red-flag/emergency criterion, a vaccine schedule, or a
named clinical statistic.

checkable = false for general background, reassurance, lifestyle tips,
administrative text, or anything with no specific fact to verify.
"""

VERIFY_PROMPT_TEMPLATE = """You review one section of a patient-education document for a clinical content \
governance check. Confirm whether its claims are current against authoritative guidance (CDC, FDA, NIH, \
USPSTF, or relevant professional medical societies) — search the web if needed — and separately flag any \
health-literacy or clarity issue even when the claim itself is accurate.

SECTION "{title}":
{text}

RISK_LEVEL guidance: mark HIGH if the claim removes, softens, or contradicts a red-flag / "stop and seek \
care" / "call your care team" instruction relative to current guidance — even if the wording sounds calm, \
confident, or medically plausible. Reserve MEDIUM/LOW for claims that are simply out of date, unclear, or \
verbose without weakening a safety instruction.

Respond in EXACTLY this format, one field per line, nothing else, no markdown:
VERDICT: CURRENT or OUTDATED or CANNOT_VERIFY
CATEGORY: Clinical Accuracy Update, Safety/Red-Flag Update, Health Literacy Enhancement, Clarification/Terminology, or Confirmatory (No Issue)
CURRENT_TEXT: the exact sentence or phrase this finding is about, verbatim from the section, 240 characters or fewer
SUGGESTED_CHANGE: a concrete rewritten version of CURRENT_TEXT that fixes the issue, or NONE if nothing needs to change
EVIDENCE: one sentence, specific about what current guidance actually says
CLINICAL_IMPACT: one sentence on what happens if this is left as-is, or "None — content is accurate and current." if there is no issue
SOURCE_URL: the single most authoritative URL you used, or NONE
CITED_SOURCES: semicolon-separated short names of the guidance you relied on, e.g. "FDA Acetaminophen; CDC Wound Care"
RISK_LEVEL: LOW or MEDIUM or HIGH
"""

CLASSIFY_SYSTEM_PROMPT = """You write the executive summary for a clinical content governance report on one \
patient-education document. You're given its filename, its section titles, and the verification finding for \
every section that was actually checked. Summarize the whole document for an SME who has 10 seconds to \
decide whether to open it.

Respond with ONLY a JSON object, no prose, no markdown fences:
{
  "doc_type": "a short document type label, e.g. Discharge Instructions, Medication Guide, Pre-Op Instructions, Pediatric Guidance, General Patient Education",
  "confidence": "HIGH, MEDIUM, or LOW - how confident you are in this assessment given how much of the document was actually checked",
  "currency_status": "a short phrase starting with YES, PARTIAL, or NO, e.g. 'YES — Current' or 'PARTIAL — one section outdated'",
  "primary_risk_driver": "the single biggest driver of risk in this document in a few words, or 'None' if nothing was found",
  "sme_role": "the type of reviewer best suited to review this, e.g. 'General Surgery / PharmD (optional review only)', or 'None needed' if nothing requires review",
  "key_issues_summary": "2-3 sentences summarizing what was found across the document",
  "recommended_action": "one short, actionable sentence, e.g. 'Approve for publication; optional health literacy enhancements available. No clinical block.'"
}
"""


async def _triage_section(section: dict) -> tuple[bool, str]:
    user_message = f'Section "{section["title"]}":\n{section["text"][:600]}'
    raw = await complete(TRIAGE_SYSTEM_PROMPT, user_message)
    try:
        data = json.loads(raw.strip().strip("`").removeprefix("json").strip())
        return bool(data.get("checkable")), str(data.get("reason", ""))
    except (json.JSONDecodeError, AttributeError):
        return False, "Could not triage this section; treated as not checkable."


def _status_note(verdict: str, risk_level: str) -> str:
    if verdict == "MATCH":
        return "Confirmed — No changes needed."
    if verdict == "RISK":
        return "Required — clinical correction needed before publication."
    if verdict == "MODIFIED":
        return "Suggestion — review recommended." if risk_level != "LOW" else "Suggestion — low priority."
    if verdict == "UNVERIFIED":
        return "Optional — could not confirm against an approved source."
    return "Unresolved — technical error during verification."


def _not_checked_result(reason: str) -> dict:
    return {
        "verdict": "NOT_CHECKED",
        "risk_level": "LOW",
        "category": "Not Checked",
        "status_note": "No live verification performed.",
        "current_text": None,
        "suggested_change": None,
        "evidence": reason,
        "clinical_impact": None,
        "explanation": reason,
        "source_url": None,
        "source_tier": None,
        "cited_sources": [],
    }


def _error_result(message: str) -> dict:
    explanation = f"Verification failed: {message}"
    return {
        "verdict": "ERROR",
        "risk_level": "MEDIUM",
        "category": "Not Checked",
        "status_note": _status_note("ERROR", "MEDIUM"),
        "current_text": None,
        "suggested_change": None,
        "evidence": explanation,
        "clinical_impact": None,
        "explanation": explanation,
        "source_url": None,
        "source_tier": None,
        "cited_sources": [],
    }


def _parse_verify_response(raw: str) -> dict:
    def _field(name: str, default: str = "") -> str:
        m = re.search(rf"{name}\s*:\s*(.+)", raw, re.IGNORECASE)
        return m.group(1).strip() if m else default

    verdict_raw = _field("VERDICT", "CANNOT_VERIFY").upper()
    category = _field("CATEGORY", "Confirmatory (No Issue)")
    current_text = _field("CURRENT_TEXT", "") or None
    suggested_change = _field("SUGGESTED_CHANGE", "NONE")
    evidence = _field("EVIDENCE", raw.strip()[:300])
    clinical_impact = _field("CLINICAL_IMPACT", "") or None
    source_url = _field("SOURCE_URL", "NONE")
    cited_sources_raw = _field("CITED_SOURCES", "")
    risk_level = _field("RISK_LEVEL", "MEDIUM").upper()

    if risk_level not in ("LOW", "MEDIUM", "HIGH"):
        risk_level = "MEDIUM"
    if source_url.upper() == "NONE" or not source_url.startswith("http"):
        source_url = None
    if suggested_change.upper() == "NONE":
        suggested_change = None

    cited_sources = [s.strip() for s in cited_sources_raw.split(";") if s.strip()]

    # OUTDATED only becomes our RISK bucket when the model itself flagged it
    # HIGH — e.g. a softened red-flag/stop-and-seek-care instruction, not just
    # a drifted number. This mirrors the escalation rule from the earlier
    # baseline-diff prompt (see ARCHITECTURE.md §6) rather than flattening
    # every out-of-date claim to the same MODIFIED severity.
    if verdict_raw == "CURRENT":
        verdict = "MATCH"
    elif verdict_raw == "OUTDATED":
        verdict = "RISK" if risk_level == "HIGH" else "MODIFIED"
    else:
        verdict = "UNVERIFIED"

    source_entry = lookup_source(source_url) if source_url else None
    if verdict in ("MATCH", "MODIFIED", "RISK"):
        if source_entry is None:
            verdict, risk_level = "UNVERIFIED", "MEDIUM"
            evidence += " (Cited source is not in our approved source registry — treated as unverified.)"
        elif source_entry.get("retired"):
            verdict, risk_level = "UNVERIFIED", "MEDIUM"
            evidence += f" (Cited source is retired in our registry; approved replacement: {source_entry.get('replacement') or 'none listed'}.)"

    evidence = evidence.strip()

    return {
        "verdict": verdict,
        "risk_level": risk_level,
        "category": category,
        "status_note": _status_note(verdict, risk_level),
        "current_text": current_text,
        "suggested_change": suggested_change,
        "evidence": evidence,
        "clinical_impact": clinical_impact,
        "explanation": evidence,  # kept for older clients reading the flat field
        "source_url": source_url,
        "source_tier": source_entry.get("tier") if source_entry else None,
        "cited_sources": cited_sources,
    }


async def _verify_section(section: dict) -> dict:
    prompt = VERIFY_PROMPT_TEMPLATE.format(title=section["title"], text=section["text"][:800])
    raw = await verify_with_search(prompt)
    return _parse_verify_response(raw)


_DEFAULT_CLASSIFICATION = {
    "doc_type": "General Patient Education",
    "confidence": "LOW",
    "currency_status": "UNKNOWN",
    "primary_risk_driver": "None",
    "sme_role": "None needed",
    "key_issues_summary": "Automatic summary unavailable for this document.",
    "recommended_action": "Review manually.",
}


async def _classify_document(filename: str, sections: list[dict], results: list[dict]) -> dict:
    """One cheap, non-search call that rolls every section's finding up into
    the document-level fields an SME reads first (doc type, confidence,
    currency status, primary risk driver, SME role, plain-English summary).
    Uses the same cheap chat model as triage, not the rate-limited search
    model, so it doesn't compete with MAX_LIVE_SEARCHES for quota.
    """
    lines = [f"Filename: {filename}", "Sections and findings:"]
    for section, result in zip(sections, results):
        lines.append(
            f'- "{section["title"]}" — {result["verdict"]} ({result["risk_level"]}): '
            f'{result.get("evidence") or result.get("explanation", "")}'
        )
    user_message = "\n".join(lines)

    try:
        raw = await complete(CLASSIFY_SYSTEM_PROMPT, user_message)
        data = json.loads(raw.strip().strip("`").removeprefix("json").strip())
        return {
            "doc_type": str(data.get("doc_type") or _DEFAULT_CLASSIFICATION["doc_type"]),
            "confidence": str(data.get("confidence") or _DEFAULT_CLASSIFICATION["confidence"]).upper(),
            "currency_status": str(data.get("currency_status") or _DEFAULT_CLASSIFICATION["currency_status"]),
            "primary_risk_driver": str(data.get("primary_risk_driver") or _DEFAULT_CLASSIFICATION["primary_risk_driver"]),
            "sme_role": str(data.get("sme_role") or _DEFAULT_CLASSIFICATION["sme_role"]),
            "key_issues_summary": str(data.get("key_issues_summary") or _DEFAULT_CLASSIFICATION["key_issues_summary"]),
            "recommended_action": str(data.get("recommended_action") or _DEFAULT_CLASSIFICATION["recommended_action"]),
        }
    except Exception:  # noqa: BLE001 - a summary call failing shouldn't fail the whole scan
        return dict(_DEFAULT_CLASSIFICATION)


def _document_rollup(counts: dict, checked: int, total: int, results: list[dict]) -> dict:
    """Same decision structure as before, extended with honest partial-coverage
    language — we only ever live-verify a bounded subset of sections.

    ERROR (a technical failure — API hiccup, timeout) is deliberately NOT
    treated as equivalent to RISK (an actual clinical finding). A flaky
    groq/compound call shouldn't force a false HIGH/MANDATORY signal; it
    belongs with UNVERIFIED — "inconclusive, worth another look" — instead.
    """
    if counts.get("RISK", 0):
        highest, sme = "HIGH", "YES — MANDATORY"
    elif counts.get("MODIFIED", 0):
        highest, sme = "MEDIUM", "YES — REQUIRED"
    elif counts.get("UNVERIFIED", 0) or counts.get("ERROR", 0):
        highest, sme = "MEDIUM", "OPTIONAL"
    else:
        # No accuracy issue anywhere, but a MATCH-verdict section can still
        # carry a non-clinical suggestion (e.g. Health Literacy Enhancement)
        # — that alone doesn't raise risk, but it does make review worth
        # offering rather than flatly "not needed".
        has_non_clinical_suggestion = any(
            r.get("verdict") == "MATCH" and r.get("category") not in (None, "Confirmatory (No Issue)")
            for r in results
            if r
        )
        highest = "CONFIRMATORY"
        sme = "OPTIONAL" if has_non_clinical_suggestion else "NO"

    coverage_note = f"{checked} of {total} section(s) were checked against live guidance."
    return {"highest_risk_level": highest, "sme_review_needed": sme, "coverage_note": coverage_note}


async def run_comparison_stream(candidate_bytes: bytes, filename: str = "document.docx"):
    """Async generator yielding dicts describing scan progress, one per event."""
    sections = extract_sections(candidate_bytes)
    if not sections:
        yield {"type": "error", "message": "No readable sections found in the uploaded document."}
        return

    doc_title = sections[0]["title"] if sections else Path(filename).stem

    yield {
        "type": "meta",
        "candidate_sections": len(sections),
        "total_checks": len(sections),
        "search_budget": MAX_LIVE_SEARCHES,
        "doc_title": doc_title,
    }

    # Pass 1: triage every section concurrently. Cheap, no search, no fragile quota.
    triage: list[tuple[bool, str] | None] = [None] * len(sections)
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_TRIAGE)

    async def triage_worker(i: int) -> None:
        async with semaphore:
            try:
                triage[i] = await _triage_section(sections[i])
            except Exception as exc:  # noqa: BLE001
                triage[i] = (False, f"Triage failed: {exc}")

    await asyncio.gather(*(triage_worker(i) for i in range(len(sections))))

    checkable_indices = [i for i, t in enumerate(triage) if t[0]]
    to_verify = checkable_indices[:MAX_LIVE_SEARCHES]
    over_budget = set(checkable_indices[MAX_LIVE_SEARCHES:])

    counts = {"MATCH": 0, "MODIFIED": 0, "RISK": 0, "UNVERIFIED": 0, "NOT_CHECKED": 0, "ERROR": 0}
    results: list[dict | None] = [None] * len(sections)

    # Sections that don't need — or didn't get — a live check are reported
    # immediately, so the stream doesn't sit idle before the first result.
    for i, section in enumerate(sections):
        if i in to_verify:
            continue
        yield {"type": "scanning", "index": i, "title": section["title"]}
        reason = "Live-verification budget reached for this document." if i in over_budget else (
            triage[i][1] or "No specific checkable clinical claim identified in this section."
        )
        result = _not_checked_result(reason)
        results[i] = result
        counts["NOT_CHECKED"] += 1
        yield {"type": "result", "index": i, "title": section["title"], **result}

    # Pass 2: verify the selected sections one at a time — groq/compound's
    # quota does not tolerate concurrent or rapid-fire calls.
    for i in to_verify:
        section = sections[i]
        yield {"type": "scanning", "index": i, "title": section["title"]}
        try:
            result = await _verify_section(section)
        except Exception as exc:  # noqa: BLE001
            result = _error_result(str(exc))
        results[i] = result
        counts[result["verdict"]] = counts.get(result["verdict"], 0) + 1
        yield {"type": "result", "index": i, "title": section["title"], **result}
        await asyncio.sleep(SEARCH_CALL_SPACING_SECONDS)

    rollup = _document_rollup(counts, len(to_verify), len(sections), results)
    classification = await _classify_document(filename, sections, results)

    yield {
        "type": "summary",
        "counts": counts,
        "total_checks": len(sections),
        "checked": len(to_verify),
        "doc_title": doc_title,
        **rollup,
        **classification,
    }
