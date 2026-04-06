# Woli Pixel — Deployment Guide

> Deploy the full Woli Pixel stack (API + Web + PostgreSQL) on Railway in ~30 minutes.

## Prerequisites

- [Railway](https://railway.app) account (free tier works for hackathon)
- GitHub repository with the Woli Pixel codebase pushed
- AWS account with an S3 bucket created (region: `sa-east-1` recommended)
- OpenAI API key with access to `gpt-4.1-mini` and `gpt-image-1`
- (Optional) Resend account for transactional emails
- (Optional) Google Cloud project for OAuth login

---

## Architecture Overview

```
+-------------+     +-------------+     +--------------+
|  Web (SPA)  |---->|  API (Bun)  |---->|  PostgreSQL  |
|  Vite build |     |  Hono + S3  |     |  (Railway)   |
+-------------+     +-------------+     +--------------+
     Static              :3000              :5432
```

- **API**: Bun runtime + Hono framework. Exports `{ port, fetch }` — Railway auto-detects via `bun.lock`.
- **Web**: Vite SPA. `bun run build` outputs static files to `dist/`.
- **Database**: Managed PostgreSQL on Railway. `DATABASE_URL` is auto-injected.

---

## Step 1: Deploy PostgreSQL

1. Open your Railway project dashboard
2. Click **"New"** → **"Database"** → **"PostgreSQL"**
3. Railway provisions the database and generates a `DATABASE_URL`
4. Note: Railway auto-injects `DATABASE_URL` into services connected to the same project — no manual copy needed

---

## Step 2: Deploy the API Service

1. Click **"New"** → **"GitHub Repo"** → select your repository
2. Configure the service:
   - **Root Directory**: `apps/api`
   - **Build Command**: `bun install`
   - **Start Command**: `bun run start`
3. Railway detects `bun.lock` and uses the Bun runtime automatically
4. Set the environment variables (see [Step 4](#step-4-configure-environment-variables))
5. Health check endpoint: `GET /api/v1/health` — returns `{ "status": "ok", "timestamp": "...", "version": "0.1.0" }`

### Custom Start Command (alternative)

If Railway doesn't detect the entry point, set:

```
bun run src/index.ts
```

The server binds to `process.env.PORT` (Railway injects this automatically).

---

## Step 3: Deploy the Web Frontend

### Option A: Static Site (Recommended)

1. Click **"New"** → **"GitHub Repo"** → select your repository
2. Configure:
   - **Root Directory**: `apps/web`
   - **Build Command**: `bun install && bun run build`
   - **Output Directory**: `dist`
3. Set environment variable:
   - `VITE_API_URL` = your API service URL + `/api/v1` (e.g., `https://woli-pixel-api.up.railway.app/api/v1`)

> **Important**: `VITE_` variables are embedded at build time, not runtime. You must set them before the build runs.

### Option B: Nixpacks (serves with preview server)

1. Same setup as Option A, but set:
   - **Start Command**: `bun run preview -- --host 0.0.0.0 --port $PORT`
2. This uses Vite's preview server — fine for a hackathon demo, not recommended for production

---

## Step 4: Configure Environment Variables

Set these in the **API service** settings on Railway.

> **Note**: `DATABASE_URL` and `PORT` are auto-injected by Railway when Postgres is linked. Do not set these manually.

**Required variables (you must set these):**

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Set to `production` | `production` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-...` |
| `AWS_REGION` | AWS S3 region | `sa-east-1` |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key | `wJal...` |
| `S3_BUCKET` | S3 bucket name | `woli-pixel-uploads` |
| `BETTER_AUTH_SECRET` | Auth secret (generate with `npx @better-auth/cli secret`) | Random 32+ char string |
| `BETTER_AUTH_URL` | API public URL | `https://woli-pixel-api.up.railway.app` |
| `CORS_ORIGIN` | Web frontend URL(s), comma-separated | `https://woli-pixel-web.up.railway.app` |
| `TRUSTED_ORIGINS` | Same as CORS_ORIGIN — used by better-auth | `https://woli-pixel-web.up.railway.app` |

**Optional variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `UPLOAD_DIR` | Local upload dir (fallback, S3 is primary) | `./uploads` |
| `MAX_FILE_SIZE_MB` | Max upload size (default: 10) | `10` |
| `ANTHROPIC_API_KEY` | Anthropic fallback API key | `sk-ant-api03-...` |
| `BFL_API_KEY` | Flux image generation provider API key | `bfl-...` |
| `RECRAFT_API_KEY` | Recraft image generation provider API key | `recraft-...` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `123...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-...` |
| `RESEND_API_KEY` | Resend email API key | `re_...` |
| `RESEND_FROM_EMAIL` | Sender email address | `noreply@woli.com.br` |

Set this in the **Web service** settings:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_URL` | Yes | API base URL with `/api/v1` suffix | `https://woli-pixel-api.up.railway.app/api/v1` |

---

## Step 5: Run Migrations and Seed

After the API service deploys successfully:

1. Open the API service on Railway
2. Go to the **"Settings"** tab → **"Deploy"** section
3. Use Railway's one-off command runner or connect via Railway CLI:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Link to your project
railway link

# Run migrations
railway run --service api bun run db:migrate

# Seed the 19 image type presets
railway run --service api bun run db:seed
```

Alternatively, add a deploy hook in Railway:

- **Deploy Command**: `bun run db:migrate && bun run db:seed && bun run start`

> **Note**: `db:seed` is idempotent — safe to run on every deploy.

---

## Step 6: Verify

1. **Health check**: `curl https://your-api-url.up.railway.app/api/v1/health`
   ```json
   { "status": "ok", "timestamp": "2026-04-07T...", "version": "0.1.0" }
   ```

2. **Image types**: `curl https://your-api-url.up.railway.app/api/v1/image-types`
   - Should return 19 presets across 4 categories

3. **Web app**: Open the frontend URL in a browser
   - Registration and login should work
   - Image upload and analysis pipeline should function end-to-end

4. **S3 connectivity**: Upload an image through the web app — verify it appears in your S3 bucket

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `bun: command not found` | Ensure Railway detects `bun.lock` in the root/service directory |
| CORS errors in browser | Verify `CORS_ORIGIN` matches the exact frontend URL (no trailing slash) |
| Auth cookies not working | Ensure `BETTER_AUTH_URL` and `TRUSTED_ORIGINS` match the API domain |
| S3 upload fails | Check IAM permissions: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on the bucket |
| Migrations fail | Ensure `DATABASE_URL` is set and the Postgres service is running |
| Google OAuth redirect error | Add the Railway API URL to authorized redirect URIs in Google Cloud Console |

---

## Alternative: Render.com

If Railway is unavailable, [Render](https://render.com) is a solid backup:

1. **PostgreSQL**: Create a managed PostgreSQL instance (free tier: 90 days)
2. **API**: Create a **Web Service**
   - Runtime: **Docker** (Render doesn't natively support Bun — use a `Dockerfile`)
   - Add a `Dockerfile` to `apps/api/`:
     ```dockerfile
     FROM oven/bun:1
     WORKDIR /app
     COPY package.json bun.lock ./
     RUN bun install --production
     COPY . .
     EXPOSE 3000
     CMD ["bun", "run", "start"]
     ```
   - Add a `.dockerignore` in `apps/api/` with: `node_modules`, `uploads/`, `.env`, `*.test.ts`
3. **Web**: Create a **Static Site**
   - Build Command: `cd apps/web && bun install && bun run build`
   - Publish Directory: `apps/web/dist`
4. Environment variables: Same as Railway (set manually in Render dashboard)
5. Migrations: Run via Render Shell or add to the API build command

### Key Differences from Railway

| Feature | Railway | Render |
|---------|---------|--------|
| Bun support | Native (auto-detected) | Docker required |
| Postgres | Managed, auto-injected `DATABASE_URL` | Managed, manual connection string |
| Deploy speed | ~1-2 min | ~3-5 min |
| Free tier | $5 credit/month | 750 hours/month + 90-day Postgres |
| Static sites | Built-in | Built-in |

---

## Security Checklist

Before the hackathon demo:

- [ ] `BETTER_AUTH_SECRET` is a strong random value (not the default)
- [ ] `NODE_ENV=production` is set
- [ ] S3 bucket is not publicly accessible (use presigned URLs)
- [ ] `CORS_ORIGIN` is restricted to your frontend domain only
- [ ] OpenAI/Anthropic API keys have billing limits configured
- [ ] Google OAuth redirect URIs are locked to your domain
