import asyncio
import os
import uuid
from datetime import datetime
from typing import List, Any

from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File, Form, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.mongo import get_db
from app.models import MissingPerson, MissingPersonCreate, MatchResult
from app.routes.auth import get_current_user
from app.services.face_recognition import extract_embedding, compute_hybrid_match
from app.core.config import settings
from app.core.audit import log_audit_event


router = APIRouter()


@router.post("/", response_model=dict)
async def create_missing_person(
    name: str | None = Form(default=None),
    age: int | None = Form(default=None),
    gender: str | None = Form(default=None),
    birthmarks: str | None = Form(default=None),
    last_seen_location: str | None = Form(default=None),
    additional_info: str | None = Form(default=None),
    image: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be an image")

    # Save image
    ext = os.path.splitext(image.filename or "")[1] or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    save_path = os.path.join("uploads", "missing", filename)

    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    with open(save_path, "wb") as f:
        f.write(await image.read())

    doc = {
        "name": name,
        "age": age,
        "gender": gender,
        "birthmarks": birthmarks,
        "last_seen_location": last_seen_location,
        "additional_info": additional_info,
        "image_path": save_path,
        "embedding": [],
        "status": "processing",
        "created_by": str(current_user["_id"]),
        "created_by_phone": current_user.get("phone_number"),
        "created_at": datetime.utcnow(),
    }

    result = await db["missing_reports"].insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    await log_audit_event(
        db=db,
        event_type="report.missing.created",
        actor_id=str(current_user["_id"]),
        metadata={"report_id": doc["_id"]},
    )

    # Embedding extraction + matching runs in background
    background_tasks.add_task(
        _process_missing_report, db, doc, str(current_user["_id"])
    )

    return {
        "report": doc,
        "report_id": doc["_id"],
        "matches": [],
        "match_details": [],
    }


async def _process_missing_report(
    db: AsyncIOMotorDatabase, doc: dict, user_id: str
) -> None:
    """Background: extract embedding, update report, then scan for matches."""
    from bson import ObjectId
    report_id = doc["_id"]
    save_path = doc["image_path"]

    try:
        embedding = await asyncio.to_thread(extract_embedding, save_path)
    except Exception:
        await db["missing_reports"].update_one(
            {"_id": ObjectId(report_id)}, {"$set": {"status": "failed"}}
        )
        return

    await db["missing_reports"].update_one(
        {"_id": ObjectId(report_id)},
        {"$set": {"embedding": embedding, "status": "ready"}},
    )
    doc["embedding"] = embedding

    await _match_missing_against_found(db, doc, user_id)


async def _match_missing_against_found(
    db: AsyncIOMotorDatabase, doc: dict, user_id: str
) -> None:
    """Background task: scan found_reports and create alerts for matches."""
    from bson import ObjectId
    cursor = db["found_reports"].find(
        {},
        {
            "embedding": 1,
            "estimated_age": 1,
            "gender": 1,
            "birthmarks": 1,
            "found_location": 1,
            "additional_info": 1,
            "created_by": 1,
            "created_by_phone": 1,
        },
    )
    candidate_matches: list[dict] = []
    missing_id_str = str(doc["_id"])
    async for found in cursor:
        score, details = compute_hybrid_match(doc, found)
        if (
            score >= settings.similarity_threshold
            and details["metadata_score"] >= settings.metadata_min_score
        ):
            candidate_matches.append(
                {
                    "missing_id": missing_id_str,
                    "found_id": str(found["_id"]),
                    "similarity": score,
                    "found_created_by": found.get("created_by"),
                    "found_contact_phone": found.get("created_by_phone"),
                    "scoring": details,
                }
            )

    candidate_matches.sort(key=lambda item: item["similarity"], reverse=True)
    selected_matches = candidate_matches[: settings.max_matches_per_report]

    for candidate in selected_matches:
        existing_alert = await db["alerts"].find_one(
            {
                "missing_id": candidate["missing_id"],
                "found_id": candidate["found_id"],
                "type": {"$exists": False},
            }
        )
        if existing_alert:
            continue

        # Also fetch found report's contact_info for the alert
        found_contact = candidate.get("found_contact_phone")
        if not found_contact:
            try:
                frd = await db["found_reports"].find_one(
                    {"_id": ObjectId(candidate["found_id"])},
                    {"contact_info": 1},
                )
                if frd:
                    found_contact = frd.get("contact_info")
            except Exception:
                pass

        await db["alerts"].insert_one(
            {
                "missing_id": candidate["missing_id"],
                "found_id": candidate["found_id"],
                "similarity": candidate["similarity"],
                "missing_created_by": user_id,
                "missing_contact_phone": doc.get("created_by_phone"),
                "found_created_by": candidate.get("found_created_by"),
                "found_contact_phone": found_contact,
                "scoring": candidate.get("scoring"),
                "created_at": datetime.utcnow(),
            }
        )
        await log_audit_event(
            db=db,
            event_type="match.detected",
            actor_id=user_id,
            metadata={
                "missing_id": candidate["missing_id"],
                "found_id": candidate["found_id"],
                "similarity": candidate["similarity"],
            },
        )


@router.get("/mine", response_model=list[dict])
async def list_my_missing_reports(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    items: list[dict] = []
    cursor = db["missing_reports"].find({"created_by": str(current_user["_id"])}).sort("created_at", -1)
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)
    return items


@router.get("/{report_id}/matches", response_model=dict)
async def get_matches_for_report(
    report_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        from bson import ObjectId
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid report ID")

    report = await db["missing_reports"].find_one({"_id": oid})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.get("created_by") != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not your report")

    # Fetch alerts for this missing report (match alerts only, not contact_shared etc.)
    alerts: list[dict] = []
    seen_found_ids: set[str] = set()
    cursor = db["alerts"].find({
        "missing_id": report_id,
        "type": {"$exists": False},
    }).sort("similarity", -1)
    async for alert in cursor:
        fid = alert.get("found_id", "")
        if fid in seen_found_ids:
            continue  # skip duplicate match for same found report
        seen_found_ids.add(fid)
        alert["_id"] = str(alert["_id"])
        alerts.append(alert)

    # Enrich each alert with found report data
    enriched: list[dict] = []
    for alert in alerts:
        found_id = alert.get("found_id")
        found_doc = None
        if found_id:
            try:
                found_doc = await db["found_reports"].find_one({"_id": ObjectId(found_id)})
            except Exception:
                pass

        # Look up the found report creator's name and contact
        finder_name = "Anonymous"
        finder_phone = alert.get("found_contact_phone")
        found_created_by = alert.get("found_created_by") or (found_doc.get("created_by") if found_doc else None)
        if found_created_by:
            try:
                user_doc = await db["users"].find_one({"_id": ObjectId(found_created_by)})
                if user_doc:
                    finder_name = user_doc.get("name", "Anonymous")
                    if not finder_phone:
                        finder_phone = user_doc.get("phone_number")
            except Exception:
                pass
        # Fallback to found report's contact_info
        if not finder_phone and found_doc and found_doc.get("contact_info"):
            finder_phone = found_doc["contact_info"]

        enriched.append({
            "_id": alert["_id"],
            "missing_id": alert.get("missing_id"),
            "found_id": alert.get("found_id"),
            "similarity": alert.get("similarity", 0),
            "finder_name": finder_name,
            "finder_phone": finder_phone,
            "found_location": found_doc.get("found_location") if found_doc else None,
            "found_image_path": found_doc.get("image_path") if found_doc else None,
            "scoring": alert.get("scoring"),
            "created_at": alert.get("created_at", "").isoformat() if hasattr(alert.get("created_at", ""), "isoformat") else str(alert.get("created_at", "")),
        })

    return {
        "report_id": report_id,
        "missing_name": report.get("name", "Unknown"),
        "missing_image_path": report.get("image_path"),
        "matches": enriched,
    }


@router.delete("/{report_id}")
async def delete_missing_report(
    report_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from bson import ObjectId
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid report ID")

    report = await db["missing_reports"].find_one({"_id": oid})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.get("created_by") != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not your report")

    # Delete the report, associated alerts, and the image file
    await db["missing_reports"].delete_one({"_id": oid})
    await db["alerts"].delete_many({"missing_id": report_id})

    image_path = report.get("image_path")
    if image_path and os.path.exists(image_path):
        os.remove(image_path)

    return {"message": "Report deleted"}
