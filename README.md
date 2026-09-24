# Production deployment

## Required environment variables

- `NODE_ENV=production`
- `AUTH_SECRET`: at least 32 random characters; never commit it
- `APP_ORIGIN`: the exact public HTTPS origin
- `PORT`: public process port, usually supplied by the host
- `DATA_DIR`: persistent mounted directory for the development storage adapter

## Build and run

```bash
npm ci
npm run build
npm start
```

The production server serves the compiled Vite app and the API from the same origin. Put it behind HTTPS using a managed platform or reverse proxy.

## Security hardening included

- Helmet security headers
- Same-origin-friendly CORS with credentials
- HttpOnly, Secure, SameSite authentication cookie in production
- Signed, expiring authentication tokens
- Password hashing with Node `scrypt`
- Global and authentication-specific rate limiting
- Request body size limits and bounded user input
- Generic authentication errors and graceful shutdown
- Health endpoint at `/api/health`

## Important persistence note

The included JSON adapter is suitable for a single-instance deployment with a persistent disk. For multiple instances or high traffic, replace it with Postgres/Supabase and a shared session store before launch. Do not deploy with ephemeral filesystem storage.

## Launch checklist

- [ ] Configure HTTPS and a custom domain
- [ ] Set a unique `AUTH_SECRET` in the host secret manager
- [ ] Set `APP_ORIGIN` to the exact HTTPS URL
- [ ] Attach persistent storage or migrate the adapter to Postgres/Supabase
- [ ] Configure backups and monitoring for the data store
- [ ] Add an AI provider key only through host secrets
- [ ] Verify `/api/health`, registration, login, logout, project access, and invitation flows
- [ ] Review privacy policy, terms, data retention, and account deletion requirements
