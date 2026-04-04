from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import AsyncGenerator
from pymongo import ASCENDING, DESCENDING

from app.core.config import settings


_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongodb_uri)
    return _client


def get_database() -> AsyncIOMotorDatabase:
    client = get_client()
    return client[settings.mongodb_db]


async def init_database() -> None:
    db = get_database()

    # Auth-critical unique index to prevent duplicate signups.
    await db["users"].create_index([("email", ASCENDING)], unique=True, name="uniq_email")
    await db["users"].create_index([("role", ASCENDING)], name="users_role_idx")
    await db["users"].create_index([("provider", ASCENDING)], name="users_provider_idx")
    await db["users"].create_index([("last_login_at", DESCENDING)], name="users_last_login_desc")

    # Useful indexes for list endpoints and dashboard queries.
    await db["users"].create_index([("created_at", DESCENDING)], name="users_created_at_desc")
    await db["missing_reports"].create_index([("created_at", DESCENDING)], name="missing_created_at_desc")
    await db["found_reports"].create_index([("created_at", DESCENDING)], name="found_created_at_desc")
    await db["alerts"].create_index([("created_at", DESCENDING)], name="alerts_created_at_desc")
    await db["audit_logs"].create_index([("created_at", DESCENDING)], name="audit_created_at_desc")
    await db["audit_logs"].create_index([("event_type", ASCENDING)], name="audit_event_type_idx")


async def ping_database() -> bool:
    db = get_database()
    try:
        await db.command("ping")
        return True
    except Exception:
        return False


async def get_db() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    db = get_database()
    try:
        yield db
    finally:
        # Motor manages connection pooling; nothing special needed here
        pass
