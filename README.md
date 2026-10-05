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

The account API supports registration, login/logout, session restore, profile updates, password changes, and account deletion. Authentication uses an opaque token in an `HttpOnly`, `SameSite=Strict` cookie; only its SHA-256 hash is saved in SQLite. Passwords are hashed with bcrypt.

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
