import os
import glob
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.database.mongo import get_db
from app.routes.auth import get_current_authority
from app.core.audit import log_audit_event
from app.services.face_recognition import compute_hybrid_match
from app.core.config import settings


router = APIRouter()


def _normalize_pagination(skip: int, limit: int) -> tuple[int, int]:
    normalized_skip = max(skip, 0)
    normalized_limit = min(max(limit, 1), 100)
    return normalized_skip, normalized_limit


@router.get("/my-alerts")
async def list_my_alerts(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_authority),
):
    phone = current_user.get("phone_number")
    if not phone:
        return {"alerts": []}

    query = {
        "$or": [
            {"missing_contact_phone": phone},
            {"found_contact_phone": phone},
            {"authority_phone": phone},
        ]
    }
    cursor = db["alerts"].find(query).sort("created_at", -1)
    alerts: List[dict] = []
    async for alert in cursor:
        alert["_id"] = str(alert["_id"])
        alerts.append(alert)
    return {"alerts": alerts}


@router.post("/authority-records")
async def create_authority_record(
    payload: dict,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_authority),
):
    authority_record = {
        "name": payload.get("name"),
        "age": payload.get("age"),
        "gender": payload.get("gender"),
        "birthmarks": payload.get("birthmarks"),
        "last_seen_location": payload.get("last_seen_location"),
        "additional_info": payload.get("additional_info"),
        "embedding": payload.get("embedding", []),
        "authority_id": str(current_user["_id"]),
        "authority_phone": current_user.get("phone_number"),
        "created_at": datetime.utcnow(),
    }

    inserted = await db["authority_records"].insert_one(authority_record)
    authority_record["_id"] = str(inserted.inserted_id)

    matches: list[dict] = []
    cursor = db["found_reports"].find(
        {},
        {
            "embedding": 1,
            "estimated_age": 1,
            "gender": 1,
            "birthmarks": 1,
            "found_location": 1,
            "additional_info": 1,
            "created_by_phone": 1,
        },
    )
    async for found in cursor:
        score, details = compute_hybrid_match(authority_record, found)
        if (
            score >= settings.similarity_threshold
            and details["metadata_score"] >= settings.metadata_min_score
        ):
            found_id = str(found["_id"])
            match_doc = {
                "authority_record_id": authority_record["_id"],
                "found_id": found_id,
                "similarity": score,
                "authority_phone": current_user.get("phone_number"),
                "found_contact_phone": found.get("created_by_phone"),
                "scoring": details,
                "created_at": datetime.utcnow(),
            }
            await db["alerts"].insert_one(match_doc)
            matches.append(match_doc)

    await log_audit_event(
        db=db,
        event_type="admin.authority_record.created",
        actor_id=str(current_user["_id"]),
        metadata={"record_id": authority_record["_id"], "match_count": len(matches)},
    )
    return {"record": authority_record, "matches": matches}


@router.post("/webcam-alert")
async def create_webcam_alert(
    payload: dict,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_authority),
):
    # Demo endpoint to simulate a CCTV/webcam hit with timestamp and screenshot.
    alert = {
        "type": "webcam_match",
        "authority_id": str(current_user["_id"]),
        "authority_phone": current_user.get("phone_number"),
        "record_id": payload.get("record_id"),
        "captured_at": payload.get("captured_at") or datetime.utcnow().isoformat(),
        "screenshot_url": payload.get("screenshot_url"),
        "camera_name": payload.get("camera_name") or "demo-webcam",
        "created_at": datetime.utcnow(),
    }
    inserted = await db["alerts"].insert_one(alert)
    alert["_id"] = str(inserted.inserted_id)
    return {"alert": alert}


@router.post("/social-scan")
async def social_scan(
    payload: dict,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_authority),
):
    # Demo placeholder for social platform scan requests.
    platforms = payload.get("platforms") or ["facebook", "instagram", "x"]
    keyword = payload.get("keyword") or payload.get("name") or "person"

    demo_hits = [
        {
            "platform": platform,
            "confidence": 0.72,
            "post_url": f"https://example.com/{platform}/{keyword}",
            "captured_at": datetime.utcnow().isoformat(),
        }
        for platform in platforms
    ]

    scan_doc = {
        "authority_id": str(current_user["_id"]),
        "keyword": keyword,
        "platforms": platforms,
        "hits": demo_hits,
        "created_at": datetime.utcnow(),
    }
    await db["social_scans"].insert_one(scan_doc)
    return {"results": demo_hits}


