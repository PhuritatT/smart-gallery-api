# Railway Backend Deployment Guide

## Quick Deploy

1. Push your code to GitHub
2. Go to [Railway](https://railway.app)
3. Create new project → Deploy from GitHub repo
4. Select the `backend` directory as root
5. Add PostgreSQL service
6. Set environment variables

## Environment Variables

Set these in Railway Dashboard → Variables:

```
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-frontend.vercel.app

# Database (auto-injected if linked)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Or manually:
DATABASE_HOST=${{Postgres.RAILWAY_PRIVATE_DOMAIN}}
DATABASE_PORT=5432
DATABASE_USER=${{Postgres.POSTGRES_USER}}
DATABASE_PASSWORD=${{Postgres.POSTGRES_PASSWORD}}
DATABASE_NAME=${{Postgres.POSTGRES_DB}}

# JWT
JWT_SECRET=your-secure-production-secret
JWT_EXPIRES_IN=7d

# Google Drive
GOOGLE_API_KEY=your_api_key

# Cloudflare R2
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket
R2_PUBLIC_URL=https://your-public-url.r2.dev
```

## Notes

- Railway auto-detects NestJS and runs `npm run build` then `npm run start:prod`
- PostgreSQL can be linked to auto-inject DATABASE_URL
- Use Railway's private domain for faster DB connections
