# AI Thinking App

MindForge is a full-stack AI thinking workspace for structured brainstorming, decisions, planning, analysis, and collaborative reasoning.

## Included upgrades
- **A — Authentication:** account registration, sign-in, password hashing, bearer sessions, and sign-out.
- **B — Persistence:** server-side JSON database in `data/mindforge.json`, ready to replace with Postgres/Supabase without changing the client API.
- **C — Collaboration:** projects, members, invitations by registered email, roles, and shared team workspaces.
- **D — AI chat threads:** persistent project conversations with user messages and AI follow-up responses.
- AI thinking modes, profiles, saved sessions, project metrics, and Markdown export.

## Local development

```bash
npm install
npm run dev
```

The Vite client runs on port 3000 and the Express API runs on port 4000. Data is persisted locally in `data/mindforge.json` and is ignored by Git.

## Environment

Optional `.env`:

```bash
PORT=4000
DATA_DIR=./data
OPENAI_API_KEY=your_api_key_here
```

The current API includes a deterministic fallback generator, so the application works without an AI key. The `/api/generate` contract is intentionally isolated so an OpenAI, Anthropic, or Supabase Edge Function provider can be connected later.

## Production build

```bash
npm run build
npm start
```

For production, replace the JSON persistence adapter with Postgres/Supabase, use a shared session store, and configure HTTPS, rate limiting, email invitations, and a secret-backed token store.
