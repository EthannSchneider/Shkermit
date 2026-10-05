# Shkermit 
## Description
Shkermit is a website that allows users to share and discover memes and games.

## Features
- Meme sharing platform
- JS games sharing platform
- User authentication

## Local development

Shkermit has a Vite/React frontend and an Express API backed by Prisma and SQLite. Use Node.js 20 or newer.

Start the backend:

```bash
cd backend
npm install
npm run db:migrate
npm run dev
```

In a second terminal, start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` requests to `http://localhost:3001`. Prisma creates the SQLite database at `backend/data/shkermit.db` when the migrations are applied. The database file is ignored by Git.

The account API supports registration, email confirmation, login/logout, session restore, profile updates, password changes, and account deletion. Authentication uses an opaque token in an `HttpOnly`, `SameSite=Strict` cookie; only its SHA-256 hash is saved in SQLite. Passwords are hashed with bcrypt. Email confirmation tokens are also hashed, expire after 24 hours by default, and can only be used once.

### Backend structure

The API is split by responsibility:

- `prisma/` contains the declarative database schema and committed migration history.
- `database/` creates the Prisma client.
- `models/` contains Prisma user and session queries, with no handwritten SQL.
- `services/` contains authentication and account business rules.
- `controllers/` translates HTTP input and service results.
- `routes/` declares the public API paths and middleware chain.
- `middleware/`, `serializers/`, and `utils/` contain shared HTTP and support logic.

### Configuration

Copy `backend/.env.example` to `backend/.env` if you need to change the defaults. Supported variables are `PORT`, `DATABASE_URL`, `SESSION_TTL_DAYS`, and `NODE_ENV`. When `NODE_ENV=production`, authentication cookies are marked `Secure`, so the site must be served over HTTPS.

Email links use `APP_URL`, which should be the public frontend origin. Configure delivery with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. In development, leaving `SMTP_HOST` empty prints the confirmation URL in the backend console. Production startup fails when `SMTP_HOST` is missing so accounts cannot silently become unverifiable.

The picture gallery is database-backed and can be managed at `/admin/pictures`. Set `ADMIN_EMAILS` to a comma-separated list of verified account email addresses (for example, `ADMIN_EMAILS=owner@example.com,editor@example.com`). Those users receive the admin navigation and can upload, edit, reorder, replace, and delete pictures. Uploads accept JPEG, PNG, WebP, and GIF files up to 5 MB. Image files are stored in `backend/data/files/pictures/` by default while SQLite stores only metadata; `PICTURE_UPLOAD_DIR` can override that location. Back up both the database and upload directory in production.

### Database migrations

The Prisma schema at `backend/prisma/schema.prisma` is the source of truth. Do not edit generated migration SQL after it has been committed.

During development, change the Prisma schema and generate a named migration:

```bash
cd backend
npm run db:migrate -- --name describe_your_change
```

Commit both the schema change and the new directory under `prisma/migrations/`. Deploy already committed migrations in production or CI without creating new ones:

```bash
npm run db:migrate:deploy
```

Back up the production SQLite file before deploying migrations. Schema corrections should be delivered as a new forward migration rather than by changing migration files that have already run.

Useful commands include `npm run db:migrate:status`, `npm run db:generate`, and `npm run db:studio`.

### Checks

```bash
cd backend && npm test
cd frontend && npm run lint && npm run build
```

### Docker

The root `Dockerfile` builds the React application and copies its production output into `backend/public`. Express serves that directory with SPA fallback routing while keeping `/api` routes on the backend.

Build the image from the repository root:

```bash
docker build -t shkermit .
```

Run it with a persistent data volume and your production configuration:

```bash
docker run --rm -p 3001:3001 \
  --env-file backend/.env \
  -v shkermit-data:/app/backend/data \
  shkermit
```

The container applies committed Prisma migrations before starting. The named volume persists SQLite and uploaded pictures. The built frontend and bundled pictures are included in the image.
