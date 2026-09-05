"""Tiny LLM provider abstraction so this POC can run on whichever key is available.

Groq (free tier, no card required at console.groq.com) is tried first since it's
the lowest-friction way to get this running with zero cost. Anthropic Claude is
used instead if ANTHROPIC_API_KEY is set and GROQ_API_KEY is not.

Live search verification is a separate concern from the main chat provider
above — see verify_with_search(). Perplexity (PERPLEXITY_API_KEY), when
configured, is what the search-grounded verify step uses, since it's the
same pairing (Claude for reasoning + Perplexity for live search) the
reference ClinSync product itself is built on (see ARCHITECTURE.md §5).
Groq's own search-enabled "compound" models remain the fallback path when
running fully on Groq with no Perplexity key.
"""

import asyncio
import os

import httpx

MAX_RETRY_ATTEMPTS = 4
MAX_SINGLE_WAIT_SECONDS = 8  # see _with_retry() docstring


async def _with_retry(create_call):
    """Run create_call() with backoff on 429/503.

    A per-minute rate limit clears in seconds, so retrying is the right
    response — the caller shouldn't see it as an error at all. A per-DAY
    quota (groq/compound has its own, separate from the main chat model —
    see ARCHITECTURE.md §10b) reports retry-after values of 60-100+ seconds.
    Honoring that literally means blocking up to MAX_RETRY_ATTEMPTS times in
    a row with zero feedback — several minutes where a section just looks
    stuck, not actually different from an infinite hang to whoever's
    watching. So: only ever wait up to MAX_SINGLE_WAIT_SECONDS. Anything the
    provider asks to wait longer than that means fail fast instead — the
    caller (compare_engine.py) turns that into an immediate section-level
    ERROR, which is far better than an unexplained multi-minute stall.
    """
    attempt = 0
    while True:
        try:
            return await create_call()
        except Exception as exc:
            status = getattr(exc, "status_code", None)
            if status not in (429, 503) or attempt >= MAX_RETRY_ATTEMPTS - 1:
                raise
            wait = 2**attempt
            response = getattr(exc, "response", None)
            if response is not None:
                retry_after = response.headers.get("retry-after")
                if retry_after:
                    try:
                        wait = max(wait, float(retry_after))
                    except ValueError:
                        pass
            if wait > MAX_SINGLE_WAIT_SECONDS:
                raise
            await asyncio.sleep(wait)
            attempt += 1


def _configured(value: str | None) -> bool:
    """True only for a value that looks like a real key, not an unfilled placeholder."""
    if not value:
        return False
    value = value.strip()
    if not value:
        return False
    return not (value.startswith("your_") and value.endswith("_here"))


def get_provider() -> str | None:
    if _configured(os.environ.get("GROQ_API_KEY")):
        return "groq"
    if _configured(os.environ.get("ANTHROPIC_API_KEY")):
        return "anthropic"
    return None


class _HTTPStatusError(Exception):
    """Mirrors the `.status_code` / `.response` shape _with_retry() already
    expects from the groq/anthropic SDKs' own exceptions, so the same retry
    helper works for a plain httpx call too.
    """

    def __init__(self, response: httpx.Response) -> None:
        self.status_code = response.status_code
        self.response = response
        super().__init__(f"HTTP {response.status_code}: {response.text[:200]}")


async def complete(system_prompt: str, user_message: str) -> str:
    """Run one chat completion and return the raw text response."""
    provider = get_provider()

    if provider == "groq":
        from groq import AsyncGroq

        client = AsyncGroq(api_key=os.environ["GROQ_API_KEY"])
        model = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
        kwargs = {}
        if model.startswith("openai/gpt-oss"):
            # gpt-oss models spend some of max_tokens on hidden reasoning before
            # the JSON answer; capping effort keeps that bounded and cheap.
            # Other Groq models either don't support this param or reject "low".
            kwargs["reasoning_effort"] = "low"
        response = await _with_retry(
            lambda: client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                max_tokens=600,
                temperature=0.2,
                response_format={"type": "json_object"},
                **kwargs,
            )
        )
        return response.choices[0].message.content or ""

    if provider == "anthropic":
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        model = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5")
        response = await _with_retry(
            lambda: client.messages.create(
                model=model,
                max_tokens=400,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )
        )
        return "".join(block.text for block in response.content if block.type == "text")

    raise RuntimeError(
        "No LLM provider configured. Set GROQ_API_KEY (free — console.groq.com) "
        "or ANTHROPIC_API_KEY in .env."
    )


