# llm_client.py

Tiny LLM provider abstraction so this POC can run on whichever API key is available, without the rest of the codebase caring which provider is active.

## Provider selection

`get_provider()` picks the provider by key presence, in this order:

1. **Groq** — used if `GROQ_API_KEY` is set. Free tier, no card required (console.groq.com), so it's the lowest-friction way to get the POC running.
2. **Anthropic (Claude)** — used if `ANTHROPIC_API_KEY` is set and `GROQ_API_KEY` is not.
3. Neither configured → `None`, and `complete()` raises `RuntimeError`.

A key is only considered "configured" if it isn't blank and isn't an unfilled `.env` placeholder (`your_..._here`) — see `_configured()`.

## `complete(system_prompt, user_message)`

Runs one chat completion and returns the raw text response.

- **Groq path**: uses `AsyncGroq`, model from `GROQ_MODEL` (default `openai/gpt-oss-120b`), `temperature=0.2`, JSON-object response format. For `openai/gpt-oss*` models, `reasoning_effort` is capped to `"low"` — these models spend part of `max_tokens` on hidden reasoning before the JSON answer, so capping effort keeps that bounded and cheap.
- **Anthropic path**: uses `AsyncAnthropic`, model from `CLAUDE_MODEL` (default `claude-sonnet-5`).

## `verify_with_search(prompt)`

A separate concern from the main chat provider above: a live, search-grounded verification step, mirroring the pairing the reference ClinSync product uses (Claude for reasoning + Perplexity for live search — see `ARCHITECTURE.md` §5, §10).

Resolution order:

1. **Perplexity** (`PERPLEXITY_API_KEY`) — preferred whenever configured. Works regardless of which provider `complete()` is using, via a plain `httpx` POST to Perplexity's OpenAI-chat-shaped API (no extra SDK dependency for one endpoint). Model from `PERPLEXITY_MODEL` (default `sonar`).
2. **Groq compound** — fallback when running fully on Groq with no Perplexity key. Uses `groq/compound-mini` (default), not the full `groq/compound`: the full model reliably 413s the instant it invokes web search on the free/on_demand tier (reproduced across topics, prompt sizes, and even a fresh API key) — a tier-level limit, not something fixable from this side. `compound-mini` does the same job with a lighter search payload. Its free-tier quota is noticeably tighter than the main chat model's, so **callers must call it serially, never concurrently**, and are responsible for spacing calls out.
3. Neither configured → `RuntimeError`. Claude alone has no web-search step wired up in this POC (Anthropic's native `web_search` tool would need a multi-turn tool loop not built here); callers should treat this error as "can't verify live on this provider" and fall back to a `NOT_CHECKED`-style result.

## Retry behavior (`_with_retry`)

Wraps a single provider call with backoff on HTTP 429/503, up to `MAX_RETRY_ATTEMPTS` (4) attempts:

- Wait time is `2**attempt` seconds, or the provider's `retry-after` header if larger.
- Capped at `MAX_SINGLE_WAIT_SECONDS` (8s) — if the required wait exceeds that, it fails fast instead of blocking.

Rationale: a per-minute rate limit clears in seconds, so retrying is correct. But a per-day quota (Groq's compound model has its own, separate from the main chat model — see `ARCHITECTURE.md` §10b) reports `retry-after` values of 60–100+ seconds; honoring that literally would mean blocking for several minutes with no feedback — indistinguishable from a hang to whoever's watching. So any wait over 8s is treated as a failure instead, which the caller (`compare_engine.py`) turns into an immediate section-level `ERROR` rather than an unexplained multi-minute stall.

`_HTTPStatusError` exists purely so the same retry helper can be reused for the plain `httpx` Perplexity call — it mirrors the `.status_code` / `.response` shape the Groq/Anthropic SDKs' own exceptions already expose.

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `GROQ_API_KEY` | Enables Groq as chat provider | — |
| `GROQ_MODEL` | Groq chat model | `openai/gpt-oss-120b` |
| `ANTHROPIC_API_KEY` | Enables Anthropic as chat provider | — |
| `CLAUDE_MODEL` | Anthropic chat model | `claude-sonnet-5` |
| `PERPLEXITY_API_KEY` | Enables Perplexity for live search verification | — |
| `PERPLEXITY_MODEL` | Perplexity model | `sonar` |
| `GROQ_SEARCH_MODEL` | Groq model for search-grounded verification fallback | `groq/compound-mini` |
