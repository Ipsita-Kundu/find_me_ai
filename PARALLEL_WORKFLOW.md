# Parallel Development Workflow

This project is ready for parallel development:

- Developer A: backend/model/API
- Developer B: frontend/UI/UX

## 1) Branch Strategy

- `main`: always stable and deployable
- `frontend-dev`: integration branch for frontend work
- `backend-dev`: integration branch for backend/model work

Feature branch naming:

- Frontend: `feat/ui-<task-name>`
- Backend: `feat/api-<task-name>` or `feat/model-<task-name>`

PR targets:

- Frontend features -> `frontend-dev`
- Backend features -> `backend-dev`
- Integration PRs -> `main`

## 2) Ownership Split

Frontend developer owns:

- Pages, components, layout, UX polish
- Form handling, validation, loading and error states
- Integration through `src/services/api.ts`

Backend developer owns:

- ML/model pipeline and recognition logic
- FastAPI endpoints, auth, validation, DB writes
- API response consistency with contract below

## 3) API Contract (Freeze This Early)

The frontend already expects these endpoints:

Auth:

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/google`
- `GET /auth/me`

Reports:

- `POST /missing/` (multipart form-data)
- `POST /found/` (multipart form-data)

Admin:

- `GET /admin/missing`
- `GET /admin/found`
- `GET /admin/alerts`

Base URL for frontend:

- `NEXT_PUBLIC_API_BASE_URL` (default: `http://localhost:8000`)
- `NEXT_PUBLIC_USE_MOCK_API` (`true` to use frontend mock mode, `false` for real backend)

Rule:

- Do not change endpoint paths or response keys without updating both teams.

## 4) Frontend Can Work Before Backend Is Complete

Until backend features are ready:

- Keep screens functional with placeholders and mock state
- Build against the contract shape (request/response structures)
- Use realistic loading/error/empty states for each page

To run frontend fully without backend:

- Set `NEXT_PUBLIC_USE_MOCK_API=true` in frontend `.env.local`
- Keep `NEXT_PUBLIC_API_BASE_URL` as-is (it is ignored while mock mode is on)
- Login/signup/report/admin flows will use local mocked responses

## 5) Daily Sync (10 minutes)

Share only these 4 items:

- What changed today
- Any contract changes
- Any blocked screen/endpoint
- Next day target

## 6) Merge Cadence

- Merge feature branches into `frontend-dev`/`backend-dev` daily
- Cross-check integration every 2-3 days
- Merge to `main` only after both branches pass manual smoke tests

## 7) Pull Request Checklist

- Small PR (< 300 lines if possible)
- Screenshots/video for UI changes
- Endpoint examples for backend changes
- No secrets committed
- Env example files updated when config changes
