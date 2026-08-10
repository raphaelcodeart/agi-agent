"""
Inbound entrypoints for the Omnichannel Responder: the real Telegram webhook
(unauthenticated - Telegram can't send our JWT, verified instead via the
per-channel-account secret token, see TelegramConnector.verify_webhook) and
the admin-only "simulate message" dev tool (spec section 51), which only
works against channel_accounts of type 'mock' so it can never be pointed at
a real customer channel by mistake.

Kept in its own router/file, separate from api/v1/omnichannel.py, because
its auth model is fundamentally different (no admin JWT on the Telegram
path) - never processes anything slow inline, just ingests the message and
hands off to Celery (spec section 30).
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.v1.auth import get_current_admin
from app.models.administrator import Administrator
from app.models.omnichannel import OmniChannelAccount
from app.integrations.omnichannel.connectors.base import NormalizedIncomingMessage
from app.integrations.omnichannel.connectors.registry import get_connector
from app.services.omnichannel_service import OmnichannelService
from app.tasks.omnichannel import generate_ai_draft_task
from app.schemas.schemas import OmniSimulateMessageRequest, OmniMessageResponse

router = APIRouter()


def _ingest_and_trigger(db: Session, account: OmniChannelAccount, messages: list[NormalizedIncomingMessage]):
    triggered = []
    for normalized in messages:
        message = OmnichannelService.ingest_message(db, account, normalized)
        if message:
            # Blocked customers: the message is still saved (ingest_message
            # already filed the conversation into SPAM) but never gets an AI
            # draft - see OmniCustomer.is_blocked docstring.
            if not message.conversation.customer.is_blocked:
                generate_ai_draft_task.delay(str(message.id))
            triggered.append(message)
    return triggered


@router.post("/webhooks/telegram/{channel_account_id}")
async def telegram_webhook(channel_account_id: uuid.UUID, request: Request, db: Session = Depends(get_db)):
    account = db.query(OmniChannelAccount).filter(
        OmniChannelAccount.id == channel_account_id, OmniChannelAccount.channel == "telegram"
    ).first()
    if not account:
        # Deliberately identical 404 whether the account doesn't exist or the
        # channel doesn't match - never confirm/deny a channel_account_id to
        # an unauthenticated caller.
        raise HTTPException(status_code=404, detail="Not found")

    connector = get_connector(account)
    headers = {k.lower(): v for k, v in request.headers.items()}
    if not connector.verify_webhook(headers, account.webhook_secret):
        raise HTTPException(status_code=403, detail="Webhook verification failed")

    payload = await request.json()
    messages = connector.parse_webhook(payload)
    _ingest_and_trigger(db, account, messages)
    return {"ok": True}


@router.post("/dev/simulate-message", response_model=OmniMessageResponse, status_code=status.HTTP_201_CREATED)
def simulate_message(payload: OmniSimulateMessageRequest, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    account = db.query(OmniChannelAccount).filter(
        OmniChannelAccount.id == payload.channel_account_id, OmniChannelAccount.owner_id == admin.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Canale non trovato")
    if account.channel != "mock":
        raise HTTPException(
            status_code=400,
            detail="La simulazione è disponibile solo per canali di tipo 'mock' - crea un canale mock in Impostazioni per testare l'intero flusso senza credenziali reali",
        )

    connector = get_connector(account)
    normalized = connector.parse_webhook({
        "external_user_id": payload.external_user_id,
        "text": payload.text,
        "customer_name": payload.customer_name,
    })
    messages = _ingest_and_trigger(db, account, normalized)
    if not messages:
        raise HTTPException(status_code=400, detail="Messaggio duplicato o non ingerito")
    return messages[0]
