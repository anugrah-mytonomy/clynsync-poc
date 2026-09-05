# ClinSync Streaming Compare — Team Overview

*A plain-language explanation of this POC. For the technical version, see `ARCHITECTURE.md`.*

## In one sentence

Upload a document, and watch it get checked — section by section, live — against **current, real external clinical guidance** (CDC, FDA, NIH, and other trusted authorities).

## How it works

1. You upload a `.docx`. The file never touches disk — read into memory for the scan, then discarded.
2. The document is split into sections.
3. Each section is quickly triaged: does it contain something checkable — a dose, an age threshold, a red-flag symptom, a statistic? Most sections don't (background info, lifestyle tips) — those are marked **Not Checked**.
4. A limited number of checkable sections get a **live search verification**: the AI searches the web, confirms current guidance, and cites its source.
5. That citation is checked against our approved list of ~140 trusted authorities. An untrusted or outdated source gets downgraded to **Unverified**, no matter how confident the answer sounded.
6. Everything rolls up into one banner: **Highest Risk Level** and **SME Review Needed?**, plus how much of the document was actually checked.

## The five verdicts

| Verdict | Meaning |
|---|---|
| **Current** | Verified — matches today's guidance |
| **Outdated** | Verified, but doesn't match current guidance |
| **Risk** | Outdated *and* a safety/red-flag instruction was weakened — always needs review |
| **Unverified** | Couldn't confirm an answer, or the cited source isn't one we trust |
| **Not Checked** | No checkable claim found, or the document's search budget ran out |

## What "source of truth" means here

It's **not a document** — it's a curated list of ~140 real external authorities (CDC, FDA, NIH, professional medical societies). A claim is only "Current" if a live search confirms it **and** cites a source from that list.

## A real result

Checking a discharge-instructions handout, the tool verified an acetaminophen dosing claim (4,000 mg/24h):

> **Risk** — *"Current FDA guidance limits adult acetaminophen to 3,000 mg per 24 hours, not the 4,000 mg stated in the claim."*
> Source: fda.gov

A genuine, correct catch — the FDA's actual limit is lower than what the document said.

## Known limitations

- Only a bounded number of sections per document get a live check (a handful, configurable) — the rest are marked Not Checked, not hidden.
- Live verification needs a Perplexity or Groq key. Claude alone (no Perplexity key) can classify and triage but can't search live — those sections fall back to Not Checked.
- The free search quota is tight — occasional technical errors are expected under heavy use.
- Nothing is saved — refresh the page and results are gone.

## Try it yourself

Run it locally and open `http://localhost:8000`. Select one or more `.docx` files and watch results build live, including a source link for anything actually verified.