async def _verify_with_perplexity(prompt: str) -> str:
    """Perplexity's `sonar` models search the web and answer in one call —
    the same live-search building block the reference ClinSync product
    pairs with Claude for its own verification step (ARCHITECTURE.md §5,
    §10). Called via a plain HTTP request (Perplexity's API is OpenAI-chat
    -shaped) rather than adding another SDK dependency for one endpoint.
    """
    model = os.environ.get("PERPLEXITY_MODEL", "sonar")

    async def _create() -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={"Authorization": f"Bearer {os.environ['PERPLEXITY_API_KEY']}"},
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 500,
                    "temperature": 0.2,
                },
            )
        if response.status_code >= 400:
            raise _HTTPStatusError(response)
        return response.json()

    data = await _with_retry(_create)
    return data["choices"][0]["message"]["content"] or ""


async def _verify_with_groq(prompt: str) -> str:
    """Groq's own search-enabled "compound" models — the fallback path when
    running fully on Groq with no PERPLEXITY_API_KEY configured.

    Default is groq/compound-mini, not the full groq/compound: the full
    model reliably fails with a 413 "Request Entity Too Large" the instant
    it actually invokes web search on the free/on_demand tier — reproduced
    across multiple topics, prompt sizes, and even a brand-new API key, so
    it's a tier-level limit on that model's search payload, not something
    fixable from our side. compound-mini does the same job with a lighter
    search payload and works reliably.

    Its free-tier quota is noticeably tighter than the main chat model's.
    Callers MUST call this serially (never concurrently) and are
    responsible for spacing calls out.
    """
    from groq import AsyncGroq

    client = AsyncGroq(api_key=os.environ["GROQ_API_KEY"])
    model = os.environ.get("GROQ_SEARCH_MODEL", "groq/compound-mini")
    response = await _with_retry(
        lambda: client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            # The response carries CURRENT_TEXT, SUGGESTED_CHANGE, EVIDENCE,
            # CLINICAL_IMPACT and CITED_SOURCES alongside the original four
            # fields (see compare_engine.py's VERIFY_PROMPT_TEMPLATE) — more
            # tokens per call against the same tight free-tier quota
            # (ARCHITECTURE.md §10b).
            max_tokens=500,
            temperature=0.2,
        )
    )
    return response.choices[0].message.content or ""


async def verify_with_search(prompt: str) -> str:
    """Run one live, search-grounded verification call.

    PERPLEXITY_API_KEY, when configured, is always preferred — it works
    regardless of which provider `complete()` is using (Claude or Groq) and
    isn't subject to groq/compound's tier-specific quirks. Falls back to a
    Groq compound model when running on Groq with no Perplexity key.
    Anthropic's native web_search tool is a multi-turn tool loop we haven't
    built for this POC, so Claude-only (no Perplexity key) still can't
    verify live; callers should treat a RuntimeError here as "can't verify
    live on this provider" and fall back to a NOT_CHECKED-style result.
    """
    if _configured(os.environ.get("PERPLEXITY_API_KEY")):
        return await _verify_with_perplexity(prompt)

    if get_provider() == "groq":
        return await _verify_with_groq(prompt)

    raise RuntimeError(
        "Live search verification needs PERPLEXITY_API_KEY or GROQ_API_KEY "
        "(Claude alone has no web-search step wired up in this POC)."
    )
