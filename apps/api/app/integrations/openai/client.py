import json
from typing import Dict
import httpx
from app.integrations.openai.exceptions import OpenAIApiError

OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"

# Per-platform character targets given to the model, and the hard ceiling this
# module enforces server-side afterward regardless of what the model returns.
# x_text/threads_text/youtube_title match real, strict platform limits (X=280,
# Threads=500, YouTube title=100) already enforced elsewhere in this codebase
# (campaign_resolver.PLATFORM_TEXT_LIMITS, schemas.CampaignCreateRequest). The
# others (instagram/facebook/linkedin/tiktok) use widely-documented practical
# caption limits, not a database constraint - this app's own storage columns
# allow up to 5000 chars for those, so the model's target is the real guardrail,
# with the DB max_length as a final backstop.
FIELD_TARGETS: Dict[str, int] = {
    "default_text": 2000,
    "instagram_text": 2200,
    "facebook_text": 2000,
    "linkedin_text": 3000,
    "tiktok_text": 2200,
    "x_text": 280,
    "threads_text": 500,
    "youtube_title": 100,
    "youtube_description": 1000,
}

# Absolute ceilings - never exceeded even if the model ignores the target above.
# Matches this app's own column limits (models/campaign.py, schemas.py) so a
# generated text can never fail campaign creation validation downstream.
HARD_LIMITS: Dict[str, int] = {
    "default_text": 5000,
    "instagram_text": 5000,
    "facebook_text": 5000,
    "linkedin_text": 5000,
    "tiktok_text": 5000,
    "x_text": 280,
    "threads_text": 500,
    "youtube_title": 100,
    "youtube_description": 5000,
}

SYSTEM_PROMPT = """Sei un social media copywriter. Dato un argomento in italiano, scrivi contenuti pronti per essere pubblicati su più piattaforme social, nella stessa lingua della richiesta dell'utente.

Rispondi SOLO con un oggetto JSON con esattamente queste chiavi, tutte stringhe:
- default_text: testo generico di base (per piattaforme senza versione dedicata)
- instagram_text: caption per Instagram, con hashtag pertinenti
- facebook_text: post per Facebook, tono colloquiale
- linkedin_text: post per LinkedIn, tono professionale, senza emoji eccessive
- tiktok_text: didascalia breve e diretta per TikTok, con hashtag
- x_text: post per X/Twitter, ENTRO 280 caratteri totali inclusi eventuali hashtag - è un limite rigido, non superarlo mai
- threads_text: post per Threads, entro 500 caratteri
- youtube_title: titolo per un video YouTube, ENTRO 100 caratteri, senza hashtag
- youtube_description: descrizione per un video YouTube, con hashtag pertinenti

Rispetta questi target di lunghezza (caratteri) per ogni campo: {targets}

Scrivi contenuti concreti e specifici sull'argomento richiesto, non placeholder. Includi hashtag pertinenti dove indicato, senza esagerare (max 5-8)."""


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    # Cut at the last whitespace before the limit rather than mid-word, when
    # there's a reasonable one to cut at; otherwise a hard slice.
    truncated = text[:limit]
    last_space = truncated.rfind(" ")
    if last_space > limit * 0.6:
        truncated = truncated[:last_space]
    return truncated.rstrip()


def generate_campaign_text(api_key: str, model: str, topic: str) -> Dict[str, str]:
    """
    Calls OpenAI's Chat Completions API to draft campaign copy for every
    platform-specific text field from a single topic description. Returns a
    dict with exactly the keys in FIELD_TARGETS, each truncated to HARD_LIMITS
    as a safety net regardless of what the model returned.
    """
    system_prompt = SYSTEM_PROMPT.format(
        targets=", ".join(f"{k}={v}" for k, v in FIELD_TARGETS.items())
    )

    try:
        response = httpx.post(
            OPENAI_CHAT_COMPLETIONS_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": topic},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.8,
                # Backstop against runaway output cost: the 9 fields combined rarely
                # exceed ~1000-1200 tokens even at their max length targets. This is
                # a pure text-completion call (chat/completions) - no image/video
                # generation endpoint is ever used by this integration.
                "max_tokens": 1500,
            },
            timeout=45.0,
        )
    except httpx.RequestError as e:
        raise OpenAIApiError(f"Errore di rete verso OpenAI: {str(e)}")

    if response.status_code != 200:
        # Never include the request body/headers in the error (would leak the key).
        raise OpenAIApiError(
            f"OpenAI ha risposto con errore ({response.status_code})",
            status_code=response.status_code,
        )

    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        raise OpenAIApiError(f"Risposta OpenAI non valida: {str(e)}")

    result: Dict[str, str] = {}
    for field, limit in HARD_LIMITS.items():
        value = parsed.get(field)
        result[field] = _truncate(str(value).strip(), limit) if value else ""

    return result
