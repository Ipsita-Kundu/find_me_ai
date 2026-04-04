import asyncio
import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def dispatch(self, request: Request, call_next):
        if not settings.rate_limit_enabled:
            return await call_next(request)

        client_host = request.client.host if request.client else "unknown"
        route_key = f"{client_host}:{request.url.path}"
        now = time.time()
        window = settings.rate_limit_window_seconds
        max_requests = settings.rate_limit_requests

        async with self._lock:
            entries = self._requests[route_key]
            while entries and (now - entries[0] > window):
                entries.popleft()

            if len(entries) >= max_requests:
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Rate limit exceeded. Please retry shortly.",
                        "error": {
                            "code": "RATE_LIMIT_EXCEEDED",
                            "message": "Too many requests",
                            "path": request.url.path,
                        },
                    },
                )

            entries.append(now)

        return await call_next(request)
