from fastapi import APIRouter, Depends, HTTPException
from app.api.v1.auth import get_current_admin
from app.models.administrator import Administrator
from app.core.config import settings
from app.integrations.openai.client import generate_campaign_text
from app.integrations.openai.exceptions import OpenAIApiError
from app.schemas.schemas import AIGenerateTextRequest, AIGenerateTextResponse

router = APIRouter()


@router.post("/generate-campaign-text", response_model=AIGenerateTextResponse)
def generate_campaign_text_endpoint(
    payload: AIGenerateTextRequest,
    admin: Administrator = Depends(get_current_admin)
):
    """
    Drafts campaign copy for every platform-specific text field from a topic
    description, via OpenAI. Purely a writing aid for the campaign wizard - the
    admin can freely edit every field afterward, nothing is saved by this call.
    """
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Generazione AI non configurata: manca OPENAI_API_KEY sul server."
        )

    try:
        result = generate_campaign_text(settings.OPENAI_API_KEY, settings.OPENAI_MODEL, payload.topic)
    except OpenAIApiError as e:
        raise HTTPException(status_code=502, detail=e.message)

    return result