@router.get("/alerts")
async def list_alerts(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    missing_id: str | None = Query(default=None),
    found_id: str | None = Query(default=None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_authority),
):
    await log_audit_event(
        db=db,
        event_type="admin.alerts.view",
        actor_id=str(current_user["_id"]),
        metadata={"skip": skip, "limit": limit},
    )
    skip, limit = _normalize_pagination(skip, limit)

    query: dict = {}
    if missing_id:
        query["missing_id"] = missing_id
    if found_id:
        query["found_id"] = found_id

    total = await db["alerts"].count_documents(query)
    cursor = db["alerts"].find(query).sort("created_at", -1).skip(skip).limit(limit)
    alerts: List[dict] = []
    async for alert in cursor:
        alert["_id"] = str(alert["_id"])
        alerts.append(alert)
    return {"alerts": alerts, "pagination": {"skip": skip, "limit": limit, "total": total}}


@router.get("/missing")
async def list_missing_reports(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    name: str | None = Query(default=None),
    gender: str | None = Query(default=None),
    min_age: int | None = Query(default=None, ge=0),
    max_age: int | None = Query(default=None, ge=0),
    id: str | None = Query(default=None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_authority),
):
    await log_audit_event(
        db=db,
        event_type="admin.missing.view",
        actor_id=str(current_user["_id"]),
        metadata={"skip": skip, "limit": limit},
    )
    skip, limit = _normalize_pagination(skip, limit)

    query: dict = {}
    if id:
        try:
            query["_id"] = ObjectId(id)
        except Exception:
            query["_id"] = None
    if name:
        query["name"] = {"$regex": name, "$options": "i"}
    if gender:
        query["gender"] = {"$regex": f"^{gender}$", "$options": "i"}
    if min_age is not None or max_age is not None:
        age_filter: dict = {}
        if min_age is not None:
            age_filter["$gte"] = min_age
        if max_age is not None:
            age_filter["$lte"] = max_age
        query["age"] = age_filter

    total = await db["missing_reports"].count_documents(query)
    cursor = db["missing_reports"].find(query).sort("created_at", -1).skip(skip).limit(limit)
    items: List[dict] = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)
    return {
        "missing_reports": items,
        "pagination": {"skip": skip, "limit": limit, "total": total},
    }


@router.get("/found")
async def list_found_reports(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    found_location: str | None = Query(default=None),
    id: str | None = Query(default=None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_authority),
):
    await log_audit_event(
        db=db,
        event_type="admin.found.view",
        actor_id=str(current_user["_id"]),
        metadata={"skip": skip, "limit": limit},
    )
    skip, limit = _normalize_pagination(skip, limit)

    query: dict = {}
    if id:
        try:
            query["_id"] = ObjectId(id)
        except Exception:
            query["_id"] = None
    if found_location:
        query["found_location"] = {"$regex": found_location, "$options": "i"}

    total = await db["found_reports"].count_documents(query)
    cursor = db["found_reports"].find(query).sort("created_at", -1).skip(skip).limit(limit)
    items: List[dict] = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)
    return {
        "found_reports": items,
        "pagination": {"skip": skip, "limit": limit, "total": total},
    }


@router.delete("/reset-database")
async def reset_database(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_authority),
):
    """Clear all reports, alerts, and uploaded images. Users are preserved."""
    deleted_missing = await db["missing_reports"].delete_many({})
    deleted_found = await db["found_reports"].delete_many({})
    deleted_alerts = await db["alerts"].delete_many({})

    # Clean uploaded images
    for folder in ["uploads/missing", "uploads/found"]:
        for f in glob.glob(os.path.join(folder, "*")):
            if os.path.isfile(f):
                os.remove(f)

    await log_audit_event(
        db=db,
        event_type="admin.reset_database",
        actor_id=str(current_user["_id"]),
        metadata={
            "missing_deleted": deleted_missing.deleted_count,
            "found_deleted": deleted_found.deleted_count,
            "alerts_deleted": deleted_alerts.deleted_count,
        },
    )

    return {
        "message": "Database reset complete",
        "deleted": {
            "missing_reports": deleted_missing.deleted_count,
            "found_reports": deleted_found.deleted_count,
            "alerts": deleted_alerts.deleted_count,
        },
    }
