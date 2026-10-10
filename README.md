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

Shkermit Stacks includes online two-player co-op and duel modes. The first player creates a five-character room code and the second joins it from another browser. Co-op uses one shared board, while duel gives each player a separate board and turns multi-line clears into garbage attacks. Refreshing automatically reclaims the same player seat and board; the server reserves disconnected seats for 30 seconds before expiring them. Vite proxies `/ws/tetris` to the backend during development; in production the Express server handles the WebSocket upgrade on the same origin as the site.

All three playable games support controllers that the browser recognizes with a standard gamepad layout. Connect a controller over USB or Bluetooth and press a button while the game page is focused. Each game shows connection status and its controls. If several controllers are connected, the game keeps using the first supported controller until it disconnects. Controller input is suppressed while the page is unfocused or a text field is being edited; release held buttons before using them again. Keyboard, mouse, and touch controls remain available.

Verified administrators have a discreet **auto** button next to the Tetris sound control during a game. It opens an autopilot settings popup with on/off, speed, balanced/safe/aggressive play styles, next-piece planning, and automatic Frog Flush. Changes apply immediately and save on this device; on/off is not persisted. Speed ranges from 1–20 actions per second in solo and 1–10 online. Autopilot uses legal movement, rotation, and hard-drop actions and controls only the administrator's own piece in multiplayer. Automatic Frog Flush activates at full charge when the stack reaches 10 rows high in solo or co-op. Automatic play waits while paused and stops on game over, restart, or leaving the game. The menu has no auto button.

Tetris **Sound options** is available in the menu and during every game mode. It includes master, music, and sound-effects volume sliders, mute, a test sound, and reset. Changes apply immediately without restarting the music and save on this device. Existing mute preferences are preserved when upgrading to volume controls.

Choose **Customize controls** on any game page to assign controller inputs with a selector or **Press to bind**. Buttons, bumpers, triggers, stick presses, and directions on either stick are available. Release all inputs before a capture, then press or move the input you want. Assigning an input already used by another action swaps those bindings. Changes save separately for each game in local storage, and the controls displayed on the page update immediately. **Reset controller defaults** restores that game's original bindings. Snake and Stacks pause when settings open; resume when you are ready to play. The table below lists the defaults.

| Game | Controller controls (Xbox / PlayStation labels) |
| --- | --- |
| Snake | D-pad or left stick to steer; A / Cross to start or restart; Start / Options to pause or resume. |
| Clicker | A / Cross to earn or activate a focused button; hold X / Square to earn repeatedly; D-pad or left stick to cycle through available shop purchases and buttons; B / Circle to dismiss victory. |
| Stacks | D-pad or left stick to move; Up or A / Cross to rotate; X / Square to hard drop; Y / Triangle for Frog Flush; Start / Options to pause; Back / Share to restart; B / Circle to return to the menu when paused or finished. In the menu, A / Cross starts solo, X / Square creates co-op, Y / Triangle creates a duel, and B / Circle cancels a pending room. Online controls act on the local player's seat. Joining a room still uses the room code field. |

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

Administrators can manage accounts at `/admin/users` through the **Admin** navigation link. The panel includes paginated username/email search, profile edits, email confirmation resend, manual email confirmation, suspension/reactivation, and confirmed account deletion. **Confirm email** marks a pending email as verified and invalidates its outstanding confirmation link without signing the user in or lifting a suspension. Changing an email invalidates sessions and existing confirmation links and sends a new verification email. Suspension invalidates all sessions and blocks login, including sign-in through email confirmation; reactivation requires a fresh login. Deletion also removes sessions, confirmation tokens, and game scores. Accounts whose email appears in `ADMIN_EMAILS` are protected from changes in this panel, even before email confirmation. Admin roles remain configured through `ADMIN_EMAILS`; use account settings to edit your own profile.

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
cd frontend && npm test && npm run lint && npm run build
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
