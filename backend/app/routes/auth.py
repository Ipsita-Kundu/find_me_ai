from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.database.mongo import get_db
from app.core.audit import log_audit_event
from app.models import (
    AuthResponse,
    GoogleLoginRequest,
    UserChangePasswordRequest,
    UserLoginRequest,
    UserPublic,
    UserSignupRequest,
)


router = APIRouter()
auth_scheme = HTTPBearer(auto_error=False)


def user_to_public(user_doc: dict) -> UserPublic:
    return UserPublic(
        id=str(user_doc["_id"]),
        name=user_doc["name"],
        email=user_doc["email"],
        phone_number=user_doc.get("phone_number"),
        provider=user_doc.get("provider", "email"),
        role=user_doc.get("role", "user"),
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(auth_scheme),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    user_id = decode_access_token(credentials.credentials)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    try:
        object_id = ObjectId(user_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        ) from exc

    user = await db["users"].find_one({"_id": object_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


async def get_current_authority(
    current_user: dict = Depends(get_current_user),
) -> dict:
    if current_user.get("role", "user") != "authority":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authority access required",
        )
    return current_user


@router.post("/signup", response_model=AuthResponse)
async def signup(payload: UserSignupRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    role = payload.role.strip().lower() if payload.role else "user"
    if role not in {"user", "authority"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be either 'user' or 'authority'",
        )

    existing = await db["users"].find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user_doc = {
        "name": payload.name.strip(),
        "email": payload.email.lower(),
        "phone_number": payload.phone_number.strip(),
        "password_hash": hash_password(payload.password),
        "provider": "email",
        "role": role,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "last_login_at": datetime.utcnow(),
    }
    try:
        inserted = await db["users"].insert_one(user_doc)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        ) from exc
    user_doc["_id"] = inserted.inserted_id
    await log_audit_event(
        db=db,
        event_type="auth.signup",
        actor_id=str(inserted.inserted_id),
        metadata={"provider": "email", "role": role},
    )

    token = create_access_token(str(inserted.inserted_id))
    return AuthResponse(access_token=token, user=user_to_public(user_doc))


@router.post("/login", response_model=AuthResponse)
async def login(payload: UserLoginRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    user = await db["users"].find_one({"email": payload.email.lower()})
    if not user or not user.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    await db["users"].update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login_at": datetime.utcnow(), "updated_at": datetime.utcnow()}},
    )

    await log_audit_event(
        db=db,
        event_type="auth.login",
        actor_id=str(user["_id"]),
        metadata={"provider": user.get("provider", "email")},
    )

    token = create_access_token(str(user["_id"]))
    return AuthResponse(access_token=token, user=user_to_public(user))


@router.post("/google", response_model=AuthResponse)
async def login_with_google(
    payload: GoogleLoginRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    allowed_client_ids = settings.google_client_ids
    if not allowed_client_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google login is not configured",
        )

    try:
        # Verify signature and standard claims first; validate audience below.
        info = google_id_token.verify_oauth2_token(
            payload.id_token,
            google_requests.Request(),
            None,
            clock_skew_in_seconds=10,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {exc}",
        ) from exc

    aud = str(info.get("aud", "")).strip()
    azp = str(info.get("azp", "")).strip()
    if aud not in allowed_client_ids and azp not in allowed_client_ids:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token audience does not match configured client ID",
        )

    email = str(info.get("email", "")).lower().strip()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account email is unavailable",
        )

    name = str(info.get("name") or email.split("@")[0]).strip()

    user = await db["users"].find_one({"email": email})
    if not user:
        user = {
            "name": name,
            "email": email,
            "provider": "google",
            "role": "user",
            "google_sub": info.get("sub"),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "last_login_at": datetime.utcnow(),
        }
        inserted = await db["users"].insert_one(user)
        user["_id"] = inserted.inserted_id
        await log_audit_event(
            db=db,
            event_type="auth.signup",
            actor_id=str(inserted.inserted_id),
            metadata={"provider": "google", "role": "user"},
        )

    await db["users"].update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login_at": datetime.utcnow(), "updated_at": datetime.utcnow()}},
    )

    await log_audit_event(
        db=db,
        event_type="auth.login",
        actor_id=str(user["_id"]),
        metadata={"provider": "google"},
    )

    token = create_access_token(str(user["_id"]))
    return AuthResponse(access_token=token, user=user_to_public(user))


@router.get("/me", response_model=UserPublic)
async def me(current_user: dict = Depends(get_current_user)):
    return user_to_public(current_user)


@router.post("/change-password")
async def change_password(
    payload: UserChangePasswordRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("provider") != "email":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password change is only available for email accounts",
        )

    if not verify_password(payload.current_password, current_user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    new_hash = hash_password(payload.new_password)
    await db["users"].update_one(
        {"_id": current_user["_id"]},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.utcnow()}},
    )

    await log_audit_event(
        db=db,
        event_type="auth.password_changed",
        actor_id=str(current_user["_id"]),
        metadata={"provider": current_user.get("provider", "email")},
    )

    return {"message": "Password updated successfully"}


