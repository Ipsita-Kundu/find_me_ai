# Frontend (Next.js)

This app connects to the FastAPI backend in `../backend`.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create local env file:

```bash
copy .env.local.example .env.local
```

3. Ensure `.env.local` points to backend:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_USE_MOCK_API=false
```

4. Start frontend:

```bash
npm run dev
```

Frontend runs on `http://localhost:3000`.

## Backend Requirement

Run backend separately from `../backend` (for example via `docker compose up --build`) so API is available on `http://localhost:8000`.
