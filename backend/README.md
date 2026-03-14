# SohojCoaching Backend

## Architecture

See modular backend structure in:

- `docs/architecture.md`

## Database Setup (Railway/PostgreSQL)

1. Set your PostgreSQL connection string in `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DBNAME"
PORT=3000
JWT_SECRET="change-this-secret"
JWT_EXPIRES_IN="8h"

ADMIN_1_ID="admin-001"
ADMIN_1_NAME="Admin One"
ADMIN_1_EMAIL="admin1@sohojcoaching.com"
ADMIN_1_PASSWORD="Admin123!"

ADMIN_2_ID="admin-002"
ADMIN_2_NAME="Admin Two"
ADMIN_2_EMAIL="admin2@sohojcoaching.com"
ADMIN_2_PASSWORD="Admin123!"

ADMIN_3_ID="admin-003"
ADMIN_3_NAME="Admin Three"
ADMIN_3_EMAIL="admin3@sohojcoaching.com"
ADMIN_3_PASSWORD="Admin123!"
```

2. Run one command to setup tables:

```bash
npm run db:setup
```

This command will:
- Generate Prisma client (`prisma generate`)
- Push schema and create/update tables (`prisma db push`)

## SQL Script Setup (alternative)

If you want a direct SQL setup script, use:

- [sql/setup_tables.sql](sql/setup_tables.sql)
- [sql/20260314_fr3_batch_creation_configuration.sql](sql/20260314_fr3_batch_creation_configuration.sql)

Run it from Railway SQL console, or with `psql`:

```bash
psql "$DATABASE_URL" -f sql/setup_tables.sql
```

For FR-3 batch migration script:

```bash
psql "$DATABASE_URL" -f sql/20260314_fr3_batch_creation_configuration.sql
```

## Start Backend

```bash
npm run start
```

## Admin JWT Login (Demo)

Use `POST /api/auth/login` with role `admin` and one of these pre-added admin IDs:

1. `admin1@sohojcoaching.com` / `Admin123!`
2. `admin2@sohojcoaching.com` / `Admin123!`
3. `admin3@sohojcoaching.com` / `Admin123!`

The API returns a JWT token. Send it as a bearer token:

`Authorization: Bearer <token>`

## Student and Teacher JWT Auth

JWT auth now supports these routes:

1. `POST /api/auth/signup`
2. `POST /api/auth/login`
3. `GET /api/auth/me`

`signup` is enabled for `student` and `teacher` roles.

Example signup payload:

```json
{
	"role": "student",
	"name": "John Doe",
	"email": "john@example.com",
	"password": "secret123"
}
```

Note: a new `users.password_hash` column is required for role-based credentials.
Run:

```bash
npm run db:push
```

## Seed Management Test Data

Create 2 students, 2 teachers, and 2 batches for `/management` testing:

```bash
npm run db:seed:management
```

On startup, backend checks DB connection first.
- If connection succeeds, server starts.
- If connection fails, process exits with error.
