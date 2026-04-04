from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ApiErrorBody(BaseModel):
    code: str
    message: str
    timestamp: str
    path: str


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_error(code: str, message: str, path: str) -> dict:
    payload = ApiErrorBody(
        code=code,
        message=message,
        timestamp=_now_iso(),
        path=path,
    )
    return payload.model_dump()


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        message = str(exc.detail)
        error = _build_error(
            code=f"HTTP_{exc.status_code}",
            message=message,
            path=request.url.path,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": message, "error": error},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        message = "Request validation failed"
        error = _build_error(
            code="VALIDATION_ERROR",
            message=message,
            path=request.url.path,
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": message, "error": error, "issues": exc.errors()},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        error = _build_error(
            code="INTERNAL_SERVER_ERROR",
            message="Unexpected server error",
            path=request.url.path,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Unexpected server error", "error": error},
        )
