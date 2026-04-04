# Backend Demo Runbook

## 1) Setup

1. Copy `.env.example` to `.env`.
2. Ensure Docker Desktop is running.
3. From `backend/`, run:

```bash
docker compose up --build
```

## 2) Verify Service Health

1. API docs: `http://localhost:8000/`
2. Health check: `GET http://localhost:8000/health`
3. Readiness check: `GET http://localhost:8000/ready`

## 3) Demo Flow

1. Sign up a `user` via `POST /auth/signup`.
2. Sign up an `authority` via `POST /auth/signup` with role `authority`.
3. Login and capture bearer tokens.
4. Submit a missing report via `POST /missing/` with image + form data.
5. Submit a found report via `POST /found/` with image + form data.
6. View alerts as authority via `GET /admin/alerts`.
7. Use list filters and pagination:
   - `GET /admin/missing?name=...&skip=0&limit=20`
   - `GET /admin/found?found_location=...&skip=0&limit=20`

## 4) Notes

1. Rate limiting is enabled by default and configurable via `.env`.
2. Audit logs are written to the `audit_logs` collection.
3. Uploaded files are served at `/uploads/...`.
