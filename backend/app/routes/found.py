import asyncio
import os
import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File, Form, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.mongo import get_db
from app.models import FoundPerson, FoundPersonCreate, MatchResult
from app.routes.auth import get_current_user
from app.services.face_recognition import extract_embedding, compute_hybrid_match
from app.core.config import settings
from app.core.audit import log_audit_event


router = APIRouter()


@router.post("/", response_model=dict)
async def create_found_person(
    estimated_age: int | None = Form(default=None),
    gender: str | None = Form(default=None),
    birthmarks: str | None = Form(default=None),
    found_location: str | None = Form(default=None),
    contact_info: str | None = Form(default=None),
    additional_info: str | None = Form(default=None),
    image: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be an image")

    ext = os.path.splitext(image.filename or "")[1] or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    save_path = os.path.join("uploads", "found", filename)

    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    with open(save_path, "wb") as f:
        f.write(await image.read())

    doc = {
        "estimated_age": estimated_age,
        "gender": gender,
        "birthmarks": birthmarks,
        "found_location": found_location,
        "contact_info": contact_info,
        "additional_info": additional_info,
        "image_path": save_path,
        "embedding": [],
        "status": "processing",
        "created_by": str(current_user["_id"]),
        "created_by_phone": current_user.get("phone_number"),
        "created_at": datetime.utcnow(),
    }

    result = await db["found_reports"].insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    await log_audit_event(
        db=db,
        event_type="report.found.created",
        actor_id=str(current_user["_id"]),
        metadata={"report_id": doc["_id"]},
    )

    # Embedding extraction + matching runs in background
    background_tasks.add_task(
        _process_found_report, db, doc, str(current_user["_id"])
    )

    return {
        "report": doc,
        "report_id": doc["_id"],
        "matches": [],
        "match_details": [],
    }


async def _process_found_report(
    db: AsyncIOMotorDatabase, doc: dict, user_id: str
) -> None:
    """Background: extract embedding, update report, then scan for matches."""
    from bson import ObjectId
    report_id = doc["_id"]
    save_path = doc["image_path"]

    try:
        embedding = await asyncio.to_thread(extract_embedding, save_path)
    except Exception:
        await db["found_reports"].update_one(
            {"_id": ObjectId(report_id)}, {"$set": {"status": "failed"}}
        )
        return

    await db["found_reports"].update_one(
        {"_id": ObjectId(report_id)},
        {"$set": {"embedding": embedding, "status": "ready"}},
    )
    doc["embedding"] = embedding

    await _match_found_against_missing(db, doc, user_id)


async def _match_found_against_missing(
    db: AsyncIOMotorDatabase, doc: dict, user_id: str
) -> None:
    """Background task: scan missing_reports and create alerts for matches."""
    cursor = db["missing_reports"].find(
        {},
        {
            "embedding": 1,
            "age": 1,
            "gender": 1,
            "birthmarks": 1,
            "last_seen_location": 1,
            "additional_info": 1,
            "created_by": 1,
            "created_by_phone": 1,
        },
    )
    candidate_matches: list[dict] = []
    async for missing in cursor:
        score, details = compute_hybrid_match(missing, doc)
        if (
            score >= settings.similarity_threshold
            and details["metadata_score"] >= settings.metadata_min_score
        ):
            candidate_matches.append(
                {
                    "missing_id": str(missing["_id"]),
                    "found_id": str(doc["_id"]),
                    "similarity": score,
                    "missing_created_by": missing.get("created_by"),
                    "missing_contact_phone": missing.get("created_by_phone"),
                    "found_created_by": user_id,
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

        await db["alerts"].insert_one(
            {
                "missing_id": candidate["missing_id"],
                "found_id": candidate["found_id"],
                "similarity": candidate["similarity"],
                "missing_created_by": candidate.get("missing_created_by"),
                "missing_contact_phone": candidate.get("missing_contact_phone"),
                "found_created_by": user_id,
                "found_contact_phone": doc.get("created_by_phone") or doc.get("contact_info"),
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
async def list_my_found_reports(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    items: list[dict] = []
    cursor = db["found_reports"].find({"created_by": str(current_user["_id"])}).sort("created_at", -1)
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)
    return items


@router.delete("/{report_id}")
async def delete_found_report(
    report_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from bson import ObjectId
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid report ID")

    report = await db["found_reports"].find_one({"_id": oid})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.get("created_by") != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not your report")

    await db["found_reports"].delete_one({"_id": oid})
    await db["alerts"].delete_many({"found_id": report_id})

    image_path = report.get("image_path")
    if image_path and os.path.exists(image_path):
        os.remove(image_path)

    return {"message": "Report deleted"}
