# SohojCoaching Backend

## Database Setup (Railway/PostgreSQL)

1. Set your PostgreSQL connection string in `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DBNAME"
PORT=3000
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

Run it from Railway SQL console, or with `psql`:

```bash
psql "$DATABASE_URL" -f sql/setup_tables.sql
```

## Start Backend

```bash
npm run start
```

## Seed Management Test Data

Create 2 students, 2 teachers, and 2 batches for `/management` testing:

```bash
npm run db:seed:management
```

On startup, backend checks DB connection first.
- If connection succeeds, server starts.
- If connection fails, process exits with error.
