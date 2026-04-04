from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.routes import missing, found, admin, auth
from app.database.mongo import ping_database, init_database
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.rate_limit import RateLimitMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_database()
    # Track dependencies readiness so deployment checks are explicit.
    app.state.is_ready = await ping_database()

    # Pre-warm the InsightFace model so the first request is fast
    try:
        from app.services.face_recognition import _get_face_app
        _get_face_app()
    except Exception:
        pass

    # Re-process any reports left incomplete by previous container restarts
    import asyncio
    asyncio.create_task(_reprocess_stale_reports())

    yield


async def _reprocess_stale_reports() -> None:
    """Find reports with missing embeddings and re-run extraction + matching."""
    import logging
    from app.database.mongo import get_database
    from app.services.face_recognition import extract_embedding
    from app.routes.missing import _match_missing_against_found
    from app.routes.found import _match_found_against_missing

    log = logging.getLogger("findmeai.reprocess")
    log.setLevel(logging.INFO)
    if not log.handlers:
        log.addHandler(logging.StreamHandler())
    db = get_database()

    # Stale missing reports: status is None, "processing", or embedding is empty
    stale_missing = await db["missing_reports"].find(
        {"$or": [{"status": None}, {"status": "processing"}, {"embedding": []}]}
    ).to_list(None)
    log.info("Found %d stale missing reports to reprocess", len(stale_missing))

    for doc in stale_missing:
        rid = str(doc["_id"])
        try:
            embedding = await asyncio.to_thread(extract_embedding, doc["image_path"])
            await db["missing_reports"].update_one(
                {"_id": doc["_id"]},
                {"$set": {"embedding": embedding, "status": "ready"}},
            )
            doc["embedding"] = embedding
            user_id = doc.get("created_by", "")
            await _match_missing_against_found(db, doc, user_id)
            log.info("Reprocessed stale missing report %s", rid)
        except Exception as exc:
            log.warning("Failed to reprocess missing report %s: %s", rid, exc)
            await db["missing_reports"].update_one(
                {"_id": doc["_id"]}, {"$set": {"status": "failed"}}
            )

    stale_found = await db["found_reports"].find(
        {"$or": [{"status": None}, {"status": "processing"}, {"embedding": []}]}
    ).to_list(None)
    log.info("Found %d stale found reports to reprocess", len(stale_found))

    for doc in stale_found:
        rid = str(doc["_id"])
        try:
            embedding = await asyncio.to_thread(extract_embedding, doc["image_path"])
            await db["found_reports"].update_one(
                {"_id": doc["_id"]},
                {"$set": {"embedding": embedding, "status": "ready"}},
            )
            doc["embedding"] = embedding
            user_id = doc.get("created_by", "")
            await _match_found_against_missing(db, doc, user_id)
            log.info("Reprocessed stale found report %s", rid)
        except Exception as exc:
            log.warning("Failed to reprocess found report %s: %s", rid, exc)
            await db["found_reports"].update_one(
                {"_id": doc["_id"]}, {"$set": {"status": "failed"}}
            )


def create_app() -> FastAPI:
    app = FastAPI(
        title="Find Me AI - Missing & Found Platform",
        version=settings.app_version,
        docs_url="/",
        redoc_url=None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RateLimitMiddleware)
    register_exception_handlers(app)

    # Ensure upload directories exist
    os.makedirs("uploads/missing", exist_ok=True)
    os.makedirs("uploads/found", exist_ok=True)

    # Mount uploads as static (optional: for admin/debug)
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

    # Routers
    app.include_router(missing.router, prefix="/missing", tags=["missing"])
    app.include_router(found.router, prefix="/found", tags=["found"])
    app.include_router(admin.router, prefix="/admin", tags=["admin"])
    app.include_router(auth.router, prefix="/auth", tags=["auth"])

    @app.get("/health")
    async def health() -> dict:
        return {
            "status": "ok",
            "service": settings.app_name,
            "environment": settings.app_env,
            "version": settings.app_version,
        }

    @app.get("/ready")
    async def ready() -> dict:
        db_ok = await ping_database()
        app.state.is_ready = db_ok
        return {
            "status": "ready" if db_ok else "not_ready",
            "database": "ok" if db_ok else "unavailable",
        }

    return app


app = create_app()
