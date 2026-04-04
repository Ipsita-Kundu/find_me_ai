from datetime import datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings


async def log_audit_event(
    db: AsyncIOMotorDatabase,
    event_type: str,
    actor_id: str | None,
    metadata: dict[str, Any] | None = None,
) -> None:
    if not settings.audit_log_enabled:
        return

    payload = {
        "event_type": event_type,
        "actor_id": actor_id,
        "metadata": metadata or {},
        "created_at": datetime.utcnow(),
    }

    try:
        await db["audit_logs"].insert_one(payload)
    except Exception:
        # Audit failures should not break primary API actions.
        return
