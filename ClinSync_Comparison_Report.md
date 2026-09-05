# ClinSync AI — Direct Extraction vs. LLM Scan Comparison

**Source document:** `ClinSync_pregnancy_sample.docx` (same file used for all 4 runs)
**Prepared:** September 2, 2026

---

## 1. Files Compared

| # | File | Method | Run Time (Sep 2, 2026) |
|---|------|--------|--------------------------|
| 1 | `RAG_sample1` | Direct Extraction | 05:45 UTC |
| 2 | `RAG_sample2` | Direct Extraction | 05:45 UTC |
| 3 | `WE_sample1` | LLM Scan | 11:16 |
| 4 | *(unlabeled)* | LLM Scan | 11:18 |

---

## 2. Results Summary

| Metric | Direct Extraction (Run 1) | Direct Extraction (Run 2) | LLM Scan (Run 1) | LLM Scan (Run 2) |
|---|---|---|---|---|
| Total Findings | 34 | 34 | 5 | 4 |
| HIGH risk | 0 | 0 | 1 | 1 |
| MEDIUM risk | 0 | 0 | 0 | 0 |
| LOW risk | 1 | 1 | 0 | 0 |
| Improvement | — | — | 1 | 1 |
| Confirmatory | 0 | 0 | 0 | 0 |
| SME Review — Mandatory | 0 | 0 | 1 | 1 |
| SME Review — Optional | 1 | 1 | 0 | 0 |
| Layer 1 (Clinical Accuracy) | 35 | 35 | 4 | 4 |
| Layer 2 (Content Optimization) | 0 | 0 | 1 | 1 |
| Cited But Not Consulted | — | — | 1 | 1 |
| Specialty Routing Gap | — | — | 4 | 5 |
| Outdated Source (>5 yrs) | — | — | — | 1 |

---

## 3. Key Difference: Why Direct Extraction Is Consistent and LLM Scan Isn't

**Direct Extraction is deterministic.** It runs a fixed, rule-based pass over the *entire* document content — no interpretation or judgment involved. Because the logic doesn't change between runs, feeding it the same document twice produces identical output: both runs found the same 34 items, with the same LOW/Optional classification, down to the decimal. It's built for consistent, repeatable coverage of the whole document.

**LLM Scan is non-deterministic by nature.** It uses a language model to *read and reason about* the content rather than mechanically extract from it. Because LLM generation involves sampling, re-running the same document through it can produce slightly different results each time — which is exactly what happened here: 5 findings vs. 4 findings, and the Specialty Routing Gap count shifted from 4 to 5 between the two runs, two minutes apart. This isn't a bug — it's an inherent characteristic of LLM-based analysis, similar to asking two different reviewers to read the same passage and flag concerns.

## 4. What Each Method Is Good At

| | Direct Extraction | LLM Scan |
|---|---|---|
| **Coverage** | Broad — scans full document, surfaces many candidate issues (34) | Narrow — surfaces only the items it judges significant (4–5) |
| **Severity judgment** | None — everything came back LOW/Optional | Yes — correctly flagged 1 HIGH-risk item requiring mandatory SME review |
| **Contextual checks** | None (no source validation section) | Yes — checks citation usage, specialty relevance, and source recency |
| **Repeatability** | Identical results every run | Results vary slightly run-to-run |

**Takeaway:** Direct Extraction is the more reliable net for volume and repeatability, but it doesn't distinguish severity — everything looks equally low-priority. LLM Scan does the deeper reasoning (it's the only method that caught a HIGH-risk, mandatory-review item, plus source-quality issues), but its output should be expected to vary slightly between runs — a trade-off inherent to LLM-based review, not a defect.

---

*All 4 runs are advisory only. No clinical content was edited or published; all findings require qualified clinical SME review before any action is taken.*
