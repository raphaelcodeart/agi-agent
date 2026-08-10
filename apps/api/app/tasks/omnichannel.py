import uuid
from celery.utils.log import get_task_logger
from app.workers.celery_app import celery
from app.db.session import SessionLocal
from app.services.omnichannel_draft_service import OmnichannelDraftService

logger = get_task_logger(__name__)

@celery.task(name="app.tasks.omnichannel.generate_ai_draft_task")
def generate_ai_draft_task(message_id_str: str) -> None:
    """
    Background task triggered right after a new inbound message is ingested
    (see app/api/v1/omnichannel_webhooks.py). Generates the AI draft reply and
    leaves it as PENDING_APPROVAL/HUMAN_REVIEW_REQUIRED - never sends anything.
    """
    logger.info(f"Generating AI draft for omnichannel message {message_id_str}")
    message_id = uuid.UUID(message_id_str)

    db = SessionLocal()
    try:
        OmnichannelDraftService.generate_draft_for_message(db, message_id)
        logger.info(f"Completed AI draft generation for message {message_id_str}")
    except Exception as e:
        logger.error(f"Error generating AI draft for message {message_id_str}: {str(e)}")
    finally:
        db.close()
