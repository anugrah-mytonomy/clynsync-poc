# Why the Two LLM Scan Files Differ

**Context:** In `ClinSync_Comparison_Report.md`, the two LLM Scan runs (`WE_sample1` at 11:16 and the unlabeled run at 11:18) were given the **exact same source document**, two minutes apart, yet returned different results:

| Metric | LLM Scan Run 1 (11:16) | LLM Scan Run 2 (11:18) |
|---|---|---|
| Total Findings | 5 | 4 |
| Specialty Routing Gap | 4 | 5 |
| Outdated Source Year (>5 yrs) | — | 1 |

The two Direct Extraction runs, by contrast, produced **identical** output (34 findings, same breakdown, both times).

## The reason: LLMs are not deterministic — and this codebase doesn't force them to be

Looking at [llm_client.py](Server/scripts/llm_client.py), the chat call in `complete()` is made like this:

```python
response = await client.chat.completions.create(
    model=model,
    messages=[...],
    max_tokens=600,
    temperature=0.2,
    response_format={"type": "json_object"},
    ...
)
```

The key setting is `temperature=0.2`. Temperature controls how much randomness the model injects when choosing its next word/token:

- `temperature=0` → the model always picks the single most likely next token — as close to deterministic as an LLM gets.
- `temperature=0.2` (what's actually set here) → still mostly picks the likely token, but leaves room for the model to occasionally choose a slightly different word or phrasing. Over a long analysis (reading a whole clinical document and reasoning about it section by section), those small per-token differences compound — the model can end up including or excluding a borderline finding, or judging something as a "Specialty Routing Gap" in one run and not flagging it the same way in the next.

Nothing in `llm_client.py` seeds a fixed random seed or forces `temperature=0`, so this variability is expected, not a bug. It's the same reason asking a person to re-read a document and re-list their concerns rarely produces the *exact* same list twice — the LLM is doing analogous judgment-based reading, not a fixed lookup.

Direct Extraction doesn't have this problem because it isn't a language model at all — it's rule-based pattern extraction over the document text, so the same input always follows the same code path to the same output.

## Bottom line for the manager

> The LLM Scan results are expected to vary slightly between runs on the same document because the analysis is performed by a language model with a small amount of randomness built in (`temperature=0.2` in `llm_client.py`), which is standard for LLM-based reasoning tasks. Direct Extraction results are always identical because that method is deterministic rule-based extraction with no model-driven judgment involved. Neither behavior is a defect — they're inherent to how each method works.
