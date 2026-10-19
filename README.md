# Alloy Application Demo

React (Vite) frontend + Express backend. The browser never talks to Alloy directly:

```
Browser form → POST /api/apply (Express) → Alloy POST /evaluations → GET /evaluations/{token} → outcome mapped → friendly message
```

> **Demo only.** This runs against Alloy's sandbox environment and is for demonstration
> purposes. Do not enter real personal information (name, address, SSN, etc.) — use
> fictitious data only.

## Run locally

```bash
npm install
cp server/.env.example server/.env   # then fill in credentials
npm run dev                          # client: http://localhost:5173, API: :3001
```

With `ALLOY_MOCK=true`, no Alloy call is made. Use last name `deny` or `review` to see those outcomes; any other name is approved.

With `ALLOY_MOCK=fail`, no Alloy call is made either — instead a bogus evaluation response is fed through the real outcome-parsing logic, which rejects it, to demo the "Something went wrong" error path shown for a malformed or missing outcome from Alloy.

## Production / single deploy

```bash
npm run build && npm start   # Express serves client/dist and /api on one port
```

## Keeping credentials safe

- Credentials live **only** in server environment variables. Never in client code or any `VITE_*` variable, because Vite bundles those into public JS.
- Locally: `server/.env` (gitignored). Only `.env.example` with blank values is committed.
- Cloud: set `ALLOY_WORKFLOW_TOKEN` / `ALLOY_WORKFLOW_SECRET` in your host's secret/env settings (Render, Railway, Heroku, Fly.io, etc.) or a secrets manager (AWS Secrets Manager, GCP Secret Manager).
- The API returns only `{ status, applicantName, message }` to the browser — `applicantName` is just the name the applicant typed, echoed back for display. Alloy's raw response and error details are never forwarded.
