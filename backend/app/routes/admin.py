import asyncio
import glob
import os
import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.database.mongo import get_db
from app.routes.auth import get_current_authority
from app.core.audit import log_audit_event
from app.services.face_recognition import compute_hybrid_match, extract_embedding
from app.core.config import settings


router = APIRouter()


def _normalize_pagination(skip: int, limit: int) -> tuple[int, int]:
    normalized_skip = max(skip, 0)
    normalized_limit = min(max(limit, 1), 100)
    return normalized_skip, normalized_limit


@router.get("/cameras")
async def list_cameras(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_authority),
):
    """
    List all registered surveillance cameras.
    Returns camera metadata including status and last captured frame.
    """
    cursor = db["cameras"].find({}).sort("created_at", 1)
    cameras: list[dict] = []
    async for camera in cursor:
        camera["_id"] = str(camera["_id"])
        cameras.append(camera)
    
    if not cameras:
        return {
            "cameras": [
                {
                    "id": "CAM-01",
                    "name": "Front Entrance",
                    "location": "Main Gate",
                    "status": "online",
                    "stream_url": "/camera/CAM-01/stream",
                    "last_updated": datetime.utcnow().isoformat(),
                },
                {
                    "id": "CAM-02",
                    "name": "Parking Lot",
                    "location": "East Wing",
                    "status": "online",
                    "stream_url": "/camera/CAM-02/stream",
                    "last_updated": datetime.utcnow().isoformat(),
                },
                {
                    "id": "CAM-03",
                    "name": "Corridor",
                    "location": "Building B",
                    "status": "offline",
                    "stream_url": None,
                    "last_updated": (datetime.utcnow()).isoformat(),
                },
            ]
        }
    
    return {"cameras": cameras}


@router.post("/cameras/register")
async def register_camera(
    payload: dict,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_authority),
):
    """Register a new surveillance camera feed."""
    camera_doc = {
        "name": payload.get("name", "Unknown Camera"),
        "location": payload.get("location", "Unknown Location"),
        "status": "online",
        "stream_url": payload.get("stream_url"),
        "created_at": datetime.utcnow(),
    }
    inserted = await db["cameras"].insert_one(camera_doc)
    camera_doc["_id"] = str(inserted.inserted_id)
    return {"camera": camera_doc}


@router.get("/surveillance-live")
async def get_surveillance_live_events(
    camera_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_authority),
):
    """
    Fetch live surveillance alerts (webcam matches) with optional camera filter.
    Returns the most recent alerts ordered by timestamp.
    """
    query: dict = {"type": "webcam_match"}
    if camera_id:
        query["camera_name"] = camera_id
    
    cursor = db["alerts"].find(query).sort("created_at", -1).limit(limit)
    alerts: list[dict] = []
    async for alert in cursor:
        alert["_id"] = str(alert["_id"])
        alerts.append(alert)
    
    return {
        "alerts": alerts,
        "timestamp": datetime.utcnow().isoformat(),
    }


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


@router.post("/webcam-scan")
async def scan_webcam_snapshot(
    camera_name: str | None = Form(default=None),
    image: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_authority),
):
    if not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image",
        )

    ext = os.path.splitext(image.filename or "")[1] or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    save_dir = "uploads/live"
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, filename)

    content = await image.read()
    with open(save_path, "wb") as write_file:
        write_file.write(content)

    try:
        embedding = await asyncio.to_thread(extract_embedding, save_path)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unable to detect a face in the live frame: {exc}",
        )

    matches: list[dict] = []
    query = {
        "status": "ready",
        "embedding": {"$exists": True, "$ne": []},
    }
    cursor = db["missing_reports"].find(query)
    authority_name = current_user.get("name") or "Admin"
    found_location = camera_name or "Live Camera"
    screenshot_path = f"/uploads/live/{filename}"

    async for missing in cursor:
        score, details = compute_hybrid_match(missing, {"embedding": embedding})
        if score >= settings.similarity_threshold:
            match_doc = {
                "type": "webcam_match",
                "missing_id": str(missing["_id"]),
                "similarity": score,
                "authority_id": str(current_user["_id"]),
                "authority_name": authority_name,
                "authority_phone": current_user.get("phone_number"),
                "camera_name": camera_name or "live-camera",
                "screenshot_url": screenshot_path,
                "found_location": found_location,
                "found_image_path": screenshot_path,
                "missing_name": missing.get("name"),
                "missing_image_path": missing.get("image_path"),
                "scoring": details,
                "created_at": datetime.utcnow(),
            }
            await db["alerts"].insert_one(match_doc)
            matches.append({
                "missing_id": match_doc["missing_id"],
                "missing_name": match_doc.get("missing_name"),
                "missing_age": missing.get("age"),
                "missing_gender": missing.get("gender"),
                "missing_location": missing.get("last_seen_location"),
                "missing_image_path": match_doc.get("missing_image_path"),
                "found_location": match_doc.get("found_location"),
                "found_image_path": match_doc.get("found_image_path"),
                "authority_name": match_doc.get("authority_name"),
                "authority_phone": match_doc.get("authority_phone"),
                "similarity": match_doc["similarity"],
                "scoring": details,
            })

    await log_audit_event(
        db=db,
        event_type="admin.webcam_scan.completed",
        actor_id=str(current_user["_id"]),
        metadata={
            "camera_name": camera_name,
            "matches": len(matches),
        },
    )

    return {
        "matches": matches,
        "screenshot_url": f"/uploads/live/{filename}",
    }


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