@router.get("/my-alerts")
async def my_alerts(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    phone = current_user.get("phone_number")

    ownership_conditions: list[dict] = [
        {"missing_created_by": user_id},
        {"found_created_by": user_id},
        {"authority_id": user_id},
    ]
    if phone:
        ownership_conditions.extend(
            [
                {"missing_contact_phone": phone},
                {"found_contact_phone": phone},
                {"authority_phone": phone},
            ]
        )

    items_by_id: dict[str, dict] = {}

    cursor = db["alerts"].find({"$or": ownership_conditions}).sort("created_at", -1)
    async for item in cursor:
        item_id = str(item["_id"])
        item["_id"] = item_id
        items_by_id[item_id] = item

    # Fallback for older alerts created before ownership fields existed.
    missing_ids: list[str] = []
    found_ids: list[str] = []

    missing_cursor = db["missing_reports"].find({"created_by": user_id}, {"_id": 1})
    async for report in missing_cursor:
        missing_ids.append(str(report["_id"]))

    found_cursor = db["found_reports"].find({"created_by": user_id}, {"_id": 1})
    async for report in found_cursor:
        found_ids.append(str(report["_id"]))

    legacy_conditions: list[dict] = []
    if missing_ids:
        legacy_conditions.append({"missing_id": {"$in": missing_ids}})
    if found_ids:
        legacy_conditions.append({"found_id": {"$in": found_ids}})

    if legacy_conditions:
        legacy_cursor = db["alerts"].find({"$or": legacy_conditions}).sort("created_at", -1)
        async for item in legacy_cursor:
            item_id = str(item["_id"])
            item["_id"] = item_id
            items_by_id[item_id] = item

    items = sorted(
        items_by_id.values(),
        key=lambda alert: alert.get("created_at") or datetime.min,
        reverse=True,
    )
    return {"alerts": items}


@router.patch("/alerts/{alert_id}/read")
async def mark_alert_read(
    alert_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        oid = ObjectId(alert_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid alert ID")

    result = await db["alerts"].update_one(
        {"_id": oid},
        {"$set": {"read_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "ok"}


@router.patch("/alerts/read-all")
async def mark_all_alerts_read(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    phone = current_user.get("phone_number")

    conditions: list[dict] = [
        {"missing_created_by": user_id},
        {"found_created_by": user_id},
        {"authority_id": user_id},
    ]
    if phone:
        conditions.extend(
            [
                {"missing_contact_phone": phone},
                {"found_contact_phone": phone},
                {"authority_phone": phone},
            ]
        )

    result = await db["alerts"].update_many(
        {"$or": conditions, "read_at": {"$exists": False}},
        {"$set": {"read_at": datetime.utcnow()}},
    )
    return {"status": "ok", "modified": result.modified_count}


@router.delete("/alerts/clear")
async def clear_all_alerts(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    phone = current_user.get("phone_number")

    conditions: list[dict] = [
        {"missing_created_by": user_id},
        {"found_created_by": user_id},
        {"authority_id": user_id},
    ]
    if phone:
        conditions.extend(
            [
                {"missing_contact_phone": phone},
                {"found_contact_phone": phone},
                {"authority_phone": phone},
            ]
        )

    result = await db["alerts"].delete_many({"$or": conditions})
    return {"status": "ok", "deleted": result.deleted_count}


@router.get("/alerts/{alert_id}/contact")
async def reveal_contact(
    alert_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Reveal finder contact info and notify the finder about the contact share."""
    from bson import ObjectId

    try:
        oid = ObjectId(alert_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid alert ID")

    alert = await db["alerts"].find_one({"_id": oid})
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Verify the requester owns the missing report
    user_id = str(current_user["_id"])
    if alert.get("missing_created_by") != user_id:
        raise HTTPException(status_code=403, detail="Not your alert")

    # Get the finder's info
    found_created_by = alert.get("found_created_by")
    finder_name = "Anonymous"
    finder_phone = alert.get("found_contact_phone")

    if found_created_by:
        try:
            finder_user = await db["users"].find_one({"_id": ObjectId(found_created_by)})
            if finder_user:
                finder_name = finder_user.get("name", "Anonymous")
                if not finder_phone:
                    finder_phone = finder_user.get("phone_number")
        except Exception:
            pass

    # Fallback: check found report's contact_info field
    if not finder_phone:
        found_id = alert.get("found_id")
        if found_id:
            try:
                found_doc = await db["found_reports"].find_one({"_id": ObjectId(found_id)})
                if found_doc and found_doc.get("contact_info"):
                    finder_phone = found_doc["contact_info"]
            except Exception:
                pass

    # Create a notification for the finder that their contact was shared
    if found_created_by:
        requester_name = current_user.get("name", "Someone")
        await db["alerts"].insert_one({
            "type": "contact_shared",
            "message": f"{requester_name} has viewed your contact information for a potential match.",
            "missing_id": alert.get("missing_id"),
            "found_id": alert.get("found_id"),
            "similarity": alert.get("similarity", 0),
            "missing_created_by": found_created_by,
            "found_created_by": found_created_by,
            "created_at": datetime.utcnow(),
        })

    # Mark the reveal on the original alert
    await db["alerts"].update_one(
        {"_id": oid},
        {"$set": {"contact_revealed_at": datetime.utcnow(), "contact_revealed_by": user_id}},
    )

    return {
        "finder_name": finder_name,
        "finder_phone": finder_phone,
        "similarity": alert.get("similarity", 0),
    }
